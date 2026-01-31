import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, Edit, Trash2, Search, Clock, User, Lock, Unlock, CheckCircle2, Link2, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { computeTodaySessionAlert, getJoinCountdownLabel, getTodayYMD } from "@/lib/session-alert";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { JoinSessionButton } from "@/components/JoinSessionButton";
import {
  adminCreateRecurringAppointments,
  adminDeleteAppointment,
  adminListAppointments,
  adminListProfessionals,
  adminListUsers,
  adminUpdateAppointmentStatus,
  appointmentCreateInviteLink,
  paymentLinksSign,
  isApiError,
} from "@/lib/laravel-api";
import type { JoinSessionMeta } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { emitAdminDataChanged } from "@/lib/admin-events";
import { useAuth } from "@/auth/AuthContext";

interface SessionData {
  id: number;
  userId: number;
  userName: string;
  date: string;
  time: string;
  type: string;
  professional: string;
  totalSessions: number;
  status: "realizada" | "agendada" | "avaliacao" | "cancelada" | "bloqueada";
  notes?: string;
  join_session?: JoinSessionMeta | null;
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
  avaliacao: {
    label: "Avaliação",
    color: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
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
  const navigate = useNavigate();
  const auth = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [formData, setFormData] = useState({
    userId: "",
    date: "",
    time: "",
    type: "",
    professional: "",
    professionalUserId: "__ADMIN__",
    totalSessions: 1,
    status: "agendada" as SessionData["status"],
    notes: "",
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [inviteGeneratingId, setInviteGeneratingId] = useState<number | null>(null);
  const [payLinkOpen, setPayLinkOpen] = useState(false);
  const [payLinkBusy, setPayLinkBusy] = useState(false);
  const [payCustomAmount, setPayCustomAmount] = useState<string>("");
  const [payCustomSessions, setPayCustomSessions] = useState<string>("");

  const [nowMs, setNowMs] = useState(() => Date.now());

  const packageCatalog = useMemo(() => {
    const list = [
      { sessions: 3, price: 280 },
      { sessions: 6, price: 480 },
      { sessions: 9, price: 560 },
      { sessions: 15, price: 880 },
      { sessions: 20, price: 1100 },
      { sessions: 35, price: 1750 },
      { sessions: 45, price: 2115 },
    ];
    const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return list.map((p) => ({ ...p, priceLabel: fmt(p.price), perSessionLabel: fmt(p.price / p.sessions) }));
  }, []);

  useEffect(() => {
    // 1s para o contador ao lado do "Entrar na sessão" descer em tempo real.
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Carrega usuários para o select (admin)
    let mounted = true;
    (async () => {
      try {
        const [list, pros] = await Promise.all([adminListUsers(), adminListProfessionals()]);
        const onlyUsers = list
          .filter((u) => u.role === "user")
          .map((u) => ({ id: u.id, name: u.name, email: u.email }));
        if (mounted) setUsers(onlyUsers);
        if (mounted) setProfessionals((pros ?? []).map((p) => ({ id: p.id, name: p.name, email: p.email })));
      } catch {
        // sem fallback fake: se falhar, apenas mantém vazio
        if (mounted) setUsers([]);
        if (mounted) setProfessionals([]);
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
      status:
        r.status === "completed"
          ? "realizada"
          : r.status === "canceled"
            ? "cancelada"
            : String((r as any).session_kind || "").toLowerCase() === "evaluation"
              ? "avaliacao"
              : "agendada",
      join_session: r.join_session ?? null,
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

  const todayYMD = useMemo(() => getTodayYMD(nowMs), [nowMs]);

  const sessionsByUser = useMemo(() => {
    const map = new Map<number, { userId: number; userName: string; items: SessionData[]; hasTodayAlert: boolean }>();
    for (const s of filteredSessions) {
      const key = s.userId || 0;
      const entry = map.get(key) || { userId: key, userName: s.userName || "—", items: [], hasTodayAlert: false };
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

      // bolinha laranja: sessão (agendada/avaliação) hoje
      entry.hasTodayAlert = entry.items.some(
        (s) => (s.status === "agendada" || s.status === "avaliacao") && s.date === todayYMD
      );
    }

    // ordena usuários: primeiro quem tem bolinha laranja (sessão hoje), depois alfabético
    return Array.from(map.values()).sort((a, b) => {
      if (a.hasTodayAlert !== b.hasTodayAlert) return a.hasTodayAlert ? -1 : 1;
      return a.userName.localeCompare(b.userName);
    });
  }, [filteredSessions, todayYMD]);

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
        professionalUserId: "", // compat: sessões antigas não têm id; admin pode ajustar ao editar
        totalSessions: session.totalSessions ?? 1,
        status: session.status === "avaliacao" ? "avaliacao" : "agendada",
        notes: session.notes || "",
      });
    } else {
      setEditingSession(null);
      setFormData({
        userId: "",
        date: "",
        time: "",
        type: "",
        professional: auth.user?.name ?? "Admin",
        professionalUserId: "__ADMIN__",
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
      professional: auth.user?.name ?? "Admin",
      professionalUserId: "__ADMIN__",
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
      const sessionKind =
        formData.status === "avaliacao" ? ("evaluation" as const) : ("scheduled" as const);
      await adminCreateRecurringAppointments({
        user_id: userId,
        professional_name: formData.professional.trim(),
        professional_user_id:
          formData.professionalUserId && formData.professionalUserId !== "__ADMIN__"
            ? Number(formData.professionalUserId)
            : null,
        start_date: formData.date,
        session_time: formData.time,
        quantity: Math.max(1, Number(formData.totalSessions) || 1),
        session_kind: sessionKind,
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

  const goToCall = (appointmentId: number) => navigate(`/sessao/${appointmentId}/chamada`);

  const handleGenerateInviteLink = async (appointmentId: number) => {
    setInviteGeneratingId(appointmentId);
    try {
      const res = await appointmentCreateInviteLink(appointmentId);
      const url = new URL(window.location.origin);
      url.pathname = `/sessao/${appointmentId}/chamada`;
      url.searchParams.set("invite_token", res.token);
      const link = url.toString();

      try {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Link gerado",
          description: "Link copiado. Envie para o paciente (ele vai confirmar o e-mail ao entrar).",
        });
      } catch {
        window.prompt("Copie o link e envie para o paciente:", link);
      }
    } catch {
      toast({
        title: "Erro ao gerar link",
        description: "Não foi possível gerar o link agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setInviteGeneratingId(null);
    }
  };

  const generatePaymentLink = async (amount: number, sessions: number | null) => {
    setPayLinkBusy(true);
    try {
      const title = sessions ? `Pacote ${sessions} sessões` : "Pagamento";
      const res = await paymentLinksSign({ amount, sessions, title });
      const url = new URL(window.location.origin);
      url.pathname = `/pagamento/publico`;
      url.searchParams.set("token", res.token);
      const link = url.toString();

      try {
        await navigator.clipboard.writeText(link);
        toast({ title: "Pagamento", description: "Link de pagamento copiado." });
      } catch {
        window.prompt("Copie o link de pagamento:", link);
      }
      setPayLinkOpen(false);
    } catch (e: any) {
      toast({
        title: "Pagamento",
        description:
          e && (e.data?.message || e.message)
            ? String(e.data?.message || e.message)
            : "Não foi possível gerar o link agora.",
        variant: "destructive",
      });
    } finally {
      setPayLinkBusy(false);
    }
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPayCustomAmount("");
                setPayCustomSessions("");
                setPayLinkOpen(true);
              }}
              className="w-full sm:w-auto"
              title="Gerar link de pagamento genérico (qualquer pessoa pode pagar)"
            >
              <Wallet size={18} className="mr-2" />
              Gerar link de pagamento
            </Button>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
              <Plus size={20} className="mr-2" />
              Novo Horário
            </Button>
          </div>
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
                            sessions: group.items.filter((s) => s.status === "agendada" || s.status === "avaliacao"),
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
                      const agenda = group.items.filter((s) => s.status === "agendada" || s.status === "avaliacao");
                      const history = group.items.filter((s) => s.status !== "agendada" && s.status !== "avaliacao");

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
                              <JoinSessionButton
                                meta={session.join_session}
                                date={session.date}
                                time={session.time}
                                nowMs={nowMs}
                                onClick={() => goToCall(session.id)}
                              />
                              {(session.status === "agendada" || session.status === "avaliacao") && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-auto px-3 py-2 rounded-xl"
                                  onClick={() => void handleGenerateInviteLink(session.id)}
                                  disabled={inviteGeneratingId === session.id}
                                  title="Gerar link para o paciente entrar sem login"
                                >
                                  <Link2 size={16} className="mr-2" />
                                  {inviteGeneratingId === session.id ? "Gerando..." : "Gerar link"}
                                </Button>
                              )}
                              {(session.status === "agendada" || session.status === "avaliacao") && (
                                null
                              )}
                              {(() => {
                                const countdown = getJoinCountdownLabel({
                                  date: session.date,
                                  time: session.time,
                                  nowMs,
                                });
                                const showCountdown = session.join_session
                                  ? session.join_session.visible
                                  : countdown.active;
                                if (!showCountdown || !countdown.label) return null;
                                return (
                                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                    {countdown.label}
                                  </span>
                                );
                              })()}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenDialog(session)}>
                                <Edit size={16} className="mr-2" />
                                Editar
                              </Button>
                              {(session.status === "agendada" || session.status === "avaliacao") && (
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

        {/* Link de pagamento (fora da transmissão) */}
        <Dialog
          open={payLinkOpen}
          onOpenChange={(open) => {
            setPayLinkOpen(open);
            if (!open) {
              setPayLinkBusy(false);
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerar link de pagamento</DialogTitle>
              <DialogDescription>
                Escolha um pacote ou valor personalizado. O link pode ser enviado para qualquer pessoa pagar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold text-foreground">Personalizado</div>
                <div className="text-xs text-muted-foreground">Defina um valor e gere um link para o paciente pagar.</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Valor total (R$)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="Ex.: 560,00"
                      value={payCustomAmount}
                      onChange={(e) => setPayCustomAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sessões (opcional)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Ex.: 9"
                      value={payCustomSessions}
                      onChange={(e) => setPayCustomSessions(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <Button
                    className="rounded-lg"
                    disabled={payLinkBusy}
                    onClick={() => {
                      const raw = String(payCustomAmount || "").trim();
                      const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
                      const amount = Number(cleaned);
                      const sRaw = payCustomSessions.replace(/\D/g, "");
                      const sNum = sRaw ? Number(sRaw) : 0;
                      const sessions = Number.isFinite(sNum) && sNum > 0 ? sNum : null;
                      if (!Number.isFinite(amount) || amount <= 0) {
                        toast({ title: "Pagamento", description: "Informe um valor válido.", variant: "destructive" });
                        return;
                      }
                      void generatePaymentLink(amount, sessions);
                    }}
                  >
                    {payLinkBusy ? "Gerando..." : "Gerar link"}
                  </Button>
                </div>
              </div>

              {packageCatalog.map((p) => (
                <div key={`pkg-${p.sessions}`} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{p.sessions} sessões</div>
                      <div className="text-xs text-muted-foreground">
                        Total: {p.priceLabel} • {p.perSessionLabel}/sessão
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-lg"
                      disabled={payLinkBusy}
                      onClick={() => {
                        void generatePaymentLink(p.price, p.sessions);
                      }}
                    >
                      {payLinkBusy ? "Gerando..." : "Gerar link"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              O paciente pagará em uma página separada (Pix ou cartão) com formulário antes do método.
            </div>
          </DialogContent>
        </Dialog>

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
                <Select
                  value={formData.professionalUserId}
                  onValueChange={(v) => {
                    if (v === "__ADMIN__") {
                      setFormData((p) => ({ ...p, professionalUserId: v, professional: auth.user?.name ?? "Admin" }));
                      return;
                    }
                    const pid = Number(v);
                    const pro = professionals.find((x) => x.id === pid);
                    setFormData((p) => ({ ...p, professionalUserId: v, professional: pro?.name ?? p.professional }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ADMIN__">Admin (eu)</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="avaliacao">Avaliação</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">Define se este horário é uma sessão normal (Agendada) ou uma Avaliação.</div>
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

