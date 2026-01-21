import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, Image as ImageIcon, Plus, Upload, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";
import * as api from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import type { AdminUserRow, ProfessionalUserRow, WordSearchGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type WordInput = {
  word: string;
  imageFile: File | null;
  imagePreview: string | null;
  existingImageUrl?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminWordSearchGameEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional/jogos" : "/admin/jogos";

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [game, setGame] = useState<WordSearchGameRow | null>(null);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wordsCount, setWordsCount] = useState(5);
  const [background, setBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgExistingUrl, setBgExistingUrl] = useState<string | null>(null);

  const [words, setWords] = useState<WordInput[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin" && auth.user.role !== "professional") return navigate("/paciente");
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!gameId) {
      navigate(base);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const g = await (isProfessional ? api.professionalGetWordSearchGame : api.adminGetWordSearchGame)(gameId);
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setWordsCount(g.words_count);
        setBgExistingUrl(g.background_url);
        setSelectedUserIds(g.assigned_to?.map((u) => u.id) ?? []);

        const wordsData: WordInput[] = (g.items || []).map((item) => ({
          word: item.word,
          imageFile: null,
          imagePreview: null,
          existingImageUrl: item.image_url,
        }));
        setWords(wordsData.length > 0 ? wordsData : Array.from({ length: g.words_count }, () => ({ word: "", imageFile: null, imagePreview: null })));
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e) && e.status === 404) {
          toast({ title: "Jogo não encontrado", variant: "destructive" });
          navigate(base);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, navigate, toast, base, isProfessional]);

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
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isProfessional]);

  useEffect(() => {
    setWordsCount((prev) => clamp(prev, 1, 9));
  }, []);

  useEffect(() => {
    setWords((prev) => {
      const nextCount = clamp(wordsCount, 1, 9);
      if (prev.length === nextCount) return prev;
      const copy = [...prev];
      if (copy.length > nextCount) {
        for (let i = nextCount; i < copy.length; i++) {
          if (copy[i]?.imagePreview) URL.revokeObjectURL(copy[i].imagePreview!);
        }
      }
      while (copy.length < nextCount) {
        copy.push({
          word: "",
          imageFile: null,
          imagePreview: null,
        });
      }
      return copy.slice(0, nextCount);
    });
  }, [wordsCount]);

  useEffect(() => {
    return () => {
      if (bgPreview) URL.revokeObjectURL(bgPreview);
      words.forEach((w) => {
        if (w.imagePreview) URL.revokeObjectURL(w.imagePreview);
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

  const setBackgroundFile = (file: File | null) => {
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBackground(file);
    setBgPreview(file ? URL.createObjectURL(file) : null);
  };

  const setWordField = (idx: number, patch: Partial<WordInput>) => {
    setWords((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      copy[idx] = { ...old, ...patch };
      return copy;
    });
  };

  const setWordImage = (idx: number, file: File | null) => {
    setWords((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      const oldUrl = old.imagePreview;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const nextUrl = file ? URL.createObjectURL(file) : null;
      copy[idx] = { ...old, imageFile: file, imagePreview: nextUrl };
      return copy;
    });
  };

  const missing = useMemo(() => {
    if (!title.trim() || !description.trim()) return true;
    if (!background && !bgExistingUrl) return true;
    if (selectedUserIds.length === 0) return true;
    return words.some((w) => !w.word.trim() || (!w.imageFile && !w.existingImageUrl));
  }, [title, description, background, bgExistingUrl, selectedUserIds.length, words]);

  const onSubmit = async () => {
    if (!gameId) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!background && !bgExistingUrl) {
      toast({ title: "Escolha a imagem de fundo", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    const n = clamp(wordsCount, 1, 9);
    const slice = words.slice(0, n);
    if (slice.some((w) => !w.word.trim() || (!w.imageFile && !w.existingImageUrl))) {
      toast({ title: "Palavras incompletas", description: "Preencha palavra e envie imagem em todas as palavras.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updated = await (isProfessional ? api.professionalUpdateWordSearchGame : api.adminUpdateWordSearchGame)(gameId, {
        title: title.trim(),
        description: description.trim(),
        assigned_to: selectedUserIds,
        background: background || undefined,
        words: slice.map((w) => w.word.trim()),
        images: slice.map((w) => w.imageFile).filter((f): f is File => f !== null),
      });
      toast({ title: "Jogo atualizado!", description: `"${updated.title}" atualizado com sucesso.` });
      navigate(`${base}/caca-palavras`);
    } catch (err: any) {
      const apiMessage = err?.data?.message || err?.data?.error || err?.message;
      console.error("Erro ao atualizar Caça-palavras:", err);
      toast({
        title: "Não foi possível atualizar",
        description: apiMessage || "Verifique os campos e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full py-8 lg:py-12">
        <div className="container mx-auto px-4">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!game) {
    return null;
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
                <Gamepad2 className="h-4 w-4" />
                Editar jogo: Caça-palavras
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Editar Jogo</h1>
            </div>

            <Button onClick={onSubmit} disabled={saving || missing} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Caça-palavras - Animais" />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>

              <div className="space-y-2">
                <Label>Imagem de fundo</Label>
                <input
                  id="ws-bg-edit"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
                />
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="aspect-[16/9] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                    {bgPreview || bgExistingUrl ? (
                      <img src={bgPreview || normalizeMediaUrl(bgExistingUrl!)} alt="Fundo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-7 w-7 mx-auto mb-1" />
                        <div className="text-sm">Selecione o fundo</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button asChild type="button" variant="secondary">
                      <label htmlFor="ws-bg-edit" className="cursor-pointer inline-flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        {background || bgExistingUrl ? "Trocar fundo" : "Enviar fundo"}
                      </label>
                    </Button>
                    {background && (
                      <Button type="button" variant="ghost" onClick={() => setBackgroundFile(null)}>
                        <X className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantidade de palavras (1 a 9)</Label>
                <Input
                  type="number"
                  min={1}
                  max={9}
                  value={wordsCount}
                  onChange={(e) => setWordsCount(clamp(Number(e.target.value || 1), 1, 9))}
                />
                <p className="text-xs text-muted-foreground">Ao alterar, será necessário re-enviar todas as imagens</p>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground">Palavras</div>
                  <div className="text-sm text-muted-foreground">{words.length} palavra(s)</div>
                </div>

                <div className="space-y-3">
                  {words.map((w, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-4">
                      <div className="text-sm font-semibold text-foreground mb-3">Palavra {idx + 1}</div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Palavra</Label>
                          <Input
                            value={w.word}
                            onChange={(e) => setWordField(idx, { word: e.target.value })}
                            placeholder="Ex: BOLA"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Imagem correspondente</Label>
                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="aspect-[4/3] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                              {w.imagePreview || w.existingImageUrl ? (
                                <img src={w.imagePreview || normalizeMediaUrl(w.existingImageUrl!)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center text-muted-foreground">
                                  <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                                  <div className="text-xs">Enviar</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                id={`ws-img-edit-${idx}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => setWordImage(idx, e.target.files?.[0] ?? null)}
                              />
                              <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                                <label htmlFor={`ws-img-edit-${idx}`}>{w.imageFile || w.existingImageUrl ? "Trocar" : "Enviar"}</label>
                              </Button>
                              {w.imageFile && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => setWordImage(idx, null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

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
