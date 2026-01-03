import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { Camera, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
  onSaved?: (u: AuthUser) => void;
};

export default function EditProfileModal({ open, onOpenChange, user, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user.name);
  const [description, setDescription] = useState(user.profile_description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.profile_photo_url ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user.name);
    setDescription(user.profile_description ?? "");
    setFile(null);
    setPreviewUrl(user.profile_photo_url ?? null);
    setRemovePhoto(false);
  }, [open, user.name, user.profile_description, user.profile_photo_url]);

  useEffect(() => {
    return () => {
      if (previewUrl && file) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, file]);

  const initials = useMemo(() => user.name.split(" ").map((n) => n[0]).join("").slice(0, 2), [user.name]);

  const onPickFile = (f: File | null) => {
    if (previewUrl && file) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setRemovePhoto(false);
    setPreviewUrl(f ? URL.createObjectURL(f) : user.profile_photo_url ?? null);
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Informe um nome", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name: name.trim(),
        profile_description: description,
        profile_photo: file,
        remove_photo: removePhoto,
      });
      toast({ title: "Perfil atualizado" });
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: "Não foi possível salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
          <div className="sm:col-span-4">
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <div className="flex items-center justify-center">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-lg font-semibold text-muted-foreground">{initials}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <label htmlFor="profile-photo" className="cursor-pointer inline-flex items-center justify-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar foto
                  </label>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("w-full", removePhoto && "border-destructive text-destructive")}
                  onClick={() => {
                    setRemovePhoto((v) => !v);
                    setFile(null);
                    setPreviewUrl(removePhoto ? user.profile_photo_url ?? null : null);
                  }}
                  disabled={!user.profile_photo_url && !file}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover foto
                </Button>

                <div className="text-xs text-muted-foreground">
                  No celular, você pode escolher da galeria e, dependendo do aparelho, também abrir a câmera.
                  <span className="inline-flex items-center gap-1 ml-1">
                    <Camera className="h-3 w-3" />{" "}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-8 space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Profissional da clínica, especialista em..."
                rows={5}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={onSubmit} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


