import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, Plus, Search, Trash2, Pencil, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { GuessImageGameRow } from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { ShareGameModal } from "@/features/games/ShareGameModal";

export default function AdminGuessImageGames() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GuessImageGameRow[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string; profile_photo_url?: string | null }>>([]);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GuessImageGameRow | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<GuessImageGameRow | null>(null);

  const isProfessional = auth.user?.role === "professional";
  const base = isProfessional ? "/profissional" : "/admin";
  const myId = auth.user?.id ?? 0;

  const refresh = async () => {
    setLoading(true);
    try {
      const [res, u] = await Promise.all([
        isProfessional ? api.professionalListGuessImageGames() : api.adminListGuessImageGames(),
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
    const byUser = new Map<number, GuessImageGameRow[]>();
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

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2 inline-flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-brand-pink" />
              Acerte a Imagem
            </h1>
            <p className="text-muted-foreground">Crie, edite e envie jogos para usuários</p>
          </div>
          <Button onClick={() => navigate(`${base}/jogos/acerte-imagem/novo`)} className="w-full sm:w-auto bg-brand-pink hover:bg-brand-pink/90">
            <Plus size={20} className="mr-2" />
            Criar Jogo
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jogos..."
              className="pl-11"
            />
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
                .map((u) => ({
                  user: u,
                  games: groupedByUser.get(u.id) ?? [],
                }))
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
                        {list.map((g) => {
                          const createdByMe = isProfessional && (g.created_by?.id ?? 0) === myId;
                          const hasAssignedPatients = isProfessional && (g.assigned_to?.length ?? 0) > 0;
                          const canEdit = !isProfessional || createdByMe || hasAssignedPatients;
                          return (
                            <div
                              key={g.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => navigate(`/jogos/acerte-imagem/${g.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  navigate(`/jogos/acerte-imagem/${g.id}`);
                                }
                              }}
                              className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-brand-pink/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {g.thumbnail?.main_url ? (
                                    <img
                                      src={normalizeMediaUrl(g.thumbnail.main_url)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = "/placeholder.svg";
                                      }}
                                    />
                                  ) : (
                                    <ImageIcon size={24} className="text-brand-pink" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-foreground">{g.title}</h3>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      {g.sessions_count} sessões
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 justify-end">
                                  <Button
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/jogos/acerte-imagem/${g.id}`);
                                    }}
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Ver
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShareTarget(g);
                                      setShareOpen(true);
                                    }}
                                    disabled={isProfessional && !createdByMe}
                                    title={
                                      isProfessional && !createdByMe
                                        ? "Apenas o criador pode compartilhar este jogo"
                                        : "Compartilhar com profissionais"
                                    }
                                  >
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Compartilhar
                                  </Button>
                                  {canEdit ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`${base}/jogos/acerte-imagem/${g.id}/editar`);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setDeleteTarget(g);
                                          setDeleteOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
        onConfirm={() => {
          if (!deleteTarget) return;
          void (isProfessional ? api.professionalDeleteGuessImageGame(deleteTarget.id) : api.adminDeleteGuessImageGame(deleteTarget.id)).then(() => {
            toast({ title: "Jogo excluído" });
            void refresh();
          });
        }}
      />

      {shareTarget ? (
        <ShareGameModal
          open={shareOpen}
          onOpenChange={(o) => {
            setShareOpen(o);
            if (!o) setShareTarget(null);
          }}
          mode={isProfessional ? "professional" : "admin"}
          gameType="guess_image_game"
          gameId={shareTarget.id}
          title={shareTarget.title}
        />
      ) : null}
    </div>
  );
}
