import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityMediaType, ActivityRow, ProfessionalUserRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { isApiError } from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type MediaDraft = {
  id: string;
  file: File | null;
  thumbnail: File | null;
  media_type: ActivityMediaType;
  caption: string;
};

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function filePreviewUrl(file: File | null): string | null {
  if (!file) return null;
  return URL.createObjectURL(file);
}

export function ProfessionalActivityFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial?: ActivityRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<ProfessionalUserRow[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<number[]>([]);

  const [existingMedia, setExistingMedia] = useState<ActivityRow["media"]>([]);
  const [drafts, setDrafts] = useState<MediaDraft[]>([]);
  const [formError, setFormError] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirmar");
  const [confirmDescription, setConfirmDescription] = useState<string | undefined>(undefined);
  const confirmActionRef = useMemo(() => ({ run: null as null | (() => void) }), []);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await api.professionalListUsers();
        if (cancelled) return;
        setUsers(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (props.mode === "edit" && props.initial) {
      setTitle(props.initial.title);
      setDescription(props.initial.description);
      setCategory(props.initial.category ?? "");
      setEstimatedTime(props.initial.estimated_time ?? "");
      setAssignedTo((props.initial.assigned_to ?? []).map((u) => u.id));
      setExistingMedia(props.initial.media ?? []);
    } else {
      setTitle("");
      setDescription("");
      setCategory("");
      setEstimatedTime("");
      setAssignedTo([]);
      setExistingMedia([]);
    }
    setDrafts([]);
  }, [props.open, props.mode, props.initial]);

  useEffect(() => {
    const urls = drafts
      .flatMap((d) => [filePreviewUrl(d.file), filePreviewUrl(d.thumbnail)])
      .filter(Boolean) as string[];
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [drafts]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !description.trim()) return false;
    if (assignedTo.length === 0) return false;
    return true;
  }, [title, description, assignedTo]);

  const toggleUser = (userId: number) => {
    setAssignedTo((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const addDraft = () => {
    setDrafts((prev) => [...prev, { id: uid(), file: null, thumbnail: null, media_type: "image", caption: "" }]);
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDraft = (id: string, patch: Partial<MediaDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeExistingMedia = async (mediaId: number) => {
    if (!props.initial) return;
    await api.professionalDeleteActivityMedia({ activity_id: props.initial.id, media_id: mediaId });
    setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const openConfirm = (params: { title: string; description?: string; onConfirm: () => void }) => {
    confirmActionRef.run = params.onConfirm;
    setConfirmTitle(params.title);
    setConfirmDescription(params.description);
    setConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setFormError("");
    setSaving(true);
    try {
      if (props.mode === "create") {
        await api.professionalCreateActivity({
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || undefined,
          estimated_time: estimatedTime.trim() || undefined,
          assigned_to: assignedTo,
          media: drafts
            .filter((d) => d.file)
            .map((d) => ({
              file: d.file!,
              media_type: d.media_type,
              caption: d.caption,
              thumbnail: d.media_type === "video" ? d.thumbnail : null,
            })),
        });
      } else if (props.initial) {
        await api.professionalUpdateActivity(props.initial.id, {
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || "",
          estimated_time: estimatedTime.trim() || "",
          assigned_to: assignedTo,
        });

        const toUpload = drafts.filter((d) => d.file);
        for (let i = 0; i < toUpload.length; i++) {
          const d = toUpload[i];
          await api.professionalAddActivityMedia({
            activity_id: props.initial.id,
            file: d.file!,
            media_type: d.media_type,
            caption: d.caption,
            position: existingMedia.length + i,
            thumbnail: d.media_type === "video" ? d.thumbnail : null,
          });
        }
      }

      await props.onSaved();
      props.onOpenChange(false);
      toast({
        title: props.mode === "create" ? "Atividade criada!" : "Atividade atualizada!",
        description: "A atividade foi salva e enviada para os usuários selecionados.",
      });
    } catch (e) {
      const msg = isApiError(e) ? e.message : "Não foi possível salvar agora.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Nova Atividade" : "Editar Atividade"}</DialogTitle>
          <DialogDescription>Crie e envie atividades para os usuários atribuídos a você.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {formError ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{formError}</div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Atividade de articulação" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Fala" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedTime">Tempo estimado</Label>
            <Input id="estimatedTime" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="Ex: 10 min" />
          </div>

          <div className="space-y-2">
            <Label>Enviar para</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {loadingUsers ? (
                <div className="text-sm text-muted-foreground">Carregando usuários...</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum usuário atribuído. Peça ao admin para vincular usuários.</div>
              ) : (
                users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={assignedTo.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-foreground">Mídias</div>
              <Button type="button" variant="outline" onClick={addDraft}>
                <Plus size={16} className="mr-2" />
                Adicionar mídia
              </Button>
            </div>

            {existingMedia.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-muted-foreground">Mídias existentes</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {existingMedia.map((m) => (
                    <div key={m.id} className="rounded-xl border border-border p-3 bg-card">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                          {m.media_type === "image" ? (
                            <img src={normalizeMediaUrl(m.url)} alt="" className="w-full h-full object-cover" />
                          ) : m.thumbnail_url ? (
                            <img src={normalizeMediaUrl(m.thumbnail_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <VideoIcon size={18} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{m.media_type === "image" ? "Imagem" : "Vídeo"}</div>
                          {m.caption ? <div className="text-xs text-muted-foreground line-clamp-2">{m.caption}</div> : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            openConfirm({
                              title: "Remover mídia?",
                              description: "Essa mídia será removida permanentemente.",
                              onConfirm: () => void removeExistingMedia(m.id),
                            });
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="mt-3 space-y-3">
                {drafts.map((d) => {
                  const preview = filePreviewUrl(d.file);
                  const thumbPrev = filePreviewUrl(d.thumbnail);
                  return (
                    <div key={d.id} className="rounded-xl border border-border p-4 bg-card">
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateDraft(d.id, { media_type: "image", thumbnail: null })}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                                d.media_type === "image" ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground"
                              }`}
                            >
                              <ImageIcon size={16} /> Imagem
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDraft(d.id, { media_type: "video" })}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                                d.media_type === "video" ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground"
                              }`}
                            >
                              <VideoIcon size={16} /> Vídeo
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Arquivo</Label>
                              <Input
                                type="file"
                                accept={d.media_type === "image" ? "image/*" : "video/*"}
                                onChange={(e) => updateDraft(d.id, { file: e.target.files?.[0] ?? null })}
                              />
                              {preview ? (
                                d.media_type === "image" ? (
                                  <img src={preview} alt="" className="w-full max-h-56 object-cover rounded-lg border border-border" />
                                ) : (
                                  <video src={preview} className="w-full max-h-56 rounded-lg border border-border" controls />
                                )
                              ) : null}
                            </div>

                            {d.media_type === "video" ? (
                              <div className="space-y-2">
                                <Label>Thumbnail (opcional)</Label>
                                <Input type="file" accept="image/*" onChange={(e) => updateDraft(d.id, { thumbnail: e.target.files?.[0] ?? null })} />
                                {thumbPrev ? (
                                  <img src={thumbPrev} alt="" className="w-full max-h-56 object-cover rounded-lg border border-border" />
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label>Legenda (opcional)</Label>
                            <Input value={d.caption} onChange={(e) => updateDraft(d.id, { caption: e.target.value })} placeholder="Ex: Exemplo de som / imagem" />
                          </div>
                        </div>

                        <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => removeDraft(d.id)}>
                          <Trash2 size={16} className="mr-2" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={!canSubmit || saving || users.length === 0}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <BrandedConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmTitle}
          description={confirmDescription}
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => confirmActionRef.run?.()}
        />
      </DialogContent>
    </Dialog>
  );
}

