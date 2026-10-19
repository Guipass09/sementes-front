import { useState } from "react";
import { BadgeCheck, Check, Copy, Link2, Loader2, RefreshCw, ShieldCheck, Unlink, UserRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { isApiError, professionalPatientRegistrationLink, revokePatientRegistrationLink } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { registrationLinkUrl, type PatientRegistrationLink } from "./registration";

export default function PatientRegistrationLinkButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<PatientRegistrationLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<"renew" | "revoke" | null>(null);
  if (user?.role !== "professional" || user.clinic_name?.trim() || user.clinic_user_id != null
    || user.professional_subscription_status !== "active") return null;

  const load = async (renew = false) => {
    setBusy(true);
    setError("");
    setCopied(false);
    try { setLink(await professionalPatientRegistrationLink(renew)); }
    catch (error) {
      setLink(null);
      setError(isApiError(error) ? error.data?.message || "Não foi possível gerar o link." : "Não foi possível gerar o link. Tente novamente.");
    } finally { setBusy(false); }
  };
  const url = link ? registrationLinkUrl(window.location.origin, link.token) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { toast({ title: "Selecione e copie o link abaixo", description: "O navegador não permitiu a cópia automática." }); }
  };
  const confirm = async () => {
    const action = confirmation;
    setConfirmation(null);
    if (action === "renew") { await load(true); return; }
    setBusy(true);
    try {
      await revokePatientRegistrationLink();
      setLink(null);
      setOpen(false);
      toast({ title: "Link desativado", description: "Os pacientes já cadastrados continuam vinculados." });
    } catch { toast({ title: "Não foi possível desativar o link", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setOpen(true); void load(); }}>
      <Link2 className="mr-2 h-4 w-4" /> Link de cadastro
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] max-w-lg overflow-y-auto rounded-lg border-[#cbded4] p-0">
        <DialogHeader className="border-b border-border px-6 pb-5 pt-6 text-left">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Link2 size={22} /></span>
          <DialogTitle className="font-display text-xl tracking-normal">Um convite para começar</DialogTitle>
          <DialogDescription>Novos pacientes se cadastram pelo seu link e já entram vinculados a você.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-6 pb-6">
          {busy ? <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin" /> Preparando seu link...</div> : error ?
            <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : link && <>
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                  {link.professional.photo_url ? <img src={normalizeMediaUrl(link.professional.photo_url)} alt="" className="h-full w-full object-cover" /> : <UserRound size={24} />}
                </span>
                <div className="min-w-0"><p className="break-words font-semibold">{link.professional.name}</p>
                  {link.professional.registration && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><BadgeCheck size={14} className="shrink-0 text-primary" /><span className="break-all">{link.professional.registration}</span></p>}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="patient-registration-url" className="text-sm font-medium">Seu link de cadastro</label>
                <Input id="patient-registration-url" value={url} readOnly onFocus={(event) => event.target.select()} className="text-xs" />
                <Button className="w-full" onClick={() => void copy()}><span aria-live="polite" className="inline-flex items-center gap-2">{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Link copiado" : "Copiar link"}</span></Button>
                <p className="text-xs text-muted-foreground">Válido até {new Date(link.expires_at).toLocaleDateString("pt-BR")}. Pode ser enviado a mais de um novo paciente.</p>
              </div>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" />O paciente confirma seu nome e autoriza o vínculo no cadastro. Quem já tem conta continua pela busca por e-mail.</p>
              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmation("renew")}><RefreshCw size={14} className="mr-2" />Renovar link</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmation("revoke")} className="text-destructive"><Unlink size={14} className="mr-2" />Desativar</Button>
              </div>
            </>}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!confirmation} onOpenChange={(value) => { if (!value) setConfirmation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{confirmation === "renew" ? "Renovar o link de cadastro?" : "Desativar este link?"}</AlertDialogTitle>
          <AlertDialogDescription>O link enviado anteriormente deixará de aceitar cadastros. Os pacientes já vinculados não serão afetados.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void confirm()}>{confirmation === "renew" ? "Renovar link" : "Desativar link"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
