import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Plus, Upload, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, ProfessionalUserRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type SessionInput = {
  mainFile: File | null;
  mainPreview: string | null;
  correctFile: File | null;
  correctPreview: string | null;
  wrongFile: File | null;
  wrongPreview: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminGuessImageGameCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionsCount, setSessionsCount] = useState(3);

  const [sessions, setSessions] = useState<SessionInput[]>(() =>
    Array.from({ length: 3 }, () => ({
      mainFile: null,
      mainPreview: null,
      correctFile: null,
      correctPreview: null,
      wrongFile: null,
      wrongPreview: null,
    })),
  );

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin" && auth.user.role !== "professional") return navigate("/paciente");
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const u = auth.user?.role === "professional" ? await api.professionalListUsers() : await api.adminListUsers();
        if (cancelled) return;
        if (auth.user?.role === "professional") {
          setUsers((u as any).data ?? []);
        } else {
          setUsers((u as any).filter((x: any) => x.role === "user"));
        }
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
    setSessionsCount((prev) => clamp(prev, 1, 15));
  }, []);

  useEffect(() => {
    setSessions((prev) => {
      const nextCount = clamp(sessionsCount, 1, 15);
      const copy = [...prev];
      if (copy.length > nextCount) {
        for (let i = nextCount; i < copy.length; i++) {
          if (copy[i]?.mainPreview) URL.revokeObjectURL(copy[i].mainPreview!);
          if (copy[i]?.correctPreview) URL.revokeObjectURL(copy[i].correctPreview!);
          if (copy[i]?.wrongPreview) URL.revokeObjectURL(copy[i].wrongPreview!);
        }
      }
      while (copy.length < nextCount) {
        copy.push({
          mainFile: null,
          mainPreview: null,
          correctFile: null,
          correctPreview: null,
          wrongFile: null,
          wrongPreview: null,
        });
      }
      return copy.slice(0, nextCount);
    });
  }, [sessionsCount]);

  useEffect(() => {
    return () => {
      sessions.forEach((s) => {
        if (s.mainPreview) URL.revokeObjectURL(s.mainPreview);
        if (s.correctPreview) URL.revokeObjectURL(s.correctPreview);
        if (s.wrongPreview) URL.revokeObjectURL(s.wrongPreview);
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
      const keyFile = `${which}File` as keyof SessionInput;
      const oldUrl = old[keyPreview];
      if (oldUrl) URL.revokeObjectURL(oldUrl as string);
      const nextUrl = file ? URL.createObjectURL(file) : null;
      copy[idx] = { ...old, [keyFile]: file, [keyPreview]: nextUrl } as any;
      return copy;
    });
  };

  const missing = useMemo(() => {
    if (!title.trim() || !description.trim()) return true;
    if (selectedUserIds.length === 0) return true;
    return sessions.some((s) => !s.mainFile || !s.correctFile || !s.wrongFile);
  }, [title, description, selectedUserIds.length, sessions]);

  const onSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    const n = clamp(sessionsCount, 1, 15);
    const slice = sessions.slice(0, n);
    if (slice.some((s) => !s.mainFile || !s.correctFile || !s.wrongFile)) {
      toast({ title: "Sessões incompletas", description: "Envie as 3 imagens em todas as sessões.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const created = await (isProfessional ? api.professionalCreateGuessImageGame : api.adminCreateGuessImageGame)({
        title: title.trim(),
        description: description.trim(),
        sessions_count: n,
        assigned_to: selectedUserIds,
        main_images: slice.map((s) => s.mainFile!),
        correct_images: slice.map((s) => s.correctFile!),
        wrong_images: slice.map((s) => s.wrongFile!),
      });
      toast({ title: "Jogo criado!", description: `"${created.title}" enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(`/jogos/acerte-imagem/${created.id}`);
    } catch (err: any) {
      const apiMessage = err?.data?.message || err?.data?.error || err?.message;
      console.error("Erro ao criar Acerte a Imagem:", err);
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
                <ImageIcon className="h-4 w-4" />
                Novo jogo: Acerte a Imagem
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">
                Imagem grande que vai sendo revelada + 2 opções para escolher (certa/errada).
              </p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0 bg-brand-pink hover:bg-brand-pink/90">
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
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Acerte o animal" />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o objetivo do jogo..." />
              </div>

              <div className="space-y-2">
                <Label>Quantidade de sessões (1 a 15)</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={sessionsCount}
                  onChange={(e) => setSessionsCount(clamp(Number(e.target.value || 1), 1, 15))}
                />
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground">Sessões</div>
                  <div className="text-sm text-muted-foreground">{sessions.length} sessão(ões)</div>
                </div>

                <div className="space-y-4">
                  {sessions.map((s, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-4">
                      <div className="text-sm font-semibold text-foreground mb-3">Sessão {idx + 1}</div>

                      {/* Imagem principal (grande) */}
                      <div className="mb-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Imagem Principal (será revelada aos poucos)</Label>
                        <div className="rounded-xl border border-border bg-card p-3">
                          <div className="aspect-video rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                            {s.mainPreview ? (
                              <img src={s.mainPreview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <Upload className="h-8 w-8 mx-auto mb-1" />
                                <div className="text-sm">Imagem grande</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              id={`main-${idx}`}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => setSessionImage(idx, "main", e.target.files?.[0] ?? null)}
                            />
                            <Button asChild type="button" variant="secondary" className="flex-1 cursor-pointer">
                              <label htmlFor={`main-${idx}`}>{s.mainFile ? "Trocar" : "Enviar"}</label>
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
                              <img src={s.correctPreview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <Upload className="h-6 w-6 mx-auto mb-1" />
                                <div className="text-xs">Certa</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              id={`correct-${idx}`}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => setSessionImage(idx, "correct", e.target.files?.[0] ?? null)}
                            />
                            <Button asChild type="button" variant="secondary" size="sm" className="flex-1 cursor-pointer">
                              <label htmlFor={`correct-${idx}`}>{s.correctFile ? "Trocar" : "Enviar"}</label>
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
                              <img src={s.wrongPreview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <Upload className="h-6 w-6 mx-auto mb-1" />
                                <div className="text-xs">Errada</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              id={`wrong-${idx}`}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => setSessionImage(idx, "wrong", e.target.files?.[0] ?? null)}
                            />
                            <Button asChild type="button" variant="secondary" size="sm" className="flex-1 cursor-pointer">
                              <label htmlFor={`wrong-${idx}`}>{s.wrongFile ? "Trocar" : "Enviar"}</label>
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
