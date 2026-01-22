import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleDot, Plus, Search, ArrowLeft, Play, Edit2, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { SpinWheelGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShareGameModal } from "@/features/games/ShareGameModal";

export default function AdminSpinWheelGames() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<SpinWheelGameRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SpinWheelGameRow | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<SpinWheelGameRow | null>(null);

  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";
  const myId = auth.user?.id ?? 0;

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await (isProfessional ? api.professionalListSpinWheelGames() : api.adminListSpinWheelGames());
      setGames(data);
    } catch {
      toast({ title: "Erro ao carregar jogos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredGames = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.title.toLowerCase().includes(q));
  }, [games, searchTerm]);

  // Group by assigned users
  const groupedByUser = useMemo(() => {
    const byUser = new Map<number, SpinWheelGameRow[]>();
    for (const g of filteredGames) {
      const assigned = g.assigned_to ?? [];
      for (const u of assigned) {
        const arr = byUser.get(u.id) ?? [];
        arr.push(g);
        byUser.set(u.id, arr);
      }
    }
    return byUser;
  }, [filteredGames]);

  const uniqueUsers = useMemo(() => {
    const users: Array<{ id: number; name: string }> = [];
    const seen = new Set<number>();
    for (const g of filteredGames) {
      for (const u of g.assigned_to ?? []) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          users.push(u);
        }
      }
    }
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredGames]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await (isProfessional ? api.professionalDeleteSpinWheelGame(deleteTarget.id) : api.adminDeleteSpinWheelGame(deleteTarget.id));
      toast({ title: "Roleta excluída!" });
      void refresh();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3">
          <Button variant="ghost" className="w-fit" onClick={() => navigate(`${base}/jogos`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Jogos
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CircleDot className="h-4 w-4" />
                Gerenciamento
              </div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Roletas
              </h1>
              <p className="text-muted-foreground">
                Gerencie as roletas musicais do sistema
              </p>
            </div>

            <Button onClick={() => navigate(`${base}/jogos/roleta/novo`)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Roleta
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Buscar roletas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {/* Games List */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-9 w-28 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <CircleDot size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma roleta encontrada</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {uniqueUsers.map((user) => {
              const userGames = groupedByUser.get(user.id) ?? [];
              if (userGames.length === 0) return null;

              return (
                <AccordionItem key={user.id} value={`user-${user.id}`} className="border-b border-border/60">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="font-semibold text-foreground">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {userGames.length} roleta(s)
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {userGames.map((game) => (
                        <div
                          key={game.id}
                          className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {game.thumbnail?.url ? (
                                <img
                                  src={normalizeMediaUrl(game.thumbnail.url)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <CircleDot size={24} className="text-amber-600" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground mb-1">{game.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {game.center_title || "Sem texto central"}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
                                <span className="text-amber-600 font-medium">{game.items_count} itens</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/jogos/roleta/${game.id}`)}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Jogar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`${base}/jogos/roleta/${game.id}/editar`)}
                                disabled={isProfessional && (game.created_by?.id ?? 0) !== myId}
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShareTarget(game);
                                  setShareOpen(true);
                                }}
                                disabled={isProfessional && (game.created_by?.id ?? 0) !== myId}
                                title={
                                  isProfessional && (game.created_by?.id ?? 0) !== myId
                                    ? "Apenas o criador pode compartilhar este jogo"
                                    : "Compartilhar com profissionais"
                                }
                              >
                                <Share2 className="h-4 w-4 mr-1" />
                                Compartilhar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget(game);
                                  setDeleteOpen(true);
                                }}
                                disabled={isProfessional && (game.created_by?.id ?? 0) !== myId && (game.assigned_to?.length ?? 0) === 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Excluir roleta?"
          description={
            deleteTarget
              ? `Excluir a roleta "${deleteTarget.title}"? Esta ação é permanente.`
              : "Esta ação é permanente."
          }
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={handleDelete}
        />

        {shareTarget ? (
          <ShareGameModal
            open={shareOpen}
            onOpenChange={(o) => {
              setShareOpen(o);
              if (!o) setShareTarget(null);
            }}
            mode={isProfessional ? "professional" : "admin"}
            gameType="spin_wheel_game"
            gameId={shareTarget.id}
            title={shareTarget.title}
          />
        ) : null}
      </div>
    </div>
  );
}
