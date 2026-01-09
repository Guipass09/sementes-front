import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ear, Save, Upload, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, AuditoryGameRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type ItemInput = { file: File | null; previewUrl: string | null; existingUrl?: string | null };

export default function AdminAuditoryGameEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [game, setGame] = useState<AuditoryGameRow | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgExisting, setBgExisting] = useState<string | null>(null);

  const [items, setItems] = useState<ItemInput[]>([]);
  const [itemsSides, setItemsSides] = useState<Array<"certo" | "errado" | null>>([]);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin") return navigate("/paciente");
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoadingGame(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGame(true);
      setNotFound(false);
      setForbidden(false);
      try {
        const g = await api.adminGetAuditoryGame(gameId);
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setSelectedUserIds((g.assigned_to ?? []).map((u) => u.id));
        setBgExisting(g.background_url ?? null);
        setBgPreview(g.background_url ?? null);

        const sorted = [...g.items].sort((a, b) => a.position - b.position);
        setItems(sorted.map((it) => ({ file: null, previewUrl: it.url, existingUrl: it.url })));
        setItemsSides(
          sorted.map((it) => (it.expected_side === "left" ? "errado" : it.expected_side === "right" ? "certo" : null)),
        );
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        }
        setGame(null);
      } finally {
        if (!cancelled) setLoadingGame(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const u = await api.adminListUsers();
        if (cancelled) return;
        setUsers(u.filter((x) => x.role === "user"));
      } catch {
        toast({
          title: "Erro ao carregar usuários",
          description: "Não foi possível carregar a lista de usuários.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (bgPreview && bgPreview !== bgExisting) URL.revokeObjectURL(bgPreview);
      items.forEach((it) => it.previewUrl && it.previewUrl !== it.existingUrl && URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setBackground = (file: File | null) => {
    if (bgPreview && bgPreview !== bgExisting) URL.revokeObjectURL(bgPreview);
    setBackgroundFile(file);
    setBgPreview(file ? URL.createObjectURL(file) : bgExisting);
  };

  const setItemFile = (idx: number, file: File | null) => {
    setItems((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      if (old.previewUrl && old.previewUrl !== old.existingUrl) URL.revokeObjectURL(old.previewUrl);
      copy[idx] = {
        file,
        previewUrl: file ? URL.createObjectURL(file) : old.existingUrl ?? null,
        existingUrl: old.existingUrl ?? null,
      };
      return copy;
    });
  };

  const setSide = (idx: number, side: "certo" | "errado") => {
    setItemsSides((prev) => {
      const copy = [...prev];
      copy[idx] = side;
      return copy;
    });
  };

  const missingImages = useMemo(
    () => !bgPreview || items.some((it) => !it.previewUrl && !it.existingUrl),
    [bgPreview, items],
  );
  const missingSides = useMemo(() => itemsSides.some((s) => !s), [itemsSides]);

  const allItemsAreNew = useMemo(() => items.length > 0 && items.every((it) => it.file), [items]);
  const someItemsChanged = useMemo(() => items.some((it) => it.file), [items]);

  const onSave = async () => {
    if (!gameId) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    if (missingImages) {
      toast({ title: "Imagens faltando", description: "Envie todas as imagens necessárias.", variant: "destructive" });
      return;
    }
    if (missingSides) {
      toast({
        title: "Defina certo/errado",
        description: "Selecione CERTO/ERRADO para todas as imagens do topo.",
        variant: "destructive",
      });
      return;
    }
    if (someItemsChanged && !allItemsAreNew) {
      toast({
        title: "Imagens do topo",
        description: "Para alterar, substitua TODAS as imagens do topo de uma vez.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof api.adminUpdateAuditoryGame>[1] = {
        title: title.trim(),
        description: description.trim(),
        assigned_to: selectedUserIds,
        items_sides: itemsSides.map((x) => x!) as Array<"certo" | "errado">,
      };
      if (backgroundFile) payload.background = backgroundFile;
      if (allItemsAreNew) payload.items = items.map((it) => it.file!).filter(Boolean);

      await api.adminUpdateAuditoryGame(gameId, payload);
      toast({ title: "Jogo atualizado", description: "Alterações salvas com sucesso." });
      navigate("/admin/jogos/auditivo");
    } catch (e) {
      const msg = isApiError(e) ? e.data?.message || "Erro ao salvar." : "Erro ao salvar.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const bgInputRef = useRef<HTMLInputElement | null>(null);

  if (loadingGame) {
    return (
      <div className="min-h-full py-8 lg:py-12">
        <div className="container mx-auto px-4">
          <Skeleton className="h-10 w-1/3 mb-6" />
          <Skeleton className="h-[70vh] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-full py-8 lg:py-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Jogo não encontrado</h1>
          <p className="text-muted-foreground mb-4">O jogo que você tentou editar não existe.</p>
          <Button onClick={() => navigate("/admin/jogos/auditivo")}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-full py-8 lg:py-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Acesso negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para editar este jogo.</p>
          <Button onClick={() => navigate("/admin/jogos/auditivo")}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-3">
          <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Ear className="h-4 w-4" />
                Editar: Estimulação Auditiva
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">{game?.title}</h1>
              <p className="text-muted-foreground">Atualize título/descrição, fundo, imagens do topo e usuários.</p>
            </div>

            <Button onClick={onSave} disabled={saving} className="shrink-0 bg-brand-blue hover:bg-brand-blue/90">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            <div className="space-y-2">
              <Label>Imagem de fundo</Label>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setBackground(e.target.files?.[0] ?? null)}
              />
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="aspect-[16/9] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                      {bgPreview ? (
                    <img src={normalizeMediaUrl(bgPreview)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem fundo</div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => bgInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Trocar fundo
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setBackground(null)} disabled={!backgroundFile}>
                    <X className="h-4 w-4 mr-2" />
                    Desfazer troca
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-foreground">Imagens do topo</div>
                <div className="text-sm text-muted-foreground">{items.length} imagens</div>
              </div>
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                      {it.previewUrl ? (
                        <img src={normalizeMediaUrl(it.previewUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-muted-foreground">Topo {idx + 1}</div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col items-center justify-center gap-2">
                      <div className="shrink-0 flex items-center justify-center">
                        <input
                          id={`aud-edit-item-${idx}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => setItemFile(idx, e.target.files?.[0] ?? null)}
                        />
                        <Button
                          asChild
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-24 px-2 text-xs inline-flex items-center justify-center whitespace-nowrap cursor-pointer"
                        >
                          <label htmlFor={`aud-edit-item-${idx}`}>{it.file ? "Trocar" : "Enviar"}</label>
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={itemsSides[idx] === "certo" ? "default" : "outline"}
                          onClick={() => setSide(idx, "certo")}
                          className={cn(
                            "w-20 px-2 text-xs inline-flex items-center justify-center whitespace-nowrap",
                            itemsSides[idx] === "certo" && "bg-brand-green hover:bg-brand-green/90",
                          )}
                        >
                          Certo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={itemsSides[idx] === "errado" ? "default" : "outline"}
                          onClick={() => setSide(idx, "errado")}
                          className={cn(
                            "w-20 px-2 text-xs inline-flex items-center justify-center whitespace-nowrap",
                            itemsSides[idx] === "errado" && "bg-red-600 hover:bg-red-600/90",
                          )}
                        >
                          Errado
                        </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItemFile(idx, null)}
                        disabled={!it.file}
                        aria-label="Remover"
                        className="shrink-0 h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {someItemsChanged && !allItemsAreNew && (
                <p className="text-sm text-orange-600 mt-2">
                  Para salvar a troca das imagens do topo, você precisa substituir todas de uma vez.
                </p>
              )}
            </div>
          </div>

          {/* Users */}
          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <UserIcon className="h-4 w-4" />
                  Enviar para usuários
                </div>
                <div className="text-sm text-muted-foreground">{selectedUserIds.length} selecionado(s)</div>
              </div>
            </div>

            <div className="space-y-3">
              <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} />

              {loadingUsers ? (
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
                          "w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors",
                          checked ? "border-brand-blue bg-brand-blue/10" : "border-border hover:bg-muted/30",
                        )}
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-semibold overflow-hidden">
                          {u.profile_photo_url ? (
                            <img src={normalizeMediaUrl(u.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <div className={cn("h-5 w-5 rounded border", checked ? "bg-brand-blue border-brand-blue" : "border-border")} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


