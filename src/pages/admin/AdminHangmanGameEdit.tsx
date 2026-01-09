import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Type, Upload, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, HangmanGameRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

type SupportInput = { file: File | null; previewUrl: string | null; existingUrl?: string | null };

function normalizeSecretWordUi(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 15);
}

export default function AdminHangmanGameEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const gameId = useMemo(() => Number(id), [id]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [game, setGame] = useState<HangmanGameRow | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secretWordInput, setSecretWordInput] = useState("");
  const [search, setSearch] = useState("");
  const [support, setSupport] = useState<SupportInput[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const normalizedPreview = useMemo(() => normalizeSecretWordUi(secretWordInput), [secretWordInput]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (uid: number) => {
    setSelectedUserIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  useEffect(() => {
    if (!Number.isFinite(gameId)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, u] = await Promise.all([api.adminGetHangmanGame(gameId), api.adminListUsers()]);
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setSecretWordInput(g.secret_word ?? "");
        setSelectedUserIds((g.assigned_to ?? []).map((x) => x.id));
        setUsers(u.filter((x) => x.role === "user"));
        setSupport((g.support_images ?? []).map((it) => ({ file: null, previewUrl: normalizeMediaUrl(it.url), existingUrl: normalizeMediaUrl(it.url) })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    return () => {
      support.forEach((s) => {
        if (s.previewUrl && s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSupportImage = (file: File | null) => {
    if (!file) return;
    if (support.length >= 5) {
      toast({ title: "Limite de 5 imagens", variant: "destructive" });
      return;
    }
    setSupport((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
  };

  const removeSupportImage = (idx: number) => {
    setSupport((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (old?.previewUrl && old.previewUrl.startsWith("blob:")) URL.revokeObjectURL(old.previewUrl);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const onSave = async () => {
    if (!game) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!normalizedPreview) {
      toast({ title: "Informe a palavra secreta", description: "Use apenas letras (máx. 15).", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }

    // Se houver algum arquivo novo, substitui o conjunto de imagens
    const newFiles = support.map((s) => s.file).filter(Boolean) as File[];
    const hasAnyNewFile = newFiles.length > 0;
    const hadExisting = (game.support_images?.length ?? 0) > 0;
    const nowHasNone = support.length === 0;

    setSaving(true);
    try {
      const updated = await api.adminUpdateHangmanGame(game.id, {
        title: title.trim(),
        description: description.trim(),
        secret_word: secretWordInput,
        assigned_to: selectedUserIds,
        ...(hasAnyNewFile ? { support_images: newFiles } : {}),
        ...(hadExisting && nowHasNone ? { clear_images: true } : {}),
      });
      setGame(updated);
      toast({ title: "Jogo atualizado!" });
      navigate(`/admin/jogos/forca`);
    } catch {
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!game) return;
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!game) return;
    try {
      await api.adminDeleteHangmanGame(game.id);
      toast({ title: "Jogo excluído" });
      navigate("/admin/jogos/forca");
    } catch {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onDelete} disabled={saving || loading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <Button onClick={onSave} disabled={saving || loading} className="bg-brand-orange text-white hover:bg-brand-orange/90">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground inline-flex items-center gap-2">
            <Type className="h-6 w-6 text-brand-orange" />
            Editar Jogo da Forca
          </h1>
          {game && <p className="text-muted-foreground">ID: {game.id} • {game.word_length} letras</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Palavra secreta (máx. 15 letras)</Label>
                  <Input value={secretWordInput} onChange={(e) => setSecretWordInput(e.target.value)} />
                  <div className="text-xs text-muted-foreground">
                    Normalizado:{" "}
                    <span className={cn("font-semibold", normalizedPreview ? "text-foreground" : "text-destructive")}>
                      {normalizedPreview || "—"}
                    </span>{" "}
                    ({normalizedPreview.length}/15)
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-foreground">Imagens de apoio</div>
                    <div className="text-sm text-muted-foreground">{support.length}/5</div>
                  </div>

                  <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                    {support.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-background/50 p-3">
                        <div className="aspect-[4/3] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                          {s.previewUrl ? (
                            <img
                              src={normalizeMediaUrl(s.previewUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">Imagem {idx + 1}</div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSupportImage(idx)} aria-label="Remover">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {support.length < 5 && (
                      <div className="rounded-xl border border-dashed border-border bg-background/30 p-3">
                        <div className="aspect-[4/3] rounded-lg bg-muted/20 flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <Upload className="h-6 w-6 mx-auto mb-1" />
                            <div className="text-xs">Adicionar imagem</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <input
                            id="hangman-support-edit"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              addSupportImage(e.target.files?.[0] ?? null);
                              e.currentTarget.value = "";
                            }}
                          />
                          <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                            <label htmlFor="hangman-support-edit">Enviar</label>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {support.some((s) => s.file) && (
                    <p className="text-sm text-orange-600 mt-2">
                      Ao salvar com novas imagens, o sistema substituirá o conjunto inteiro de imagens de apoio.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-foreground">Enviar para usuários</div>
                <div className="text-sm text-muted-foreground">{selectedUserIds.length} selecionado(s)</div>
              </div>
            </div>

            <div className="space-y-3">
              <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} />

              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {filteredUsers.map((u) => {
                    const checked = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUser(u.id)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-foreground overflow-hidden">
                          {u.profile_photo_url ? (
                            <img src={normalizeMediaUrl(u.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.name?.split(" ").map((n) => n[0]).join("").slice(0, 2)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded border flex items-center justify-center",
                            checked ? "bg-primary border-primary" : "bg-background border-border",
                          )}
                        >
                          {checked && <div className="h-2.5 w-2.5 rounded-sm bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BrandedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir jogo?"
        description="Esta ação é permanente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}


