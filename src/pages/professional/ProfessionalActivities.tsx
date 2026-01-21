import { useEffect, useMemo, useState } from "react";
import { Activity, Plus, Search, Grid3X3, ChevronDown } from "lucide-react";
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

export default function ProfessionalActivities(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<ProfessionalUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
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

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Atividades</h1>
            <p className="text-muted-foreground">Crie, edite e envie atividades para seus usuários.</p>
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
                        {list.map((activity) => (
                          <div
                            key={activity.id}
                            className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Activity size={20} className="text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground truncate">{activity.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{activity.category || "—"}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => navigate(`/atividades/${activity.id}`)}>
                                  Abrir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditing(activity);
                                    setFormOpen(true);
                                  }}
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
      </div>
    </div>
  );
}

