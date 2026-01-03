import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, Edit, Trash2, Search, Clock, User, Lock, Unlock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { computeTodaySessionAlert, getTodayYMD } from "@/lib/session-alert";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import {
  adminCreateRecurringAppointments,
  adminDeleteAppointment,
  adminListAppointments,
  adminListUsers,
  adminUpdateAppointmentStatus,
  isApiError,
} from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { emitAdminDataChanged } from "@/lib/admin-events";

interface SessionData {
  id: number;
  userId: number;
  userName: string;
  date: string;
  time: string;
  type: string;
  professional: string;
  totalSessions: number;
  status: "realizada" | "agendada" | "cancelada" | "bloqueada";
  notes?: string;
}

const statusConfig = {
  realizada: {
    label: "Realizada",
    color: "bg-brand-green/10 text-brand-green border-brand-green/20",
  },
  agendada: {
    label: "Agendada",
    color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
  },
  cancelada: {
    label: "Cancelada",
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
  bloqueada: {
    label: "Bloqueada",
    color: "bg-muted text-muted-foreground border-border",
  },
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const AdminSessions = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [formData, setFormData] = useState({
    userId: "",
    date: "",
    time: "",
    type: "",
    professional: "",
    totalSessions: 1,
    status: "agendada" as SessionData["status"],
    notes: "",
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Carrega usuários para o select (admin)
    let mounted = true;
    (async () => {
      try {
        const list = await adminListUsers();
        const onlyUsers = list
          .filter((u) => u.role === "user")
          .map((u) => ({ id: u.id, name: u.name, email: u.email }));
        if (mounted) setUsers(onlyUsers);
      } catch {
        // sem fallback fake: se falhar, apenas mantém vazio
        if (mounted) setUsers([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const reloadFromBackend = async () => {
    const rows = await adminListAppointments();
    const mapped: SessionData[] = rows.map((r) => ({
      id: r.id,
      userId: r.user?.id || r.user_id,
      userName: r.user?.name || "—",
      date: (() => {
        // backend pode retornar ISO (ex: 2025-12-29T00:00:00.000000Z) ou YYYY-MM-DD
        const raw = r.session_date || "";
        if (raw.includes("T")) return raw.slice(0, 10);
        return raw;
      })(),
      time: (r.session_time || "").slice(0, 5),
      type: "Sessão",
      professional: r.professional_name,
      totalSessions: r.total_sessions,
      status: r.status === "completed" ? "realizada" : r.status === "canceled" ? "cancelada" : "agendada",
    }));
    setSessions(mapped);
  };


  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await reloadFromBackend();
      } catch {
        // sem fallback fake: se falhar, apenas mantém vazio
        if (mounted) setSessions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(
      (session) =>
        session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.professional.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sessions, searchTerm]);

  const sessionsByUser = useMemo(() => {
    const map = new Map<number, { userId: number; userName: string; items: SessionData[] }>();
    for (const s of filteredSessions) {
      const key = s.userId || 0;
      const entry = map.get(key) || { userId: key, userName: s.userName || "—", items: [] };
      entry.items.push(s);
      map.set(key, entry);
    }

    // ordena horários dentro de cada usuário (data + hora)
    for (const entry of map.values()) {
      entry.items.sort((a, b) => {
        const da = `${a.date}T${a.time || "00:00"}`;
        const db = `${b.date}T${b.time || "00:00"}`;
        return da.localeCompare(db);
      });
    }

    // ordena usuários por nome
    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [filteredSessions]);

  const todayYMD = useMemo(() => getTodayYMD(nowMs), [nowMs]);

  const previewDates = useMemo(() => {
    if (!formData.date || !formData.totalSessions || formData.totalSessions < 1) return [];
    const base = new Date(formData.date + "T00:00:00");
    const out: string[] = [];
    for (let i = 0; i < Number(formData.totalSessions); i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 7);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [formData.date, formData.totalSessions]);

  const handleOpenDialog = (session?: SessionData) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        userId: session.userId.toString(),
        date: session.date,
        time: session.time,
        type: session.type,
        professional: session.professional,
        totalSessions: session.totalSessions ?? 1,
        status: session.status,
        notes: session.notes || "",
      });
    } else {
      setEditingSession(null);
      setFormData({
        userId: "",
        date: "",
        time: "",
        type: "",
        professional: "",
        totalSessions: 1,
        status: "agendada",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSession(null);
    setIsSaving(false);
    setFormData({
      userId: "",
      date: "",
      time: "",
      type: "",
      professional: "",
      totalSessions: 1,
      status: "agendada",
      notes: "",
    });
  };

  const doCreateRecurring = async () => {
    // Criação recorrente (semanal) no backend
    const userId = Number(formData.userId);
    if (!userId || !formData.date || !formData.time || !formData.professional.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione usuário, data, horário e profissional.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await adminCreateRecurringAppointments({
        user_id: userId,
        professional_name: formData.professional.trim(),
        start_date: formData.date,
        session_time: formData.time,
        quantity: Math.max(1, Number(formData.totalSessions) || 1),
      });

      await reloadFromBackend();
      emitAdminDataChanged();
      toast({
        title: "Sessões agendadas!",
        description: `Criadas ${Math.max(1, Number(formData.totalSessions) || 1)} sessões recorrentes.`,
      });
      handleCloseDialog();
    } catch (e) {
      const msg =
        isApiError(e) && e.status === 422
          ? "Verifique se já existe sessão no mesmo horário/datas geradas."
          : isApiError(e) && e.status === 403
          ? "Ação não permitida."
          : "Não foi possível agendar as sessões.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setCreateConfirmOpen(true);
  };

  const handleDelete = async (id: number) => {
    setDeleteTargetId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const id = deleteTargetId;
    if (!id) return;
    try {
      await adminDeleteAppointment(id);
      await reloadFromBackend();
      emitAdminDataChanged();
      toast({ title: "Sessão excluída", description: "A sessão foi removida permanentemente." });
    } catch (e) {
      const msg =
        isApiError(e) && e.status === 403
          ? "Ação não permitida."
          : "Não foi possível excluir esta sessão.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleMarkCompleted = async (id: number) => {
    try {
      await adminUpdateAppointmentStatus(id, "completed");
      await reloadFromBackend();
      emitAdminDataChanged();
      toast({ title: "Sessão marcada como realizada", description: "A sessão foi marcada como realizada." });
    } catch (e) {
      const msg =
        isApiError(e) && e.status === 403
          ? "Ação não permitida."
          : "Não foi possível marcar como realizada.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleToggleBlock = (id: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === "bloqueada" ? "agendada" : "bloqueada" } : s
      )
    );
  };

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
              Gerenciamento de Horários
            </h1>
            <p className="text-muted-foreground">Visualize, crie e gerencie horários de todos os usuários</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
            <Plus size={20} className="mr-2" />
            Novo Horário
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Buscar por usuário, tipo ou profissional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Accordion type="multiple" className="w-full">
            {sessionsByUser.map((group) => (
              <AccordionItem key={group.userId} value={`user-${group.userId}`} className="border rounded-xl bg-card">
                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{group.userName}</span>
                        {(() => {
                          // Bolinha: aparece se houver sessão agendada HOJE.
                          const alert = computeTodaySessionAlert({
                            sessions: group.items.filter((s) => s.status === "agendada"),
                            todayYMD,
                            nowMs,
                          });
                          if (!alert.show) return null;

                          return (
                            <span
                              className={[
                                "inline-block h-2.5 w-2.5 rounded-full bg-brand-orange",
                                alert.blink ? "animate-pulse" : "",
                              ].join(" ")}
                              title={
                                alert.nextSession?.time
                                  ? `Sessão hoje às ${alert.nextSession.time}${alert.blink ? " (próxima do horário)" : ""}`
                                  : "Sessão hoje"
                              }
                            />
                          );
                        })()}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {group.items.length} horários
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Clique para {/**/}ver/ocultar
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-4">
                    {(() => {
                      const agenda = group.items.filter((s) => s.status === "agendada");
                      const history = group.items.filter((s) => s.status !== "agendada");

                      const renderCard = (session: SessionData) => (
                        <div key={session.id} className="rounded-xl border border-border p-5 shadow-sm">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">{session.type}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {session.totalSessions} sessões
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground capitalize mb-2">{formatDate(session.date)}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {session.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User size={14} />
                                  {session.professional}
                                </span>
                              </div>
                              {session.notes && (
                                <p className="mt-2 text-sm text-muted-foreground italic">"{session.notes}"</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                                  statusConfig[session.status].color
                                }`}
                              >
                                {statusConfig[session.status].label}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenDialog(session)}>
                                <Edit size={16} className="mr-2" />
                                Editar
                              </Button>
                              {session.status === "agendada" && (
                                <Button variant="secondary" size="sm" onClick={() => void handleMarkCompleted(session.id)}>
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Realizada
                                </Button>
                              )}
                              <Button
                                variant={session.status === "bloqueada" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleBlock(session.id)}
                              >
                                {session.status === "bloqueada" ? (
                                  <>
                                    <Unlock size={16} className="mr-2" />
                                    Desbloquear
                                  </>
                                ) : (
                                  <>
                                    <Lock size={16} className="mr-2" />
                                    Bloquear
                                  </>
                                )}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(session.id)}>
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-foreground">Agenda</div>
                            {agenda.length > 0 ? (
                              <div className="space-y-4">{agenda.map(renderCard)}</div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Sem sessões agendadas.</div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-foreground">Histórico</div>
                            {history.length > 0 ? (
                              <div className="space-y-4">{history.map(renderCard)}</div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Sem sessões no histórico.</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {sessionsByUser.length === 0 && (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum horário encontrado</p>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSession ? "Editar Horário" : "Novo Horário"}</DialogTitle>
              <DialogDescription>
                {editingSession ? "Edite os detalhes do horário" : "Preencha os dados para criar um novo horário"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Usuário</Label>
                <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Input id="time" type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalSessions">Quantidade de sessões</Label>
                  <Input
                    id="totalSessions"
                    type="number"
                    min={1}
                    value={formData.totalSessions}
                    onChange={(e) => setFormData({ ...formData, totalSessions: Number(e.target.value) })}
                    placeholder="Ex: 6"
                  />
                </div>
                <div className="space-y-2" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="professional">Profissional</Label>
                <Input
                  id="professional"
                  value={formData.professional}
                  onChange={(e) => setFormData({ ...formData, professional: e.target.value })}
                  placeholder="Ex: Dra. Maria Silva"
                />
              </div>

              {/* Prévia das datas geradas (semanal) */}
              {previewDates.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium text-foreground mb-2">Prévia das datas (semanal):</p>
                  <div className="flex flex-wrap gap-2">
                    {previewDates.map((d) => (
                      <span key={d} className="text-xs px-2 py-1 rounded-full bg-background border border-border text-muted-foreground">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: SessionData["status"]) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendada">Agendada</SelectItem>
                    <SelectItem value="realizada">Realizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Adicione observações..." rows={3} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Criar sessões"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTargetId(null);
          }}
          title="Excluir sessão?"
          description="Esta ação é permanente."
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => void confirmDelete()}
        />

        <BrandedConfirmDialog
          open={createConfirmOpen}
          onOpenChange={setCreateConfirmOpen}
          title="Criar sessões?"
          description={`Criar ${Math.max(1, Number(formData.totalSessions) || 1)} sessão(ões) para a data ${formData.date} às ${formData.time}?`}
          confirmLabel={isSaving ? "Criando..." : "Criar"}
          cancelLabel="Cancelar"
          variant="default"
          onConfirm={() => void doCreateRecurring()}
        />
      </div>
    </div>
  );
};

export default AdminSessions;

