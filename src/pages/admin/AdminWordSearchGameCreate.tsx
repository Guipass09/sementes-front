import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type { AdminUserRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type WordInput = {
  word: string;
  imageFile: File | null;
  imagePreview: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminWordSearchGameCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wordsCount, setWordsCount] = useState(5);
  const [background, setBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  const [words, setWords] = useState<WordInput[]>(() =>
    Array.from({ length: 5 }, () => ({
      word: "",
      imageFile: null,
      imagePreview: null,
    })),
  );

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin") return navigate("/paciente");
  }, [auth.loading, auth.user, navigate]);

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
          title: "Não foi possível carregar usuários",
          description: "Verifique sua conexão e tente novamente.",
          variant: "destructive",
        });
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    setWordsCount((prev) => clamp(prev, 1, 9));
  }, []);

  useEffect(() => {
    setWords((prev) => {
      const nextCount = clamp(wordsCount, 1, 9);
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
    if (!background) return true;
    if (selectedUserIds.length === 0) return true;
    return words.some((w) => !w.word.trim() || !w.imageFile);
  }, [title, description, background, selectedUserIds.length, words]);

  const onSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!background) {
      toast({ title: "Escolha a imagem de fundo", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    const n = clamp(wordsCount, 1, 9);
    const slice = words.slice(0, n);
    if (slice.some((w) => !w.word.trim() || !w.imageFile)) {
      toast({ title: "Palavras incompletas", description: "Preencha palavra e envie imagem em todas as palavras.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const created = await api.adminCreateWordSearchGame({
        title: title.trim(),
        description: description.trim(),
        words_count: n,
        assigned_to: selectedUserIds,
        background,
        words: slice.map((w) => w.word.trim()),
        images: slice.map((w) => w.imageFile!),
      });
      toast({ title: "Jogo criado!", description: `"${created.title}" enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(`/jogos/caca-palavras/${created.id}`);
    } catch (err: any) {
      const apiMessage = err?.data?.message || err?.data?.error || err?.message;
      console.error("Erro ao criar Caça-palavras:", err);
      toast({
        title: "Não foi possível criar",
        description: apiMessage || "Verifique os campos e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
                Novo jogo: Caça-palavras
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">
                Grid com palavras escondidas (vertical ou horizontal) e imagens correspondentes. O usuário encontra a palavra clicando nas letras e depois seleciona a imagem correta.
              </p>
            </div>

            <Button onClick={onSubmit} disabled={saving || missing} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Criar e enviar"}
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
                <Label>Imagem de fundo (grande, igual estimulação auditiva)</Label>
                <input
                  id="ws-bg"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
                />
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="aspect-[16/9] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                    {bgPreview ? (
                      <img src={bgPreview} alt="Fundo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-7 w-7 mx-auto mb-1" />
                        <div className="text-sm">Selecione o fundo</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button asChild type="button" variant="secondary">
                      <label htmlFor="ws-bg" className="cursor-pointer inline-flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        {background ? "Trocar fundo" : "Enviar fundo"}
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
                              {w.imagePreview ? (
                                <img src={w.imagePreview} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center text-muted-foreground">
                                  <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                                  <div className="text-xs">Enviar</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                id={`ws-img-${idx}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => setWordImage(idx, e.target.files?.[0] ?? null)}
                              />
                              <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                                <label htmlFor={`ws-img-${idx}`}>{w.imageFile ? "Trocar" : "Enviar"}</label>
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setWordImage(idx, null)} disabled={!w.imageFile}>
                                <X className="h-4 w-4" />
                              </Button>
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

              <div className="pt-2">
                <Button type="button" variant="secondary" disabled={missing} className="w-full" onClick={onSubmit}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar e enviar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
