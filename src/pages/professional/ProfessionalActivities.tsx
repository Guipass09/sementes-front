import { useEffect, useMemo, useState } from "react";
import { Activity, Plus, Search, Grid3X3, ChevronDown, Share2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityRow, ProfessionalUserRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfessionalActivityFormModal } from "@/features/activities/ProfessionalActivityFormModal";
import { ShareActivityModal } from "@/features/activities/ShareActivityModal";
import { useAuth } from "@/auth/AuthContext";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

export default function ProfessionalActivities(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<ProfessionalUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ActivityRow | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, u] = await Promise.all([api.professionalListActivities(), api.professionalListUsers()]);
      setActivities(data);
      setUsers(u.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredActivities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => a.title.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q));
  }, [activities, searchTerm]);

  const groupedByUser = useMemo(() => {
    const byUser = new Map<number, ActivityRow[]>();
    for (const a of filteredActivities) {
      const assigned = a.assigned_to ?? [];
      for (const u of assigned) {
        const arr = byUser.get(u.id) ?? [];
        arr.push(a);
        byUser.set(u.id, arr);
      }
    }
    for (const [k, arr] of byUser.entries()) {
      byUser.set(k, [...arr].sort((x, y) => (y.id ?? 0) - (x.id ?? 0)));
    }
    return byUser;
  }, [filteredActivities]);

  const unassignedActivities = useMemo(() => {
    const myId = auth.user?.id ?? 0;
    return filteredActivities
      .filter((a) => (a.assigned_to?.length ?? 0) === 0)
      .sort((a, b) => {
        const aMine = (a.created_by?.id ?? 0) === myId ? 1 : 0;
        const bMine = (b.created_by?.id ?? 0) === myId ? 1 : 0;
        if (aMine !== bMine) return bMine - aMine;
        return (b.id ?? 0) - (a.id ?? 0);
      });
  }, [filteredActivities, auth.user?.id]);

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Atividades</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Crie, edite e envie atividades para seus usuários.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={users.length === 0}
                  title={users.length === 0 ? "Peça ao admin vincular usuários ao seu perfil" : "Criar jogo"}
                >
                  <Grid3X3 size={20} className="mr-2" />
                  Criar Jogo
                  <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Novo jogo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/memoria/novo")}>Memória</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/memoria2/novo")}>Memória 2.0</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/fonema/novo")}>Discriminação Fonema</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/auditivo/novo")}>Estimulação Auditiva</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/forca/novo")}>Forca</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/roleta/novo")}>Roleta Musical</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/caca-palavras/novo")}>Caça-palavras</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/cartas/novo")}>Jogo das Cartas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profissional/jogos/acerte-imagem/novo")}>Acerte a Imagem</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="w-full sm:w-auto"
              disabled={users.length === 0}
              title={users.length === 0 ? "Peça ao admin vincular usuários ao seu perfil" : "Nova atividade"}
            >
              <Plus size={20} className="mr-2" />
              Nova Atividade
            </Button>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              type="text"
              placeholder="Buscar atividades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-11 text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
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
          ) : (
            <Accordion type="multiple" className="w-full">
              {unassignedActivities.length > 0 && (
                <AccordionItem value="__unassigned__" className="border-b border-border/60">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div>
                        <div className="font-semibold text-foreground">Biblioteca (não atribuídas)</div>
                        <div className="text-xs text-muted-foreground">Inclui atividades compartilhadas</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{unassignedActivities.length} atividade(s)</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {unassignedActivities.map((activity) => {
                        const createdByMe = (activity.created_by?.id ?? 0) === (auth.user?.id ?? 0);
                        const hasAssignedPatients = (activity.assigned_to?.length ?? 0) > 0;
                        // Pode editar se criou OU se está atribuída a algum paciente do profissional
                        const canEdit = createdByMe || hasAssignedPatients;
                        return (
                          <div key={`unassigned-${activity.id}`} className="w-full text-left bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {activity.thumbnail?.media_type === "image" ? (
                                    <img src={normalizeMediaUrl(activity.thumbnail.url)} alt="" className="w-full h-full object-cover" />
                                  ) : activity.thumbnail?.media_type === "video" && activity.thumbnail.thumbnail_url ? (
                                    <img
                                      src={normalizeMediaUrl(activity.thumbnail.thumbnail_url)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Activity size={18} className="sm:w-5 sm:h-5 text-primary" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm sm:text-base text-foreground truncate">{activity.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {activity.category || "—"}
                                    {!createdByMe && !hasAssignedPatients ? " • Compartilhada" : ""}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end">
                                <Button variant="outline" size="sm" onClick={() => navigate(`/atividades/${activity.id}`)} className="text-xs sm:text-sm">
                                  Abrir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setShareTarget(activity);
                                    setShareOpen(true);
                                  }}
                                  disabled={!createdByMe}
                                  title={!createdByMe ? "Apenas o criador pode compartilhar esta atividade" : "Compartilhar com outros profissionais"}
                                  className="text-xs sm:text-sm"
                                >
                                  <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Compartilhar</span>
                                </Button>
                                {canEdit ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditing(activity);
                                        setFormOpen(true);
                                      }}
                                      className="text-xs sm:text-sm"
                                    >
                                      Editar
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteTarget(activity);
                                        setDeleteOpen(true);
                                      }}
                                      className="text-xs sm:text-sm"
                                    >
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
              )}
              {users
                .map((u) => ({ user: u, activities: groupedByUser.get(u.id) ?? [] }))
                .filter((x) => x.activities.length > 0)
                .map(({ user, activities: list }) => (
                  <AccordionItem key={user.id} value={`user-${user.id}`} className="border-b border-border/60">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div>
                          <div className="font-semibold text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <div className="text-sm text-muted-foreground">{list.length} atividade(s)</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {list.map((activity) => {
                          const createdByMe = (activity.created_by?.id ?? 0) === (auth.user?.id ?? 0);
                          const hasAssignedPatients = (activity.assigned_to?.length ?? 0) > 0;
                          // Pode editar se criou OU se está atribuída a algum paciente do profissional
                          const canEdit = createdByMe || hasAssignedPatients;
                          return (
                            <div
                              key={activity.id}
                              className="w-full text-left bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {activity.thumbnail?.media_type === "image" ? (
                                      <img src={normalizeMediaUrl(activity.thumbnail.url)} alt="" className="w-full h-full object-cover" />
                                    ) : activity.thumbnail?.media_type === "video" && activity.thumbnail.thumbnail_url ? (
                                      <img
                                        src={normalizeMediaUrl(activity.thumbnail.thumbnail_url)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Activity size={18} className="sm:w-5 sm:h-5 text-primary" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm sm:text-base text-foreground truncate">{activity.title}</div>
                                    <div className="text-xs text-muted-foreground truncate">{activity.category || "—"}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end">
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/atividades/${activity.id}`)} className="text-xs sm:text-sm">
                                    Abrir
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShareTarget(activity);
                                      setShareOpen(true);
                                    }}
                                    disabled={!createdByMe}
                                    title={!createdByMe ? "Apenas o criador pode compartilhar esta atividade" : "Compartilhar com outros profissionais"}
                                    className="text-xs sm:text-sm"
                                  >
                                    <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">Compartilhar</span>
                                  </Button>
                                  {canEdit ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditing(activity);
                                          setFormOpen(true);
                                        }}
                                        className="text-xs sm:text-sm"
                                      >
                                        Editar
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          setDeleteTarget(activity);
                                          setDeleteOpen(true);
                                        }}
                                        className="text-xs sm:text-sm"
                                      >
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

        {!loading && filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
          </div>
        )}

        <ProfessionalActivityFormModal
          open={formOpen}
          mode={editing ? "edit" : "create"}
          initial={editing}
          onOpenChange={setFormOpen}
          onSaved={refresh}
        />

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Excluir atividade?"
          description={deleteTarget ? `Excluir a atividade "${deleteTarget.title}"? Esta ação é permanente.` : "Esta ação é permanente."}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => {
            if (!deleteTarget) return;
            void api.professionalDeleteActivity(deleteTarget.id).then(() => refresh());
          }}
        />

        <ShareActivityModal
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) setShareTarget(null);
          }}
          activity={shareTarget}
          mode="professional"
        />
      </div>
    </div>
  );
}

