import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ear, Image as ImageIcon, Plus, Upload, X, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export default function AdminAuditoryStimulationCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemsCount, setItemsCount] = useState<4 | 6 | 10>(4);
  const [background, setBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ file: File | null; previewUrl: string | null; rule: "certo" | "errado" | null }>>(
    () => Array.from({ length: 4 }, () => ({ file: null, previewUrl: null, rule: null })),
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
    setItems((prev) => {
      const copy = [...prev];
      if (copy.length > itemsCount) {
        for (let i = itemsCount; i < copy.length; i++) {
          if (copy[i]?.previewUrl) URL.revokeObjectURL(copy[i].previewUrl!);
        }
      }
      while (copy.length < itemsCount) copy.push({ file: null, previewUrl: null, rule: null });
      return copy.slice(0, itemsCount);
    });
  }, [itemsCount]);

  useEffect(() => {
    return () => {
      if (bgPreview) URL.revokeObjectURL(bgPreview);
      items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
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

  const setItemFile = (idx: number, file: File | null) => {
    setItems((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
      copy[idx] = { ...old, file, previewUrl: file ? URL.createObjectURL(file) : null };
      return copy;
    });
  };

  const setItemRule = (idx: number, rule: "certo" | "errado") => {
    setItems((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      copy[idx] = { ...old, rule };
      return copy;
    });
  };

  const setBackgroundFile = (file: File | null) => {
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBackground(file);
    setBgPreview(file ? URL.createObjectURL(file) : null);
  };

  const missingTopImages = useMemo(() => items.some((it) => !it.file), [items]);
  const missingRules = useMemo(() => items.some((it) => !it.rule), [items]);

  const onSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!background) {
      toast({ title: "Escolha a imagem de fundo", variant: "destructive" });
      return;
    }
    if (missingTopImages) {
      toast({ title: "Faltam imagens do topo", description: "Envie todas as imagens pequenas.", variant: "destructive" });
      return;
    }
    if (missingRules) {
      toast({
        title: "Defina certo/errado",
        description: "Escolha se cada imagem é CERTO (vai pra direita) ou ERRADO (vai pra esquerda).",
        variant: "destructive",
      });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }

    const topFiles = items.map((it) => it.file!).filter(Boolean);
    const sides = items.map((it) => it.rule!) as Array<"certo" | "errado">;
    if (topFiles.length !== itemsCount) {
      toast({ title: "Imagens incompletas", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const created = await api.adminCreateAuditoryGame({
        title: title.trim(),
        description: description.trim(),
        items_count: itemsCount,
        assigned_to: selectedUserIds,
        background,
        items: topFiles,
        items_sides: sides,
      });
      toast({ title: "Jogo criado!", description: `“${created.title}” enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(`/jogos/auditivo/${created.id}`);
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
                <Ear className="h-4 w-4" />
                Novo jogo: Estimulação Auditiva
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">
                Escolha um fundo e imagens do topo. No jogo, a criança arrasta para a esquerda (errado) ou direita (certo).
              </p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Criar e enviar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Preview + uploads */}
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Arraste a figura correta" />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>

              <div className="space-y-2">
                <Label>Quantidade de imagens no topo</Label>
                <div className="flex gap-2">
                  {[4, 6, 10].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={itemsCount === n ? "default" : "secondary"}
                      onClick={() => setItemsCount(n as 4 | 6 | 10)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem de fundo (grande)</Label>
                <input
                  id="aud-bg"
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
                  <div className="mt-3">
                    <Button asChild variant="secondary">
                      <label htmlFor="aud-bg" className="cursor-pointer inline-flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        {background ? "Trocar fundo" : "Enviar fundo"}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-foreground">Imagens pequenas (topo)</div>
                  <div className="text-sm text-muted-foreground">{itemsCount} imagens</div>
                </div>
                <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
                  {items.map((it, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-3 transition-colors">
                      <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                        {it.previewUrl ? (
                          <img src={it.previewUrl} alt={`Topo ${idx + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <Upload className="h-6 w-6 mx-auto mb-1" />
                            <div className="text-xs">Topo {idx + 1}</div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-col items-center justify-center gap-2">
                        <div className="shrink-0 flex items-center justify-center">
                          <input
                            id={`aud-item-${idx}`}
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
                            <label htmlFor={`aud-item-${idx}`}>{it.file ? "Trocar" : "Enviar"}</label>
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={it.rule === "certo" ? "default" : "outline"}
                            onClick={() => setItemRule(idx, "certo")}
                            className={cn(
                              "w-20 px-2 text-xs inline-flex items-center justify-center whitespace-nowrap",
                              it.rule === "certo" && "bg-brand-green hover:bg-brand-green/90",
                            )}
                          >
                            Certo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={it.rule === "errado" ? "default" : "outline"}
                            onClick={() => setItemRule(idx, "errado")}
                            className={cn(
                              "w-20 px-2 text-xs inline-flex items-center justify-center whitespace-nowrap",
                              it.rule === "errado" && "bg-red-600 hover:bg-red-600/90",
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
              </div>
            </div>
          </div>

          {/* Assign users */}
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
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold">
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
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


