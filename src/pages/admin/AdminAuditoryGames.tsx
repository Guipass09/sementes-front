import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ear, Edit, Trash2, Search, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { AuditoryGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { ShareGameModal } from "@/features/games/ShareGameModal";

export default function AdminAuditoryGames() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<AuditoryGameRow[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string; profile_photo_url?: string | null }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuditoryGameRow | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<AuditoryGameRow | null>(null);

  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";
  const myId = auth.user?.id ?? 0;

  const refresh = async () => {
    setLoading(true);
    try {
      const [gamesData, usersData] = await Promise.all([
        isProfessional ? api.professionalListAuditoryGames() : api.adminListAuditoryGames(),
        isProfessional ? api.professionalListUsers() : api.adminListUsers(),
      ]);
      setGames(gamesData);
      const list = isProfessional ? (usersData as any).data ?? [] : (usersData as any).filter((u: any) => u.role === "user");
      setUsers(
        (list as any[]).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          profile_photo_url: u.profile_photo_url ?? null,
        }))
      );
    } catch {
      toast({
        title: "Erro ao carregar jogos",
        description: "Não foi possível carregar a lista de jogos de Estimulação Auditiva.",
        variant: "destructive",
      });
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
    return games.filter((g) => {
      return (
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.created_by.name.toLowerCase().includes(q) ||
        (g.assigned_to ?? []).some((u) => u.name.toLowerCase().includes(q))
      );
    });
  }, [games, searchTerm]);

  const groupedByUser = useMemo(() => {
    const byUser = new Map<number, AuditoryGameRow[]>();
    for (const game of filteredGames) {
      const assigned = game.assigned_to ?? [];
      for (const u of assigned) {
        const arr = byUser.get(u.id) ?? [];
        arr.push(game);
        byUser.set(u.id, arr);
      }
    }
    for (const [k, arr] of byUser.entries()) {
      byUser.set(k, [...arr].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
    }
    return byUser;
  }, [filteredGames]);

  const handleDelete = async (gameId: number) => {
    const g = games.find((x) => x.id === gameId) ?? null;
    setDeleteTarget(g);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await (isProfessional ? api.professionalDeleteAuditoryGame(deleteTarget.id) : api.adminDeleteAuditoryGame(deleteTarget.id));
      toast({ title: "Jogo excluído", description: "O jogo foi removido com sucesso." });
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
              <Ear className="h-6 w-6 text-brand-blue" />
              Estimulação Auditiva
            </h1>
            <p className="text-muted-foreground">Editar, excluir e enviar jogos auditivos para usuários.</p>
          </div>
          <Button onClick={() => navigate(`${base}/jogos/auditivo/novo`)} className="w-full sm:w-auto bg-brand-blue text-white hover:bg-brand-blue/90">
            Novo jogo
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Buscar jogos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

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
                    <div className="space-y-3 pt-2">
                      {list.map((g) => (
                        <div
                          key={g.id}
                          role="button"
                          onClick={() => navigate(`/jogos/auditivo/${g.id}`)}
                          className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {g.background_url ? (
                                <img src={normalizeMediaUrl(g.background_url)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Ear size={22} className="text-brand-blue" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground">{g.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                              <div className="text-sm text-muted-foreground mt-2">
                                {g.items_count} imagens • arrastar esquerda/direita
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`${base}/jogos/auditivo/${g.id}/editar`);
                                }}
                                disabled={isProfessional && (g.created_by?.id ?? 0) !== myId}
                              >
                                <Edit size={14} className="mr-2" /> Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareTarget(g);
                                  setShareOpen(true);
                                }}
                                disabled={isProfessional && (g.created_by?.id ?? 0) !== myId}
                                title={
                                  isProfessional && (g.created_by?.id ?? 0) !== myId
                                    ? "Apenas o criador pode compartilhar este jogo"
                                    : "Compartilhar com profissionais"
                                }
                              >
                                <Share2 size={14} className="mr-2" /> Compartilhar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(g.id);
                                }}
                                disabled={isProfessional && (g.created_by?.id ?? 0) !== myId}
                              >
                                <Trash2 size={14} className="mr-2" /> Excluir
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/jogos/auditivo/${g.id}`);
                                }}
                              >
                                <Play size={14} className="mr-2" /> Ver
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        )}

        {!loading && filteredGames.length === 0 && (
          <div className="text-center py-12">
            <Ear size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum jogo de Estimulação Auditiva encontrado</p>
          </div>
        )}
      </div>

      <BrandedConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Excluir jogo?"
        description={
          deleteTarget
            ? `Excluir o jogo "${deleteTarget.title}"? Esta ação é permanente.`
            : "Esta ação é permanente."
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
      />

      {shareTarget ? (
        <ShareGameModal
          open={shareOpen}
          onOpenChange={(o) => {
            setShareOpen(o);
            if (!o) setShareTarget(null);
          }}
          mode={isProfessional ? "professional" : "admin"}
          gameType="auditory_game"
          gameId={shareTarget.id}
          title={shareTarget.title}
        />
      ) : null}
    </div>
  );
}


