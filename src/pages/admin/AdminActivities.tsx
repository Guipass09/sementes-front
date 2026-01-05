import { useEffect, useMemo, useState } from "react";
import { Activity, Plus, Search, FileText, Clock, Tag, Grid3X3, ChevronDown, Ear, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFormModal } from "@/features/activities/ActivityFormModal";
import type { ActivityRow, AdminUserRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
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

const AdminActivities = () => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, u] = await Promise.all([api.adminListActivities(), api.adminListUsers()]);
      setActivities(data);
      setUsers(u.filter((x) => x.role === "user"));
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
    return activities.filter((a) => {
      return (
        a.title.toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q)
      );
    });
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
    // Ordena atividades por id desc dentro de cada usuário
    for (const [k, arr] of byUser.entries()) {
      byUser.set(k, [...arr].sort((x, y) => (y.id ?? 0) - (x.id ?? 0)));
    }
    return byUser;
  }, [filteredActivities]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
              Gerenciamento de Atividades
            </h1>
            <p className="text-muted-foreground">
              Crie, edite e envie atividades para usuários
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Grid3X3 size={20} className="mr-2" />
                  Criar Jogo
                  <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Novo jogo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/admin/jogos/memoria/novo")}>
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Jogo da Memória
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/admin/jogos/auditivo/novo")}>
                  <Ear className="h-4 w-4 mr-2" />
                  Estimulação Auditiva
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/admin/jogos/forca/novo")}>
                  <Type className="h-4 w-4 mr-2" />
                  Jogo da Forca
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus size={20} className="mr-2" />
              Nova Atividade
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Buscar atividades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {/* Activities List */}
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
          ) : (
            <Accordion type="multiple" className="w-full">
              {users
                .map((u) => ({
                  user: u,
                  activities: groupedByUser.get(u.id) ?? [],
                }))
                .filter((x) => x.activities.length > 0)
                .map(({ user, activities: list }) => (
                  <AccordionItem key={user.id} value={`user-${user.id}`} className="border-b border-border/60">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div>
                          <div className="font-semibold text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {list.length} atividade(s)
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {list.map((activity) => (
                          <div
                            key={activity.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/atividades/${activity.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                navigate(`/atividades/${activity.id}`);
                              }
                            }}
                            className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {activity.thumbnail?.media_type === "image" ? (
                                  <img
                                    src={normalizeMediaUrl(activity.thumbnail.url)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                ) : activity.thumbnail?.media_type === "video" && activity.thumbnail.thumbnail_url ? (
                                  <img
                                    src={normalizeMediaUrl(activity.thumbnail.thumbnail_url)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                ) : (
                                  <FileText size={24} className="text-primary" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground">{activity.title}</h3>
                                  {activity.category && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                                      <Tag size={12} />
                                      {activity.category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {activity.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                  {activity.estimated_time && (
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Clock size={14} />
                                      {activity.estimated_time}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">
                                    Mídias: {activity.media?.length ?? 0}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditing(activity);
                                    setFormOpen(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(activity);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  Excluir
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
        </div>

        {/* Empty State */}
        {filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
          </div>
        )}

        <ActivityFormModal
          open={formOpen}
          mode={editing ? "edit" : "create"}
          initial={editing}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
          }}
          onSaved={refresh}
        />

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Excluir atividade?"
          description={
            deleteTarget
              ? `Excluir a atividade "${deleteTarget.title}"? Esta ação é permanente e remove também as mídias.`
              : "Esta ação é permanente e remove também as mídias."
          }
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => {
            if (!deleteTarget) return;
            void api.adminDeleteActivity(deleteTarget.id).then(() => refresh());
          }}
        />

        {/* Preview modal removed: activity now opens in dedicated page /atividades/:id */}
      </div>
    </div>
  );
};

export default AdminActivities;





