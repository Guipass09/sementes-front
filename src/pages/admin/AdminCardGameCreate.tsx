import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, Plus, Upload, X, User as UserIcon, Image } from "lucide-react";
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

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default function AdminCardGameCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cardsCount, setCardsCount] = useState(10);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
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

  const handleBackgroundChange = (file: File | null) => {
    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    setBackgroundFile(file);
    setBackgroundPreview(file ? URL.createObjectURL(file) : null);
  };

  const onSubmit = async () => {
    const n = clampInt(cardsCount, 1, 15);
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

    setSaving(true);
    try {
      const created = await api.adminCreateCardGame({
        title: title.trim(),
        description: description.trim(),
        cards_count: n,
        assigned_to: selectedUserIds,
        background: backgroundFile || undefined,
      });
      toast({ title: "Jogo criado!", description: `"${created.title}" foi enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(`/jogos/cartas/${created.id}`);
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
                <Layers className="h-4 w-4" />
                Novo jogo: Jogo das Cartas
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">Configure o baralho (até 15 cartas) e envie para usuários.</p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0 bg-brand-brown hover:bg-brand-brown/90">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Criar e enviar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Título do jogo</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Baralho do Sementes" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Explique o que deve ser feito no jogo."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cardsCount">Quantidade de cartas (1–15)</Label>
                  <Input
                    id="cardsCount"
                    type="number"
                    min={1}
                    max={15}
                    step={1}
                    value={cardsCount}
                    onChange={(e) => setCardsCount(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagem de fundo (opcional)</Label>
                  <div className="flex items-center gap-3">
                    <label
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted/50 cursor-pointer"
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">Escolher</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleBackgroundChange(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {backgroundFile ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleBackgroundChange(null)}
                        className="rounded-xl"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-xl border border-border overflow-hidden bg-muted/20">
                    {backgroundPreview ? (
                      <img src={backgroundPreview} alt="" className="w-full h-[180px] object-cover" />
                    ) : (
                      <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                        <Image className="h-5 w-5 mr-2" />
                        Sem fundo (usa o tema padrão)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Users */}
          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-semibold text-foreground">Enviar para usuários</div>
              <div className="text-xs text-muted-foreground">{selectedUserIds.length} selecionado(s)</div>
            </div>

            <div className="mb-4">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11"
                />
              </div>
            </div>

            {loadingUsers ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {filteredUsers.map((u) => {
                  const active = selectedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={cn(
                        "w-full text-left flex items-center gap-3 rounded-xl border p-3 transition-all",
                        active ? "border-brand-brown/40 bg-brand-brown/10" : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                        {u.profile_photo_url ? (
                          <img src={normalizeMediaUrl(u.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">
                            {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center text-xs",
                          active ? "bg-brand-brown text-white border-brand-brown" : "border-border"
                        )}
                      >
                        {active ? "✓" : ""}
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

