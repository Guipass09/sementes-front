import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, BadgeCheck, Camera, Check, IdCard, Loader2, LockKeyhole, Mail, RotateCcw, Save, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { isApiError, updateMe, type AuthUser } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { PROFILE_DESCRIPTION_LIMIT, PROFILE_NAME_LIMIT, profileInitials, profilePhotoError, profileRegistration, profileTextErrors } from "@/features/profile/profile";
import ProfileSharingId from "@/features/profile/ProfileSharingId";

export default function Profile() {
  const auth = useAuth();
  const location = useLocation();
  const preview = location.pathname.startsWith("/preview-");
  const previewUser: AuthUser = {
    id: 0, name: location.pathname.startsWith("/preview-admin") ? "Administrador Preview" : "Paciente Preview",
    email: "preview@example.test", role: location.pathname.startsWith("/preview-admin") ? "admin" : "user",
    blocked: false, access: { atividades: true, horarios: true, relatorios: true },
  };
  const user = preview ? previewUser : auth.user;
  if (!user) return null;
  return <ProfileEditor key={user.id} user={user} preview={preview} onSaved={auth.setAuthUser} />;
}

export function ProfileEditor({ user, preview = false, onSaved }: { user: AuthUser; preview?: boolean; onSaved: (user: AuthUser) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [description, setDescription] = useState(user.profile_description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string; photo?: string; form?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const registration = profileRegistration(user);
  const professional = user.role === "professional";
  const accountLabel = user.role === "admin" ? "Administrador" : professional
    ? (user.clinic_name?.trim() ? "Clínica" : "Profissional") : "Paciente";
  const dirty = name.trim() !== user.name || description !== (user.profile_description ?? "") || !!file || removePhoto;
  const photoUrl = removePhoto ? null : file ? filePreview : user.profile_photo_url;
  const displayName = name.trim() || user.name;

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!dirty || preview) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, preview]);

  const pickPhoto = (next: File | null) => {
    if (!next || saving) return;
    const error = profilePhotoError(next);
    setErrors((current) => ({ ...current, photo: error ?? undefined, form: undefined }));
    if (error) return;
    setFile(next);
    setRemovePhoto(false);
    setSaved(false);
  };
  const discard = () => {
    setName(user.name);
    setDescription(user.profile_description ?? "");
    setFile(null);
    setRemovePhoto(false);
    setErrors({});
    setSaved(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || preview || !dirty) return;
    const validation = profileTextErrors(name, description);
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (validation.name) nameInput.current?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateMe({ name: name.trim(), profile_description: description, profile_photo: file, remove_photo: removePhoto });
      onSaved(updated);
      setName(updated.name);
      setDescription(updated.profile_description ?? "");
      setFile(null);
      setRemovePhoto(false);
      if (fileInput.current) fileInput.current.value = "";
      setSaved(true);
      toast({ title: "Perfil atualizado", description: "Suas alterações foram salvas." });
    } catch (error) {
      const fields = isApiError(error) ? error.data?.errors : undefined;
      setErrors({
        name: fields?.name?.[0], description: fields?.profile_description?.[0], photo: fields?.profile_photo?.[0],
        form: "Não foi possível salvar seu perfil. Suas alterações foram mantidas para tentar novamente.",
      });
    } finally { setSaving(false); submitting.current = false; }
  };

  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-10">
    <header className="mb-7 flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-green-dark"><UserRound size={23} strokeWidth={1.7} /></span>
      <div><h1 className="font-display text-2xl font-semibold text-foreground">Meu perfil</h1><p className="mt-1 text-sm text-muted-foreground">Informações pessoais e profissionais</p></div>
    </header>
    <form onSubmit={submit} noValidate aria-label="Editar meu perfil">
      <section aria-label="Foto e identificação" className="flex flex-col gap-5 border-y border-border bg-card/60 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
        <div className="relative w-fit shrink-0">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#e7eeec] text-2xl font-semibold text-[#345e50] shadow-sm">
            {photoUrl ? <img src={normalizeMediaUrl(photoUrl)} alt="Foto do perfil" className="h-full w-full object-cover" /> : profileInitials(displayName)}
          </div>
          <Tooltip><TooltipTrigger asChild><button type="button" disabled={saving || preview} onClick={() => fileInput.current?.click()}
            aria-label="Alterar foto do perfil" className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#18664d] text-white hover:bg-[#12533e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><Camera size={15} /></button></TooltipTrigger><TooltipContent>Alterar foto</TooltipContent></Tooltip>
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-xl font-semibold text-foreground">{displayName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><UserRound size={14} />{accountLabel}</span>
            {professional && registration && <span className="inline-flex max-w-full items-start gap-1.5"><BadgeCheck size={15} className="shrink-0 text-brand-green-dark" /><span className="break-all">{registration}</span></span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving || preview} onClick={() => fileInput.current?.click()}><Camera size={15} className="mr-2" />{photoUrl ? "Trocar foto" : "Adicionar foto"}</Button>
            {(user.profile_photo_url || file) && !removePhoto && <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remover foto do perfil" disabled={saving || preview} onClick={() => {
              setFile(null); setRemovePhoto(!!user.profile_photo_url); setSaved(false); setErrors((current) => ({ ...current, photo: undefined }));
              if (fileInput.current) fileInput.current.value = "";
            }}><Trash2 size={16} /></Button></TooltipTrigger><TooltipContent>Remover foto</TooltipContent></Tooltip>}
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP ou GIF · até 5 MB</span>
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Arquivo da foto do perfil" disabled={saving || preview}
            onChange={(event) => { pickPhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          {errors.photo && <p role="alert" className="mt-2 text-xs text-destructive">{errors.photo}</p>}
        </div>
      </section>

      <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <section aria-labelledby="profile-details-title" className="min-w-0 space-y-5">
          <h2 id="profile-details-title" className="text-base font-semibold text-foreground">Informações do perfil</h2>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" ref={nameInput} value={name} autoComplete="name" maxLength={PROFILE_NAME_LIMIT} disabled={saving || preview}
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "profile-name-error" : undefined} className="bg-card"
              onChange={(event) => { setName(event.target.value); setSaved(false); setErrors((current) => ({ ...current, name: undefined, form: undefined })); }} />
            {errors.name && <p id="profile-name-error" role="alert" className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-description">Descrição</Label>
            <Textarea id="profile-description" value={description} maxLength={PROFILE_DESCRIPTION_LIMIT} rows={7} disabled={saving || preview}
              aria-invalid={!!errors.description} aria-describedby="profile-description-count" className="min-h-40 resize-y bg-card leading-relaxed" placeholder={professional ? "Sua apresentação profissional" : "Sobre você"}
              onChange={(event) => { setDescription(event.target.value); setSaved(false); setErrors((current) => ({ ...current, description: undefined, form: undefined })); }} />
            <div className="flex justify-end"><span id="profile-description-count" className="text-xs tabular-nums text-muted-foreground">{description.length.toLocaleString("pt-BR")} / 5.000</span></div>
            {errors.description && <p role="alert" className="text-xs text-destructive">{errors.description}</p>}
          </div>
        </section>
        <aside aria-labelledby="profile-account-title" className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <h2 id="profile-account-title" className="mb-5 text-base font-semibold text-foreground">Dados da conta</h2>
          <dl className="divide-y divide-border text-sm">
            <div className="pb-5"><dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail size={15} />E-mail</dt><dd className="break-all font-medium text-foreground">{user.email}</dd></div>
            <div className="py-5"><dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><UserRound size={15} />Tipo de conta</dt><dd className="font-medium text-foreground">{accountLabel}</dd></div>
          </dl>
          {professional && <div className="border-t border-border pt-5">
            <Label htmlFor="profile-registration" className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><IdCard size={15} />Número de registro</Label>
            <div className="relative"><Input id="profile-registration" value={registration ?? "Não informado"} readOnly aria-readonly="true" className="bg-muted/40 pr-9 text-foreground shadow-none" />
              <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label="Registro profissional: somente leitura" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><LockKeyhole size={15} /></span></TooltipTrigger><TooltipContent>Registro profissional não editável</TooltipContent></Tooltip>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole size={12} />Somente leitura</p>
          </div>}
          {professional && <ProfileSharingId shareId={user.professional_share_id} />}
        </aside>
      </div>
      {errors.form && <p role="alert" className="mb-5 flex items-start gap-2 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" />{errors.form}</p>}
      <footer className="flex flex-col gap-4 border-t border-border py-5 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className={`flex items-center gap-2 text-xs ${saved && !dirty ? "text-[#18664d]" : "text-muted-foreground"}`}>
          {saving ? <><Loader2 size={15} className="animate-spin" />Salvando alterações...</> : dirty ? <><span className="h-1.5 w-1.5 rounded-full bg-[#b67c2b]" />Alterações não salvas</> : saved ? <><Check size={15} />Perfil atualizado</> : preview ? "Visualização do perfil" : "Nenhuma alteração pendente"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={discard} disabled={saving || !dirty || preview}><RotateCcw size={16} className="mr-2" />Descartar</Button>
          <Button type="submit" disabled={saving || !dirty || preview} className="bg-[#18664d] hover:bg-[#12533e]">{saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}Salvar alterações</Button>
        </div>
      </footer>
    </form>
  </div>;
}
