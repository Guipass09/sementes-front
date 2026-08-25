import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Search, Clock, CalendarClock, CheckCircle2, MessageSquareText, Eye, EyeOff, Wallet, RefreshCcw, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import ClinicProfessionalAppointmentsPanel from "@/components/ClinicProfessionalAppointmentsPanel";
import * as api from "@/lib/laravel-api";
import type { JoinSessionMeta } from "@/lib/laravel-api";
import { JoinSessionButton } from "@/components/JoinSessionButton";
import { BLINK_AFTER_MINUTES, BLINK_BEFORE_MINUTES, getJoinCountdownLabel, getTodayYMD, parseLocalDateTime } from "@/lib/session-alert";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { buildLiveSessionInviteShareText, buildLiveSessionInviteUrl } from "@/lib/live-session-invite";

type ProAppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string;
  session_time: string;
  total_sessions: number;
  status: string;
  session_kind?: string | null;
  join_session?: JoinSessionMeta | null;
  user?: {
    id: number;
    name: string;
    email: string;
    profile_photo_url?: string | null;
    responsible_name?: string | null;
    child_name?: string | null;
    child_birthdate?: string | null;
    child_age?: number | null;
  } | null;
};

const patientDisplayName = (u: { name: string; child_name?: string | null }) => (u.child_name?.trim() ? u.child_name.trim() : u.name);

export default function ProfessionalSessions(): JSX.Element {
  const auth = useAuth();
  const clinicName = String(auth.user?.clinic_name ?? "").trim();
  if (clinicName) {
    return <ClinicProfessionalAppointmentsPanel mode="active" />;
  }

  return <StandardProfessionalSessions />;
}

function StandardProfessionalSessions(): JSX.Element {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProAppointmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earnings, setEarnings] = useState<null | {
    from_date: string;
    to_date: string;
    total: number;
    counts: { scheduled: number; evaluation: number };
    amounts: { scheduled: number; evaluation: number };
  }>(null);
  const [earningsHidden, setEarningsHidden] = useState(true);

  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedSaving, setReschedSaving] = useState(false);
  const [reschedAppt, setReschedAppt] = useState<ProAppointmentRow | null>(null);
  const [reschedDate, setReschedDate] = useState<Date | undefined>(undefined);
  const [reschedTime, setReschedTime] = useState<string>("");
  const [inviteGeneratingId, setInviteGeneratingId] = useState<number | null>(null);
  const [payLinkOpen, setPayLinkOpen] = useState(false);
  const [payLinkBusy, setPayLinkBusy] = useState(false);
  const [payCustomAmount, setPayCustomAmount] = useState<string>("");
  const [payCustomSessions, setPayCustomSessions] = useState<string>("");

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.professionalListAppointments();
      // Filtrar apenas sessões agendadas (active) - excluir realizadas (completed) e canceladas (canceled)
      const all = (res.data ?? []) as any[];
      const activeOnly = all.filter((r) => String(r.status || "").toLowerCase() === "active");
      setRows(activeOnly as any);
    } finally {
      setLoading(false);
    }
  };

  const refreshEarnings = async () => {
    setEarningsLoading(true);
    try {
      const res = await api.professionalGetEarningsLast30Days();
      setEarnings(res);
    } catch {
      setEarnings(null);
    } finally {
      setEarningsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void refresh();
    void refreshEarnings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Atualizar lista quando a página ganha foco (ex: quando volta do histórico após marcar como realizada)
  useEffect(() => {
    const handleFocus = () => {
      void refresh();
      void refreshEarnings();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.user?.name ?? "").toLowerCase();
      const email = (r.user?.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, search]);

  const todayYMD = useMemo(() => getTodayYMD(nowMs), [nowMs]);

  const groupedByUser = useMemo(() => {
    const map = new Map<
      number,
      { userId: number; userName: string; userEmail?: string; profile_photo_url?: string | null; items: ProAppointmentRow[]; hasTodaySession: boolean; earliestTodayTime: string | null }
    >();
    for (const r of filtered) {
      const userId = r.user?.id ?? r.user_id ?? 0;
      const entry = map.get(userId) || {
        userId,
        userName: r.user ? patientDisplayName(r.user) : `Usuário #${r.user_id}`,
        userEmail: r.user?.email ?? undefined,
        profile_photo_url: r.user?.profile_photo_url ?? null,
        items: [],
        hasTodaySession: false,
        earliestTodayTime: null,
      };
      entry.items.push(r);
      map.set(userId, entry);
    }
    
    // Ordenar sessões de cada paciente e verificar se tem sessão hoje
    for (const entry of map.values()) {
      entry.items.sort((a, b) => `${a.session_date}T${a.session_time}`.localeCompare(`${b.session_date}T${b.session_time}`));
      
      // Verificar se tem sessão hoje e pegar o horário mais cedo
      const todaySessions = entry.items.filter((s) => s.session_date === todayYMD);
      if (todaySessions.length > 0) {
        entry.hasTodaySession = true;
        // Pegar o horário mais cedo do dia
        const sortedToday = [...todaySessions].sort((a, b) => a.session_time.localeCompare(b.session_time));
        entry.earliestTodayTime = sortedToday[0].session_time;
      }
    }
    
    // Ordenar: pacientes com sessão hoje primeiro (por horário), depois os demais (alfabético)
    return Array.from(map.values()).sort((a, b) => {
      // Se ambos têm sessão hoje, ordenar por horário mais cedo
      if (a.hasTodaySession && b.hasTodaySession) {
        if (a.earliestTodayTime && b.earliestTodayTime) {
          return a.earliestTodayTime.localeCompare(b.earliestTodayTime);
        }
        return 0;
      }
      // Se só 'a' tem sessão hoje, vem primeiro
      if (a.hasTodaySession && !b.hasTodaySession) return -1;
      // Se só 'b' tem sessão hoje, vem primeiro
      if (!a.hasTodaySession && b.hasTodaySession) return 1;
      // Se nenhum tem sessão hoje, ordem alfabética
      return a.userName.localeCompare(b.userName);
    });
  }, [filtered, todayYMD]);

  const goToCall = (appointmentId: number) => navigate(`/sessao/${appointmentId}/chamada`);

  const handleGenerateInviteLink = async (appointmentId: number) => {
    setInviteGeneratingId(appointmentId);
    try {
      const res = await api.appointmentCreateInviteLink(appointmentId);
      const link = buildLiveSessionInviteUrl(appointmentId, res.token);
      const shareText = buildLiveSessionInviteShareText(link);

      try {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link gerado",
          description: "Mensagem com link copiada. Envie para o paciente.",
        });
      } catch {
        window.prompt("Copie a mensagem e envie para o paciente:", shareText);
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

  const statusConfig = {
    realizada: { label: "Realizada", color: "bg-brand-green/10 text-brand-green border-brand-green/20", icon: CheckCircle2 },
    agendada: { label: "Agendada", color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20", icon: CalendarClock },
    avaliacao: { label: "Avaliação", color: "bg-brand-purple/10 text-brand-purple border-brand-purple/20", icon: CalendarClock },
    cancelada: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Calendar },
  } as const;

  const mapStatus = (raw: string, kind?: string | null) =>
    (raw === "completed"
      ? "realizada"
      : raw === "canceled"
        ? "cancelada"
        : String(kind || "").toLowerCase() === "evaluation"
          ? "avaliacao"
          : "agendada") as const;

  const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    return list.map((p) => ({ ...p, priceLabel: fmtMoney(p.price), perSessionLabel: fmtMoney(p.price / p.sessions) }));
  }, []);

  const generatePaymentLink = async (amount: number, sessions: number | null) => {
    setPayLinkBusy(true);
    try {
      const title = sessions ? `Pacote ${sessions} sessões` : "Pagamento";
      const res = await api.paymentLinksSign({ amount, sessions, title });
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
        description: e && (e.data?.message || e.message) ? String(e.data?.message || e.message) : "Não foi possível gerar o link agora.",
        variant: "destructive",
      });
    } finally {
      setPayLinkBusy(false);
    }
  };

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Sessões</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Visualize suas sessões agendadas e entre na transmissão ao vivo.</p>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setPayCustomAmount("");
                setPayCustomSessions("");
                setPayLinkOpen(true);
              }}
              title="Gerar link de pagamento genérico (qualquer pessoa pode pagar)"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Gerar link de pagamento
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Wallet className="h-4 w-4 text-brand-green" />
                  Ganhos (últimos 30 dias)
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avaliação realizada: R$ 20 • Sessão agendada realizada: R$ 40
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-background/70 p-2 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                onClick={() => setEarningsHidden((v) => !v)}
                title={earningsHidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {earningsHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            {earningsLoading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : earnings ? (
              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground">
                  {earningsHidden ? "••••" : fmtMoney(earnings.total)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <div>
                    Avaliações: {earnings.counts.evaluation} • {earningsHidden ? "••••" : fmtMoney(earnings.amounts.evaluation)}
                  </div>
                  <div>
                    Agendadas: {earnings.counts.scheduled} • {earningsHidden ? "••••" : fmtMoney(earnings.amounts.scheduled)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">Não foi possível carregar os ganhos agora.</div>
            )}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente (nome ou email)..." className="pl-9 sm:pl-11 text-sm sm:text-base" />
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
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma sessão agendada para você ainda.</p>
          </div>
        ) : (
          groupedByUser.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum resultado para essa busca.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3 sm:space-y-4">
              {groupedByUser.map((u) => (
                <AccordionItem key={u.userId} value={String(u.userId)} className="bg-card rounded-xl border border-border px-3 sm:px-4 md:px-5">
                  <AccordionTrigger className="py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                        {u.profile_photo_url ? (
                          <img src={normalizeMediaUrl(u.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.userName.split(" ").map((n) => n[0]).join("").slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm sm:text-base text-foreground truncate flex items-center gap-1.5 sm:gap-2">
                          {u.userName}
                          <button
                            type="button"
                            className="ml-1 inline-flex items-center justify-center rounded-md border border-border bg-background/70 p-1.5 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            title="Ver comentário do admin"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/profissional/pacientes/${u.userId}/comentario`);
                            }}
                          >
                            <MessageSquareText className="h-4 w-4" />
                          </button>
                          {u.hasTodaySession && (() => {
                            // Verificar se alguma sessão está no período de blink
                            const hasBlinkingSession = u.items.some((s) => {
                              if (s.session_date !== todayYMD) return false;
                              const startMs = parseLocalDateTime(s.session_date, s.session_time);
                              return (
                                startMs !== null &&
                                nowMs >= startMs - BLINK_BEFORE_MINUTES * 60_000 &&
                                nowMs <= startMs + BLINK_AFTER_MINUTES * 60_000
                              );
                            });
                            return (
                              <span
                                className={[
                                  "inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-brand-orange flex-shrink-0",
                                  hasBlinkingSession ? "animate-pulse" : "",
                                ].join(" ")}
                                title="Atendimento hoje"
                              />
                            );
                          })()}
                        </div>
                        {u.userEmail ? <div className="text-xs text-muted-foreground truncate">{u.userEmail}</div> : null}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 sm:pb-5">
                    <div className="space-y-2 sm:space-y-3">
                      {u.items.map((s) => {
                        const st = mapStatus(s.status, s.session_kind);
                        const StatusIcon = statusConfig[st].icon;
                        const showDot = s.session_date === todayYMD;
                        const startMs = parseLocalDateTime(s.session_date, s.session_time);
                        const shouldRevealBlink =
                          startMs !== null &&
                          nowMs >= startMs - BLINK_BEFORE_MINUTES * 60_000 &&
                          nowMs <= startMs + BLINK_AFTER_MINUTES * 60_000;

                        return (
                          <div key={s.id} className="rounded-lg border border-border p-3 sm:p-4 bg-background/60">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-1.5 sm:gap-2">
                                  Sessão
                                  {showDot && (
                                    <span
                                      className={[
                                        "inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-brand-orange",
                                        shouldRevealBlink ? "animate-pulse" : "",
                                      ].join(" ")}
                                      title={s.session_time ? `Sessão hoje às ${s.session_time}` : "Sessão hoje"}
                                    />
                                  )}
                                </div>
                                <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                                    {s.session_date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                                    {s.session_time}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end">
                                <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border ${statusConfig[st].color}`}>
                                  <StatusIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                                  {statusConfig[st].label}
                                </div>
                                <JoinSessionButton
                                  meta={s.join_session}
                                  date={s.session_date}
                                  time={s.session_time}
                                  nowMs={nowMs}
                                  onClick={() => goToCall(s.id)}
                                />
                                {(st === "agendada" || st === "avaliacao") && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg"
                                    onClick={() => void handleGenerateInviteLink(s.id)}
                                    disabled={inviteGeneratingId === s.id}
                                    title="Gerar link para o paciente entrar sem login"
                                  >
                                    <Link2 className="h-3.5 w-3.5 mr-2" />
                                    {inviteGeneratingId === s.id ? "Gerando..." : "Gerar link"}
                                  </Button>
                                )}
                                {(st === "agendada" || st === "avaliacao") && (
                                  null
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                  onClick={() => {
                                    setReschedAppt(s);
                                    setReschedDate(new Date(`${s.session_date}T00:00:00`));
                                    setReschedTime((s.session_time || "").slice(0, 5));
                                    setReschedOpen(true);
                                  }}
                                  title="Reagendar sessão"
                                >
                                  <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                                  Reagendar
                                </Button>
                                {(() => {
                                  const countdown = getJoinCountdownLabel({
                                    date: s.session_date,
                                    time: s.session_time,
                                    nowMs,
                                  });
                                  const showCountdown = s.join_session ? s.join_session.visible : countdown.active;
                                  if (!showCountdown || !countdown.label) return null;
                                  return (
                                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-muted text-muted-foreground">
                                      {countdown.label}
                                    </span>
                                  );
                                })()}
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
          )
        )}
      </div>

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

      <Dialog
        open={reschedOpen}
        onOpenChange={(open) => {
          setReschedOpen(open);
          if (!open) {
            setReschedSaving(false);
            setReschedAppt(null);
            setReschedDate(undefined);
            setReschedTime("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            Escolha a nova data e horário. O horário atual será substituído.
          </div>

          <div className="mt-3">
            <Calendar
              mode="single"
              selected={reschedDate}
              onSelect={(d) => setReschedDate(d ?? undefined)}
              disabled={(d) => d < new Date(new Date().toDateString())}
            />
          </div>

          <div className="mt-3 space-y-2">
            <Label htmlFor="reschedTime">Horário</Label>
            <Input
              id="reschedTime"
              type="time"
              value={reschedTime}
              onChange={(e) => setReschedTime(e.target.value)}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setReschedOpen(false)} disabled={reschedSaving}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={reschedSaving || !reschedAppt || !reschedDate || !reschedTime}
              onClick={async () => {
                if (!reschedAppt || !reschedDate || !reschedTime) return;
                const ymd = reschedDate.toISOString().slice(0, 10);
                setReschedSaving(true);
                try {
                  await api.professionalRescheduleAppointment(reschedAppt.id, {
                    session_date: ymd,
                    session_time: reschedTime,
                  });
                  toast({ title: "Reagendado", description: "Sessão reagendada com sucesso." });
                  setReschedOpen(false);
                  await refresh();
                } catch (e: any) {
                  const msg = String(e?.message || "") || "Não foi possível reagendar. Tente novamente.";
                  toast({ title: "Erro", description: msg.includes("422") ? "Escolha outro horário disponível." : msg, variant: "destructive" });
                } finally {
                  setReschedSaving(false);
                }
              }}
            >
              {reschedSaving ? "Salvando..." : "Reagendar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
