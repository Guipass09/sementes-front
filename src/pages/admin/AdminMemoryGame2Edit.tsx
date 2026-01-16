import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Grid3X3, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as api from "@/lib/laravel-api";
import type { AdminUserRow, MemoryGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

export default function AdminMemoryGame2Edit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const gameId = useMemo(() => Number(id), [id]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [game, setGame] = useState<MemoryGameRow | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [pairImages, setPairImages] = useState<File[]>([]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (uid: number) => {
    setSelectedUserIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  useEffect(() => {
    if (!Number.isFinite(gameId)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, u] = await Promise.all([api.adminGetMemoryGame(gameId), api.adminListUsers()]);
        if (cancelled) return;
        setGame(g);
        setTitle(g.title);
        setDescription(g.description);
        setSelectedUserIds((g.assigned_to ?? []).map((x) => x.id));
        setUsers(u.filter((x) => x.role === "user"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const onSave = async () => {
    if (!game) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ title: "Selecione usuários", description: "Escolha pelo menos 1 usuário.", variant: "destructive" });
      return;
    }
    if (pairImages.length > 0 && pairImages.length !== (game.pairs_count ?? 0) * 2) {
      toast({
        title: "Quantidade de imagens inválida",
        description: `Para o Memória 2.0, envie exatamente ${(game.pairs_count ?? 0) * 2} imagens (2 por par).`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.adminUpdateMemoryGame(game.id, {
        title: title.trim(),
        description: description.trim(),
        assigned_to: selectedUserIds,
        pair_images: pairImages.length > 0 ? pairImages : undefined,
      });
      setGame(updated);
      toast({ title: "Jogo atualizado!" });
      navigate(`/admin/jogos/memoria2`);
    } catch {
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={onSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground inline-flex items-center gap-2">
            <Grid3X3 className="h-6 w-6 text-brand-green" />
            Editar Jogo da Memória 2.0
          </h1>
          {game && <p className="text-muted-foreground">Pares: {game.pairs_count} • ID: {game.id}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-6 shadow-sm">
            {loading ? (
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
                  <Label>Substituir imagens (opcional)</Label>
                  <div className="text-sm text-muted-foreground">
                    Se você selecionar imagens aqui, envie exatamente <b>{(game?.pairs_count ?? 0) * 2}</b> (2 por par) para substituir.
                  </div>
                  <input
                    id="pair-images-v2"
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => setPairImages(Array.from(e.target.files || []))}
                  />
                  <Button asChild variant="secondary">
                    <label htmlFor="pair-images-v2" className="cursor-pointer inline-flex items-center">
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar imagens
                    </label>
                  </Button>
                  {pairImages.length > 0 && <div className="text-sm text-muted-foreground">{pairImages.length} arquivo(s) selecionado(s)</div>}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="font-semibold text-foreground mb-2">Usuários</div>
            <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {loading ? (
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

