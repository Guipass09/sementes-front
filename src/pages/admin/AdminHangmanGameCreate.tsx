import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Type, Upload, X, User as UserIcon, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, ProfessionalUserRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type SupportInput = { file: File | null; previewUrl: string | null };

function normalizeSecretWordUi(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 15);
}

export default function AdminHangmanGameCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secretWordInput, setSecretWordInput] = useState("");
  const [support, setSupport] = useState<SupportInput[]>(() => []);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const normalizedPreview = useMemo(() => normalizeSecretWordUi(secretWordInput), [secretWordInput]);

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
        toast({ title: "Não foi possível carregar usuários", variant: "destructive" });
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
    return () => {
      support.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
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

  const addSupportImage = (file: File | null) => {
    if (!file) return;
    if (support.length >= 5) {
      toast({ title: "Limite de 5 imagens", description: "Remova uma imagem para adicionar outra.", variant: "destructive" });
      return;
    }
    setSupport((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
  };

  const removeSupportImage = (idx: number) => {
    setSupport((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const onSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!normalizedPreview) {
      toast({ title: "Informe a palavra secreta", description: "Use apenas letras (máx. 15).", variant: "destructive" });
      return;
    }
    if (normalizedPreview.length > 15) {
      toast({ title: "Palavra muito longa", description: "Máximo de 15 letras.", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const created = await (auth.user?.role === "professional" ? api.professionalCreateHangmanGame : api.adminCreateHangmanGame)({
        title: title.trim(),
        description: description.trim(),
        secret_word: secretWordInput,
        assigned_to: selectedUserIds,
        support_images: support.map((s) => s.file!).filter(Boolean),
      });
      toast({ title: "Jogo criado!", description: `“${created.title}” enviado para ${selectedUserIds.length} usuário(s).` });
      navigate(auth.user?.role === "professional" ? `/profissional/jogos/forca` : `/admin/jogos/forca`);
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
                <Type className="h-4 w-4" />
                Novo jogo: Jogo da Forca
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Criar Jogo</h1>
              <p className="text-muted-foreground">Cadastre a palavra secreta e até 5 imagens de apoio.</p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0 bg-brand-orange text-white hover:bg-brand-orange/90">
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
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Descubra a palavra" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="word">Palavra secreta (máx. 15 letras)</Label>
                <Input
                  id="word"
                  value={secretWordInput}
                  onChange={(e) => setSecretWordInput(e.target.value)}
                  placeholder="Ex: BANANA"
                />
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
                  <div className="font-semibold text-foreground">Imagens de apoio (opcional)</div>
                  <div className="text-sm text-muted-foreground">{support.length}/5</div>
                </div>

                <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  {support.map((s, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="aspect-[4/3] rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                        {s.previewUrl ? (
                          <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
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
                          id="hangman-support"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            addSupportImage(e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                        <Button asChild type="button" variant="secondary" className="w-full cursor-pointer">
                          <label htmlFor="hangman-support">Enviar</label>
                        </Button>
                      </div>
                    </div>
                  )}
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
    </div>
  );
}


