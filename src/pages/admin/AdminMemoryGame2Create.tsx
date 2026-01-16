import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Grid3X3, Plus, Upload, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type Pair2Input = {
  aFile: File | null;
  aPreviewUrl: string | null;
  bFile: File | null;
  bPreviewUrl: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminMemoryGame2Create() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pairsCount, setPairsCount] = useState(6);
  const [pairs, setPairs] = useState<Pair2Input[]>(() =>
    Array.from({ length: 6 }, () => ({ aFile: null, aPreviewUrl: null, bFile: null, bPreviewUrl: null })),
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
  }, []);

  useEffect(() => {
    setPairsCount((prev) => clamp(prev, 4, 15));
  }, []);

  useEffect(() => {
    setPairs((prev) => {
      const nextCount = clamp(pairsCount, 4, 15);
      const copy = [...prev];
      if (copy.length > nextCount) {
        for (let i = nextCount; i < copy.length; i++) {
          if (copy[i]?.aPreviewUrl) URL.revokeObjectURL(copy[i].aPreviewUrl!);
          if (copy[i]?.bPreviewUrl) URL.revokeObjectURL(copy[i].bPreviewUrl!);
        }
      }
      while (copy.length < nextCount) copy.push({ aFile: null, aPreviewUrl: null, bFile: null, bPreviewUrl: null });
      return copy.slice(0, nextCount);
    });
  }, [pairsCount]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const missingImages = useMemo(
    () => pairs.some((p) => !p.aFile || !p.bFile),
    [pairs],
  );

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setPairFile = (idx: number, which: "a" | "b", file: File | null) => {
    setPairs((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      const key = which === "a" ? "aPreviewUrl" : "bPreviewUrl";
      const oldUrl = old[key];
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const nextUrl = file ? URL.createObjectURL(file) : null;
      copy[idx] = {
        ...old,
        ...(which === "a" ? { aFile: file, aPreviewUrl: nextUrl } : { bFile: file, bPreviewUrl: nextUrl }),
      };
      return copy;
    });
  };

  const onSubmit = async () => {
    const finalPairsCount = clamp(pairsCount, 4, 15);
    if (!title.trim()) {
      toast({ title: "Informe um título", description: "O título do jogo é obrigatório.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Informe uma descrição", description: "A descrição do jogo é obrigatória.", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário para receber o jogo.", variant: "destructive" });
      return;
    }
    if (missingImages) {
      toast({ title: "Faltam imagens", description: "Envie 2 imagens para cada par.", variant: "destructive" });
      return;
    }

    const flattened: File[] = [];
    for (const p of pairs.slice(0, finalPairsCount)) {
      if (p.aFile) flattened.push(p.aFile);
      if (p.bFile) flattened.push(p.bFile);
    }
    if (flattened.length !== finalPairsCount * 2) {
      toast({ title: "Imagens incompletas", description: "Envie 2 imagens para cada par.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const created = await api.adminCreateMemoryGame({
        title: title.trim(),
        description: description.trim(),
        pairs_count: finalPairsCount,
        variant: "v2",
        assigned_to: selectedUserIds,
        pair_images: flattened,
      });

      toast({ title: "Jogo criado!", description: `“${created.title}” foi enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(`/jogos/memoria2/${created.id}`);
    } catch {
      toast({ title: "Não foi possível criar", description: "Verifique os campos e tente novamente.", variant: "destructive" });
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
                <Grid3X3 className="h-4 w-4" />
                Novo recurso: Jogo da Memória 2.0
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">
                Defina os pares manualmente: envie <b>2 imagens</b> para cada par (máximo 15 pares).
              </p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Criar e enviar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Título do jogo</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Memória do Mar 2.0" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explique a atividade de forma simples e amigável."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pairsCount">Quantidade de pares (4 a 15)</Label>
                <Input
                  id="pairsCount"
                  type="number"
                  min={4}
                  max={15}
                  value={pairsCount}
                  onChange={(e) => setPairsCount(clamp(Number(e.target.value || 0), 4, 15))}
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-foreground">Imagens (2 por par)</div>
                  <div className="text-sm text-muted-foreground">{pairs.length} pares</div>
                </div>

                <div className="space-y-3">
                  {pairs.map((p, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground mb-2">Par {idx + 1}</div>
                      <div className="grid grid-cols-2 gap-3">
                        {(["a", "b"] as const).map((which) => {
                          const previewUrl = which === "a" ? p.aPreviewUrl : p.bPreviewUrl;
                          const file = which === "a" ? p.aFile : p.bFile;
                          const inputId = `pair-${idx}-${which}`;
                          return (
                            <div key={which} className="rounded-xl border border-border bg-card p-3">
                              <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                                {previewUrl ? (
                                  <img src={previewUrl} alt={`Par ${idx + 1}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-center text-muted-foreground">
                                    <Upload className="h-6 w-6 mx-auto mb-1" />
                                    <div className="text-xs">Imagem {which === "a" ? "A" : "B"}</div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1">
                                  <input
                                    id={inputId}
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => setPairFile(idx, which, e.target.files?.[0] ?? null)}
                                  />
                                  <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                                    <label htmlFor={inputId}>{file ? "Trocar" : "Enviar"}</label>
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPairFile(idx, which, null)}
                                  disabled={!file}
                                  aria-label="Remover"
                                >
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

