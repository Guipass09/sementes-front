import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActivityMediaType, ActivityRow, AdminUserRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { isApiError } from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

type MediaDraft = {
  id: string;
  file: File | null;
  thumbnail: File | null; // apenas para vídeo
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

export function ActivityFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial?: ActivityRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

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

  // carregar usuários para seleção
  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const list = await api.adminListUsers();
        if (cancelled) return;
        setUsers(list.filter((u) => u.role === "user"));
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open]);

  // preencher formulário
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

  // revoke previews
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
    setAssignedTo((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const addDraft = () => {
    setDrafts((prev) => [
      ...prev,
      { id: uid(), file: null, thumbnail: null, media_type: "image", caption: "" },
    ]);
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDraft = (id: string, patch: Partial<MediaDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeExistingMedia = async (mediaId: number) => {
    if (!props.initial) return;
    await api.adminDeleteActivityMedia({ activity_id: props.initial.id, media_id: mediaId });
    // atualiza local
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
        await api.adminCreateActivity({
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
        await api.adminUpdateActivity(props.initial.id, {
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || "",
          estimated_time: estimatedTime.trim() || "",
          assigned_to: assignedTo,
        });

        // upload de novas mídias (drafts)
        const toUpload = drafts.filter((d) => d.file);
        for (let i = 0; i < toUpload.length; i++) {
          const d = toUpload[i];
          await api.adminAddActivityMedia({
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
      if (isApiError(e)) {
        const msg =
          e.status === 419
            ? "Sessão expirada. Recarregue a página e tente novamente."
            : e.data?.message || `Não foi possível salvar (erro ${e.status}).`;
        setFormError(msg);
        console.error("Activity API error:", e.status, e.data);
      } else {
        setFormError("Não foi possível salvar agora. Verifique sua conexão e tente novamente.");
        console.error("Activity unknown error:", e);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Nova Atividade" : "Editar Atividade"}</DialogTitle>
          <DialogDescription>
            {props.mode === "create"
              ? "Crie uma atividade e envie para um ou mais usuários."
              : "Edite os detalhes e as mídias da atividade."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {formError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{formError}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a atividade (como já está hoje)..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedTime">Tempo estimado</Label>
              <Input
                id="estimatedTime"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="Ex: 10 min"
              />
            </div>
          </div>

          {/* Envio para usuários */}
          <div className="space-y-2">
            <Label>Enviar para usuários</Label>
            <div className="border border-border rounded-lg p-4 space-y-2 max-h-56 overflow-y-auto">
              <div className="flex items-center space-x-2 pb-2 border-b border-border">
                <Checkbox
                  id="select-all-users-activity"
                  checked={assignedTo.length === users.length && users.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) setAssignedTo(users.map((u) => u.id));
                    else setAssignedTo([]);
                  }}
                  disabled={loadingUsers}
                />
                <Label htmlFor="select-all-users-activity" className="font-semibold cursor-pointer">
                  Selecionar Todos
                </Label>
              </div>

              {users.map((u) => (
                <div key={u.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`activity-user-${u.id}`}
                    checked={assignedTo.includes(u.id)}
                    onCheckedChange={() => toggleUser(u.id)}
                    disabled={loadingUsers}
                  />
                  <Label htmlFor={`activity-user-${u.id}`} className="cursor-pointer flex-1">
                    {u.name}
                  </Label>
                </div>
              ))}
            </div>
            {assignedTo.length === 0 && (
              <p className="text-xs text-destructive">
                Selecione pelo menos 1 usuário para enviar a atividade.
              </p>
            )}
          </div>

          {/* Mídias */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Mídias (fotos/vídeos) + descrição por etapa</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione várias fotos/vídeos e escreva a descrição de cada etapa (estilo história/atividade interativa).
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addDraft}>
                <Plus size={18} className="mr-2" />
                Adicionar mídia
              </Button>
            </div>

            {props.mode === "edit" && existingMedia.length > 0 && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Mídias já enviadas</p>
                <div className="space-y-2">
                  {existingMedia.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {m.media_type === "image" ? "Imagem" : "Vídeo"} #{m.position + 1}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {m.caption || "Sem descrição"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          openConfirm({
                            title: "Excluir mídia?",
                            description: "Esta ação é permanente e removerá o arquivo do servidor.",
                            onConfirm: () => {
                              void removeExistingMedia(m.id).catch(() => {
                                toast({
                                  title: "Erro",
                                  description: "Não foi possível excluir a mídia agora.",
                                  variant: "destructive",
                                });
                              });
                            },
                          });
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drafts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nenhuma mídia adicionada ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((d, idx) => {
                  const preview = filePreviewUrl(d.file);
                  const thumbPreview = filePreviewUrl(d.thumbnail);
                  return (
                    <div key={d.id} className="rounded-xl border border-border p-4 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            Etapa {idx + 1}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Escolha foto ou vídeo e descreva o que fazer/observar nesta etapa.
                          </p>
                        </div>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeDraft(d.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                              value={d.media_type}
                              onValueChange={(v) => updateDraft(d.id, { media_type: v as ActivityMediaType })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="image">
                                  <span className="inline-flex items-center gap-2">
                                    <ImageIcon size={16} />
                                    Foto
                                  </span>
                                </SelectItem>
                                <SelectItem value="video">
                                  <span className="inline-flex items-center gap-2">
                                    <VideoIcon size={16} />
                                    Vídeo
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Arquivo</Label>
                            <Input
                              type="file"
                              accept={d.media_type === "image" ? "image/*" : "video/*"}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                updateDraft(d.id, { file: f });
                              }}
                            />
                          </div>

                          {d.media_type === "video" && (
                            <div className="space-y-2">
                              <Label>Thumbnail do vídeo (opcional)</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  updateDraft(d.id, { thumbnail: f });
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Essa imagem aparece como prévia do vídeo antes de dar play.
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Descrição desta etapa</Label>
                            <Textarea
                              rows={5}
                              value={d.caption}
                              onChange={(e) => updateDraft(d.id, { caption: e.target.value })}
                              placeholder="Ex: Mostre a imagem e peça para a criança nomear os objetos..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Prévia</Label>
                          <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                            {preview ? (
                              d.media_type === "image" ? (
                                <img src={preview} alt="Prévia" className="w-full h-64 object-contain bg-white" />
                              ) : (
                                <video
                                  src={preview}
                                  controls
                                  poster={thumbPreview || undefined}
                                  className="w-full h-64 object-contain bg-black"
                                />
                              )
                            ) : (
                              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                                Selecione um arquivo para visualizar.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit || saving}>
              {saving
                ? "Salvando..."
                : props.mode === "create"
                  ? "Criar Atividade"
                  : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <BrandedConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={confirmTitle}
      description={confirmDescription}
      confirmLabel="Excluir"
      cancelLabel="Cancelar"
      variant="danger"
      onConfirm={() => {
        confirmActionRef.run?.();
      }}
    />
    </>
  );
}


