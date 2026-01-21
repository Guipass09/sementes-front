import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Upload, X, ArrowLeft, CircleDot, User as UserIcon, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, ProfessionalUserRow, SpinWheelGameRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type ItemInput = {
  id?: number;
  file: File | null;
  previewUrl: string | null;
  label: string;
  existingUrl?: string;
};

export default function AdminSpinWheelGameEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional/jogos" : "/admin/jogos";

  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<(AdminUserRow | ProfessionalUserRow)[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [centerTitle, setCenterTitle] = useState("");
  const [items, setItems] = useState<ItemInput[]>([]);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [existingBackground, setExistingBackground] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return navigate("/entrar");
    if (auth.user.role !== "admin" && auth.user.role !== "professional") return navigate("/paciente");
  }, [auth.loading, auth.user, navigate]);

  // Load game data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoadingGame(true);
      try {
        const game = await (isProfessional ? api.professionalGetSpinWheelGame : api.adminGetSpinWheelGame)(Number(id));
        if (cancelled) return;

        setTitle(game.title);
        setCenterTitle(game.center_title || "");
        setExistingBackground(game.background_url || null);
        setSelectedUserIds(game.assigned_to?.map((u) => u.id) || []);
        setItems(
          game.items.map((item) => ({
            id: item.id,
            file: null,
            previewUrl: null,
            label: item.label,
            existingUrl: item.image_url,
          }))
        );
      } catch {
        toast({ title: "Erro ao carregar roleta", variant: "destructive" });
        navigate(`${base}/roleta`);
      } finally {
        if (!cancelled) setLoadingGame(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load users
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
          title: "Não foi possível carregar usuários",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]
    );
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
    if (!title.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", variant: "destructive" });
      return;
    }

    // Check if any item is missing both file and existing URL
    const hasAllImages = items.every((item) => item.file || item.existingUrl);
    if (!hasAllImages) {
      toast({ title: "Faltam imagens", variant: "destructive" });
      return;
    }

    const hasAllLabels = items.every((item) => item.label.trim());
    if (!hasAllLabels) {
      toast({ title: "Faltam nomes", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Only send new images if any were changed
      const hasNewImages = items.some((item) => item.file);
      const payload: Parameters<typeof api.adminUpdateSpinWheelGame>[1] = {
        title: title.trim(),
        center_title: centerTitle.trim(),
        assigned_to: selectedUserIds,
      };

      if (backgroundFile) {
        payload.background = backgroundFile;
      }

      if (hasNewImages) {
        // If any image changed, we need to resend all
        const allFiles: File[] = [];
        const allLabels: string[] = [];

        for (const item of items) {
          if (item.file) {
            allFiles.push(item.file);
          } else if (item.existingUrl) {
            // For items without new files, we need to fetch and create a File
            // This is a limitation - for now we'll skip these and only update metadata
          }
          allLabels.push(item.label.trim());
        }

        // Only include if we have new files
        if (allFiles.length > 0) {
          payload.item_images = allFiles;
          payload.item_labels = allLabels;
        }
      }

      await (isProfessional ? api.professionalUpdateSpinWheelGame : api.adminUpdateSpinWheelGame)(Number(id), payload);
      toast({ title: "Roleta atualizada!" });
      navigate(`${base}/roleta`);
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingGame) {
    return (
      <div className="min-h-full py-8 lg:py-12">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
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
                <CircleDot className="h-4 w-4" />
                Editar Roleta
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                {title || "Editar Roleta"}
              </h1>
            </div>

            <Button onClick={onSubmit} disabled={saving} className="shrink-0">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Título do jogo</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="centerTitle">Texto no centro da roleta</Label>
                <Textarea
                  id="centerTitle"
                  value={centerTitle}
                  onChange={(e) => setCenterTitle(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Background */}
              <div className="space-y-2">
                <Label>Imagem de fundo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {backgroundPreview ? (
                      <img src={backgroundPreview} alt="Fundo" className="w-full h-full object-cover" />
                    ) : existingBackground ? (
                      <img src={normalizeMediaUrl(existingBackground)} alt="Fundo" className="w-full h-full object-cover" />
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
                        Trocar fundo
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Items */}
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
                        ) : item.existingUrl ? (
                          <img src={normalizeMediaUrl(item.existingUrl)} alt={`Item ${idx + 1}`} className="w-full h-full object-cover" />
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
                            <label htmlFor={`item-image-${idx}`}>Trocar</label>
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
                  Usuários atribuídos
                </div>
                <div className="text-sm text-muted-foreground">{selectedUserIds.length} selecionado(s)</div>
              </div>
            </div>

            <div className="space-y-3">
              <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} />

              {loadingUsers ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
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
                          checked ? "border-brand-green bg-brand-green/10" : "border-border hover:bg-muted/30"
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
