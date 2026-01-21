import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload, X, ArrowLeft, CircleDot, User as UserIcon, Image } from "lucide-react";
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

type ItemInput = {
  file: File | null;
  previewUrl: string | null;
  label: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminSpinWheelGameCreate() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [centerTitle, setCenterTitle] = useState("");
  const [itemsCount, setItemsCount] = useState(10);
  const [items, setItems] = useState<ItemInput[]>(() => 
    Array.from({ length: 10 }, () => ({ file: null, previewUrl: null, label: "" }))
  );
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

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
  }, []);

  // Ajusta items quando itemsCount muda
  useEffect(() => {
    setItems((prev) => {
      const nextCount = clamp(itemsCount, 4, 12);
      const copy = [...prev];
      // cleanup previews que sairão
      if (copy.length > nextCount) {
        for (let i = nextCount; i < copy.length; i++) {
          if (copy[i]?.previewUrl) URL.revokeObjectURL(copy[i].previewUrl!);
        }
      }
      while (copy.length < nextCount) copy.push({ file: null, previewUrl: null, label: "" });
      return copy.slice(0, nextCount);
    });
  }, [itemsCount]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const missingImages = useMemo(() => items.some((p) => !p.file), [items]);
  const missingLabels = useMemo(() => items.some((p) => !p.label.trim()), [items]);

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setItemFile = (idx: number, file: File | null) => {
    setItems((prev) => {
      const copy = [...prev];
      const old = copy[idx];
      if (!old) return prev;
      if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
      copy[idx] = {
        ...old,
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
      };
      return copy;
    });
  };

  const setItemLabel = (idx: number, label: string) => {
    setItems((prev) => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], label };
      }
      return copy;
    });
  };

  const handleBackgroundChange = (file: File | null) => {
    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    setBackgroundFile(file);
    setBackgroundPreview(file ? URL.createObjectURL(file) : null);
  };

  const onSubmit = async () => {
    const finalItemsCount = clamp(itemsCount, 4, 12);
    if (!title.trim()) {
      toast({ title: "Informe um título", description: "O título do jogo é obrigatório.", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário para receber o jogo.", variant: "destructive" });
      return;
    }
    if (missingImages) {
      toast({ title: "Faltam imagens", description: "Envie 1 imagem para cada item da roleta.", variant: "destructive" });
      return;
    }
    if (missingLabels) {
      toast({ title: "Faltam nomes", description: "Dê um nome para cada item da roleta.", variant: "destructive" });
      return;
    }

    const files = items.slice(0, finalItemsCount).map((p) => p.file!).filter(Boolean);
    const labels = items.slice(0, finalItemsCount).map((p) => p.label.trim());

    if (files.length !== finalItemsCount) {
      toast({ title: "Imagens incompletas", description: "Envie 1 imagem para cada item.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const isProfessional = auth.user?.role === "professional";
      const base = isProfessional ? "/profissional/jogos" : "/admin/jogos";
      const created = await (isProfessional ? api.professionalCreateSpinWheelGame : api.adminCreateSpinWheelGame)({
        title: title.trim(),
        center_title: centerTitle.trim() || undefined,
        items_count: finalItemsCount,
        assigned_to: selectedUserIds,
        background: backgroundFile || undefined,
        item_images: files,
        item_labels: labels,
      });

      toast({ title: "Roleta criada!", description: `"${created.title}" foi enviada para ${selectedUserIds.length} usuário(s).` });
      navigate(`${base}/roleta`);
    } catch (e) {
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
                <CircleDot className="h-4 w-4" />
                Novo recurso: Roleta Musical
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Criar Roleta
              </h1>
              <p className="text-muted-foreground">
                Configure a roleta com até 12 imagens e nomes.
              </p>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0">
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
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Roleta dos Animais" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="centerTitle">Texto no centro da roleta</Label>
                <Textarea
                  id="centerTitle"
                  value={centerTitle}
                  onChange={(e) => setCenterTitle(e.target.value)}
                  placeholder="Ex: Gire a roleta e cante uma música que tenha essa palavra!"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemsCount">Quantidade de itens (4 a 12)</Label>
                <Input
                  id="itemsCount"
                  type="number"
                  min={4}
                  max={12}
                  value={itemsCount}
                  onChange={(e) => setItemsCount(clamp(Number(e.target.value || 0), 4, 12))}
                />
              </div>

              {/* Background opcional */}
              <div className="space-y-2">
                <Label>Imagem de fundo (opcional)</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {backgroundPreview ? (
                      <img src={backgroundPreview} alt="Fundo" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      id="background-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleBackgroundChange(e.target.files?.[0] ?? null)}
                    />
                    <Button asChild type="button" variant="secondary" size="sm">
                      <label htmlFor="background-upload" className="cursor-pointer">
                        {backgroundFile ? "Trocar fundo" : "Enviar fundo"}
                      </label>
                    </Button>
                    {backgroundFile && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleBackgroundChange(null)}>
                        <X className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-foreground">Itens da Roleta</div>
                  <div className="text-sm text-muted-foreground">{items.length} itens</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                        {item.previewUrl ? (
                          <img src={item.previewUrl} alt={`Item ${idx + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <Upload className="h-6 w-6 mx-auto mb-1" />
                            <div className="text-xs">Item {idx + 1}</div>
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <Input
                          placeholder={`Nome ${idx + 1}`}
                          value={item.label}
                          onChange={(e) => setItemLabel(idx, e.target.value)}
                          className="text-sm h-8"
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            id={`item-image-${idx}`}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => setItemFile(idx, e.target.files?.[0] ?? null)}
                          />
                          <Button asChild type="button" variant="secondary" className="w-full cursor-pointer" size="sm">
                            <label htmlFor={`item-image-${idx}`}>{item.file ? "Trocar" : "Imagem"}</label>
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setItemFile(idx, null)}
                          disabled={!item.file}
                          aria-label="Remover"
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
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
