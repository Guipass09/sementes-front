import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Plus, Search, Trash2, Pencil, Image as ImageIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { AdminUserRow, WordSearchGameRow } from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

export default function AdminWordSearchGames() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<WordSearchGameRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WordSearchGameRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [res, u] = await Promise.all([api.adminListWordSearchGames(), api.adminListUsers()]);
      setGames(res);
      setUsers(u.filter((x) => x.role === "user"));
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
    const byUser = new Map<number, WordSearchGameRow[]>();
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
      await api.adminDeleteWordSearchGame(deleteTarget.id);
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
              <Gamepad2 className="h-6 w-6 text-brand-green" />
              Caça-palavras
            </h1>
            <p className="text-muted-foreground">Crie, edite e envie jogos para usuários</p>
          </div>
          <Button onClick={() => navigate("/admin/jogos/caca-palavras/novo")} className="w-full sm:w-auto">
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
                                {g.items?.[0]?.image_url ? (
                                  <img src={normalizeMediaUrl(g.items[0].image_url)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-brand-green" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{g.title}</div>
                                <div className="text-sm text-muted-foreground line-clamp-2">{g.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">{g.words_count} palavra(s)</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => navigate(`/jogos/caca-palavras/${g.id}`)}>
                                <Play className="h-4 w-4 mr-2" />
                                Abrir
                              </Button>
                              <Button variant="outline" onClick={() => navigate(`/admin/jogos/caca-palavras/${g.id}/editar`)}>
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
        description={deleteTarget ? `Excluir "${deleteTarget.title}"? Isso remove o jogo permanentemente.` : "Excluir este jogo?"}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </div>
  );
}
