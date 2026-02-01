import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, GuessImageGameRow, ProfessionalUserRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type SessionInput = {
  mainFile: File | null;
  mainPreview: string | null;
  mainExisting?: string | null;
  correctFile: File | null;
  correctPreview: string | null;
  correctExisting?: string | null;
  wrongFile: File | null;
  wrongPreview: string | null;
  wrongExisting?: string | null;
};

export default function AdminGuessImageGameEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [game, setGame] = useState<GuessImageGameRow | null>(null);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const [sessions, setSessions] = useState<SessionInput[]>([]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin" && auth.user.role !== "professional") return navigate("/paciente");
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
        const g = await (isProfessional ? api.professionalGetGuessImageGame(gameId) : api.adminGetGuessImageGame(gameId));
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setSelectedUserIds((g.assigned_to ?? []).map((u) => u.id));

        const sorted = [...(g.items || [])].sort((a, b) => a.position - b.position);
        setSessions(
          sorted.map((it) => ({
            mainFile: null,
            mainPreview: it.main_url,
            mainExisting: it.main_url,
            correctFile: null,
            correctPreview: it.correct_url,
            correctExisting: it.correct_url,
            wrongFile: null,
            wrongPreview: it.wrong_url,
            wrongExisting: it.wrong_url,
          })),
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
        const u = isProfessional ? await api.professionalListUsers() : await api.adminListUsers();
        if (cancelled) return;
        if (isProfessional) setUsers((u as any).data ?? []);
        else setUsers((u as any).filter((x: any) => x.role === "user"));
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
      sessions.forEach((s) => {
        if (s.mainPreview && s.mainPreview !== s.mainExisting) URL.revokeObjectURL(s.mainPreview);
        if (s.correctPreview && s.correctPreview !== s.correctExisting) URL.revokeObjectURL(s.correctPreview);
        if (s.wrongPreview && s.wrongPreview !== s.wrongExisting) URL.revokeObjectURL(s.wrongPreview);
      });
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setSessionImage = (idx: number, which: "main" | "correct" | "wrong", file: File | null) => {
    setSessions((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      const keyPreview = `${which}Preview` as keyof SessionInput;
      const keyExisting = `${which}Existing` as keyof SessionInput;
      const keyFile = `${which}File` as keyof SessionInput;
      const oldUrl = old[keyPreview];
      if (oldUrl && oldUrl !== old[keyExisting]) URL.revokeObjectURL(oldUrl as string);
      copy[idx] = {
        ...old,
        [keyFile]: file,
        [keyPreview]: file ? URL.createObjectURL(file) : (old[keyExisting] ?? null),
      } as any;
      return copy;
    });
  };

  const anyImagesChanged = useMemo(() => sessions.some((s) => s.mainFile || s.correctFile || s.wrongFile), [sessions]);
  const allImagesAreNew = useMemo(() => sessions.length > 0 && sessions.every((s) => !!s.mainFile && !!s.correctFile && !!s.wrongFile), [sessions]);

  const onSave = async () => {
    if (!gameId || !game) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    if (anyImagesChanged && !allImagesAreNew) {
      toast({
        title: "Imagens das sessões",
        description: "Para alterar as imagens, substitua TODAS as imagens (principal, correta e errada) de todas as sessões de uma vez.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof api.adminUpdateGuessImageGame>[1] = {
        title: title.trim(),
        description: description.trim(),
        assigned_to: selectedUserIds,
      };
      if (allImagesAreNew) {
        payload.main_images = sessions.map((s) => s.mainFile!) as File[];
        payload.correct_images = sessions.map((s) => s.correctFile!) as File[];
        payload.wrong_images = sessions.map((s) => s.wrongFile!) as File[];
      }

      const updated = await (isProfessional ? api.professionalUpdateGuessImageGame(gameId, payload as any) : api.adminUpdateGuessImageGame(gameId, payload));
      setGame(updated);
      toast({ title: "Jogo atualizado!" });
      navigate(`${base}/jogos/acerte-imagem`);
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Não foi possível salvar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-full py-10">
        <div className="container mx-auto px-4 text-muted-foreground">Jogo não encontrado.</div>
      </div>
    );
  }
  if (forbidden) {
    return (
      <div className="min-h-full py-10">
        <div className="container mx-auto px-4 text-muted-foreground">Acesso negado.</div>
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={onSave} disabled={saving || loadingGame} className="bg-brand-pink hover:bg-brand-pink/90">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground inline-flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-brand-pink" />
            Editar Acerte a Imagem
          </h1>
          {game && <p className="text-muted-foreground">Sessões: {game.sessions_count} • ID: {game.id}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            {loadingGame ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-28 w-full" />
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

                <div className="pt-2 space-y-3">
                  <div className="font-semibold text-foreground">Sessões ({sessions.length})</div>
                  <div className="text-sm text-muted-foreground">
                    Para substituir imagens, você precisa reenviar todas as imagens (principal, correta e errada) de todas as sessões.
                  </div>

                  <div className="space-y-4">
                    {sessions.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-background/50 p-4">
                        <div className="text-sm font-semibold text-foreground mb-3">Sessão {idx + 1}</div>

                        {/* Imagem principal (grande) */}
                        <div className="mb-4">
                          <Label className="text-xs text-muted-foreground mb-2 block">Imagem Principal</Label>
                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="aspect-video rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                              {s.mainPreview ? (
                                <img src={normalizeMediaUrl(s.mainPreview)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center text-muted-foreground">
                                  <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                                  <div className="text-sm">Sem imagem</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                id={`main-edit-${idx}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => setSessionImage(idx, "main", e.target.files?.[0] ?? null)}
                              />
                              <Button asChild type="button" variant="secondary" className="flex-1 cursor-pointer">
                                <label htmlFor={`main-edit-${idx}`}>{s.mainFile ? "Trocar" : "Selecionar"}</label>
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setSessionImage(idx, "main", null)} disabled={!s.mainFile}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Opções (pequenas) */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Imagem Correta */}
                          <div className="rounded-xl border-2 border-green-500/50 bg-green-500/5 p-3">
                            <div className="text-xs text-green-600 font-medium mb-2">Opção CORRETA</div>
                            <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                              {s.correctPreview ? (
                                <img src={normalizeMediaUrl(s.correctPreview)} alt="" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                id={`correct-edit-${idx}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => setSessionImage(idx, "correct", e.target.files?.[0] ?? null)}
                              />
                              <Button asChild type="button" variant="secondary" size="sm" className="flex-1 cursor-pointer">
                                <label htmlFor={`correct-edit-${idx}`}>{s.correctFile ? "Trocar" : "Selecionar"}</label>
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setSessionImage(idx, "correct", null)} disabled={!s.correctFile}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Imagem Errada */}
                          <div className="rounded-xl border-2 border-red-500/50 bg-red-500/5 p-3">
                            <div className="text-xs text-red-600 font-medium mb-2">Opção ERRADA</div>
                            <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                              {s.wrongPreview ? (
                                <img src={normalizeMediaUrl(s.wrongPreview)} alt="" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                id={`wrong-edit-${idx}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => setSessionImage(idx, "wrong", e.target.files?.[0] ?? null)}
                              />
                              <Button asChild type="button" variant="secondary" size="sm" className="flex-1 cursor-pointer">
                                <label htmlFor={`wrong-edit-${idx}`}>{s.wrongFile ? "Trocar" : "Selecionar"}</label>
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setSessionImage(idx, "wrong", null)} disabled={!s.wrongFile}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="font-semibold text-foreground mb-2">Usuários</div>
            <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {loadingUsers ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : (
                filteredUsers.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={cn(
                        "w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-colors",
                        checked ? "border-brand-pink bg-brand-pink/10" : "border-border hover:bg-muted/30",
                      )}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-pink to-brand-pink/80 flex items-center justify-center text-white font-semibold overflow-hidden">
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
                      <div className={cn("h-5 w-5 rounded border", checked ? "bg-brand-pink border-brand-pink" : "border-border")} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
