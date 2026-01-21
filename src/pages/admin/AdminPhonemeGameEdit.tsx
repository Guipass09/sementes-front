import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, Save, Upload, X, Image as ImageIcon, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, PhonemeGameRow, ProfessionalUserRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type SessionInput = {
  word: string;
  correctSide: "left" | "right";
  leftFile: File | null;
  leftPreview: string | null;
  leftExisting?: string | null;
  rightFile: File | null;
  rightPreview: string | null;
  rightExisting?: string | null;
};

function speakWord(text: string) {
  try {
    if (typeof window === "undefined") return;
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = 1;
    s.speak(u);
  } catch {}
}

export default function AdminPhonemeGameEdit() {
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

  const [game, setGame] = useState<PhonemeGameRow | null>(null);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgExisting, setBgExisting] = useState<string | null>(null);

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
        const g = await (isProfessional ? api.professionalGetPhonemeGame(gameId) : api.adminGetPhonemeGame(gameId));
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setSelectedUserIds((g.assigned_to ?? []).map((u) => u.id));
        setBgExisting(g.background_url ?? null);
        setBgPreview(g.background_url ?? null);

        const sorted = [...(g.items || [])].sort((a, b) => a.position - b.position);
        setSessions(
          sorted.map((it) => ({
            word: it.word,
            correctSide: it.correct_side,
            leftFile: null,
            leftPreview: it.left_url,
            leftExisting: it.left_url,
            rightFile: null,
            rightPreview: it.right_url,
            rightExisting: it.right_url,
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
      if (bgPreview && bgPreview !== bgExisting) URL.revokeObjectURL(bgPreview);
      sessions.forEach((s) => {
        if (s.leftPreview && s.leftPreview !== s.leftExisting) URL.revokeObjectURL(s.leftPreview);
        if (s.rightPreview && s.rightPreview !== s.rightExisting) URL.revokeObjectURL(s.rightPreview);
      });
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

  const setSession = (idx: number, patch: Partial<SessionInput>) => {
    setSessions((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      copy[idx] = { ...old, ...patch };
      return copy;
    });
  };

  const setSessionImage = (idx: number, which: "left" | "right", file: File | null) => {
    setSessions((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      const keyPreview = which === "left" ? "leftPreview" : "rightPreview";
      const keyExisting = which === "left" ? "leftExisting" : "rightExisting";
      const keyFile = which === "left" ? "leftFile" : "rightFile";
      const oldUrl = old[keyPreview];
      if (oldUrl && oldUrl !== old[keyExisting]) URL.revokeObjectURL(oldUrl);
      copy[idx] = {
        ...old,
        [keyFile]: file,
        [keyPreview]: file ? URL.createObjectURL(file) : (old[keyExisting] ?? null),
      } as any;
      return copy;
    });
  };

  const anyItemsChanged = useMemo(() => sessions.some((s) => s.leftFile || s.rightFile), [sessions]);
  const allItemsAreNew = useMemo(() => sessions.length > 0 && sessions.every((s) => !!s.leftFile && !!s.rightFile), [sessions]);

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
    if (sessions.some((s) => !s.word.trim())) {
      toast({ title: "Palavras faltando", description: "Preencha a palavra em todas as sessões.", variant: "destructive" });
      return;
    }
    if (anyItemsChanged && !allItemsAreNew) {
      toast({
        title: "Imagens das sessões",
        description: "Para alterar as imagens, substitua TODAS as imagens (esquerda e direita) de todas as sessões de uma vez.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof api.adminUpdatePhonemeGame>[1] = {
        title: title.trim(),
        description: description.trim(),
        assigned_to: selectedUserIds,
        words: sessions.map((s) => s.word.trim()),
        correct_sides: sessions.map((s) => s.correctSide),
      };
      if (backgroundFile) payload.background = backgroundFile;
      if (allItemsAreNew) {
        payload.left_images = sessions.map((s) => s.leftFile!) as File[];
        payload.right_images = sessions.map((s) => s.rightFile!) as File[];
      }

      const updated = await (isProfessional ? api.professionalUpdatePhonemeGame(gameId, payload as any) : api.adminUpdatePhonemeGame(gameId, payload));
      setGame(updated);
      toast({ title: "Jogo atualizado!" });
      navigate(`${base}/jogos/fonema`);
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
          <Button onClick={onSave} disabled={saving || loadingGame}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground inline-flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-brand-purple" />
            Editar Discriminação Fonema
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

                <div className="space-y-2">
                  <Label>Fundo (opcional)</Label>
                  <input
                    id="ph-bg-edit"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setBackground(e.target.files?.[0] ?? null)}
                  />
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="aspect-[16/9] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                      {bgPreview ? (
                        <img src={bgPreview} alt="Fundo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <ImageIcon className="h-7 w-7 mx-auto mb-1" />
                          <div className="text-sm">Sem fundo</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild type="button" variant="secondary">
                        <label htmlFor="ph-bg-edit" className="cursor-pointer inline-flex items-center">
                          <Upload className="h-4 w-4 mr-2" />
                          Trocar fundo
                        </label>
                      </Button>
                      {backgroundFile && (
                        <Button type="button" variant="ghost" onClick={() => setBackground(null)}>
                          <X className="h-4 w-4 mr-2" />
                          Cancelar troca
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="font-semibold text-foreground">Sessões ({sessions.length})</div>
                  <div className="text-sm text-muted-foreground">
                    Para substituir imagens, você precisa reenviar todas as imagens (esquerda e direita) de todas as sessões.
                  </div>

                  <div className="space-y-3">
                    {sessions.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-background/50 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="text-sm font-semibold text-foreground">Sessão {idx + 1}</div>
                          <Button type="button" variant="outline" size="sm" onClick={() => speakWord(s.word)} className="rounded-full">
                            <Volume2 className="h-4 w-4 mr-2" />
                            Ouvir
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Palavra</Label>
                            <Input value={s.word} onChange={(e) => setSession(idx, { word: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Correta</Label>
                            <div className="flex gap-2">
                              <Button type="button" variant={s.correctSide === "left" ? "default" : "secondary"} onClick={() => setSession(idx, { correctSide: "left" })}>
                                Esquerda
                              </Button>
                              <Button type="button" variant={s.correctSide === "right" ? "default" : "secondary"} onClick={() => setSession(idx, { correctSide: "right" })}>
                                Direita
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(["left", "right"] as const).map((side) => {
                            const preview = side === "left" ? s.leftPreview : s.rightPreview;
                            const file = side === "left" ? s.leftFile : s.rightFile;
                            const inputId = `ph-edit-${idx}-${side}`;
                            return (
                              <div key={side} className="rounded-xl border border-border bg-card p-3">
                                <div className="text-xs text-muted-foreground mb-2">
                                  {side === "left" ? "Esquerda" : "Direita"}
                                  {s.correctSide === side ? " • CORRETA" : ""}
                                </div>
                                <div className={cn("aspect-[4/3] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center", s.correctSide === side ? "ring-2 ring-brand-green/60" : "")}>
                                  {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : null}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <input
                                    id={inputId}
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => setSessionImage(idx, side, e.target.files?.[0] ?? null)}
                                  />
                                  <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                                    <label htmlFor={inputId}>{file ? "Trocar" : "Selecionar"}</label>
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => setSessionImage(idx, side, null)} disabled={!file}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
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
                        checked ? "border-brand-green bg-brand-green/10" : "border-border hover:bg-muted/30",
                      )}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold overflow-hidden">
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
                      <div className={cn("h-5 w-5 rounded border", checked ? "bg-brand-green border-brand-green" : "border-border")} />
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

