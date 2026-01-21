import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, Plus, Search, Trash2, Pencil, Image as ImageIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { MemoryGameRow } from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

export default function AdminMemoryGames2() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MemoryGameRow[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string; profile_photo_url?: string | null }>>([]);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemoryGameRow | null>(null);

  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";

  const refresh = async () => {
    setLoading(true);
    try {
      const [res, u] = await Promise.all([
        isProfessional ? api.professionalListMemoryGames({ variant: "v2" }) : api.adminListMemoryGames({ variant: "v2" }),
        isProfessional ? api.professionalListUsers() : api.adminListUsers(),
      ]);
      setGames(res);
      const usersList = isProfessional ? (u as any).data ?? [] : (u as any).filter((x: any) => x.role === "user");
      setUsers(
        (usersList as any[]).map((x) => ({
          id: x.id,
          name: x.name,
          email: x.email,
          profile_photo_url: x.profile_photo_url ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.title.toLowerCase().includes(q));
  }, [games, search]);

  const groupedByUser = useMemo(() => {
    const byUser = new Map<number, MemoryGameRow[]>();
    for (const g of filtered) {
      const assigned = g.assigned_to ?? [];
      for (const u of assigned) {
        const arr = byUser.get(u.id) ?? [];
        arr.push(g);
        byUser.set(u.id, arr);
      }
    }
    for (const [k, arr] of byUser.entries()) {
      byUser.set(k, [...arr].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
    }
    return byUser;
  }, [filtered]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await (isProfessional ? api.professionalDeleteMemoryGame(deleteTarget.id) : api.adminDeleteMemoryGame(deleteTarget.id));
      toast({ title: "Jogo excluído", description: "O jogo foi removido com sucesso." });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await refresh();
    } catch {
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o jogo.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2 inline-flex items-center gap-2">
              <Grid3X3 className="h-6 w-6 text-brand-green" />
              Jogo da Memória 2.0
            </h1>
            <p className="text-muted-foreground">Crie, edite e envie jogos (pares definidos manualmente) para usuários</p>
          </div>
          <Button onClick={() => navigate(`${base}/jogos/memoria2/novo`)} className="w-full sm:w-auto">
            <Plus size={20} className="mr-2" />
            Criar Jogo
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jogos..." className="pl-11" />
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-9 w-28 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum jogo encontrado</div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {users
                .map((u) => ({ user: u, games: groupedByUser.get(u.id) ?? [] }))
                .filter((x) => x.games.length > 0)
                .map(({ user, games: list }) => (
                  <AccordionItem key={user.id} value={`user-${user.id}`} className="border-b border-border/60">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div>
                          <div className="font-semibold text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <div className="text-sm text-muted-foreground">{list.length} jogo(s)</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {list.map((g) => (
                          <div
                            key={g.id}
                            className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-12 w-12 rounded-xl bg-brand-green/10 overflow-hidden flex items-center justify-center">
                                {g.thumbnail?.url ? (
                                  <img src={normalizeMediaUrl(g.thumbnail.url)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-brand-green" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{g.title}</div>
                                <div className="text-sm text-muted-foreground line-clamp-2">{g.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">{g.pairs_count} pares</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => navigate(`/jogos/memoria2/${g.id}`)}>
                                <Play className="h-4 w-4 mr-2" />
                                Abrir
                              </Button>
                              <Button variant="outline" onClick={() => navigate(`${base}/jogos/memoria2/${g.id}/editar`)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  setDeleteTarget(g);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </div>
      </div>

      <BrandedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir jogo"
        description={deleteTarget ? `Excluir “${deleteTarget.title}”? Isso remove o jogo permanentemente.` : "Excluir este jogo?"}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </div>
  );
}

