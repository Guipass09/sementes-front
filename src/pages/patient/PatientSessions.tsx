import { Calendar, Clock, CheckCircle2, CalendarClock, User, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/hooks/use-access-control";
import AccessBlocked from "@/components/AccessBlocked";
import { useEffect, useMemo, useState } from "react";
import { isApiError, userListAppointments } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { BLINK_AFTER_MINUTES, BLINK_BEFORE_MINUTES, getTodayYMD, parseLocalDateTime } from "@/lib/session-alert";
import type { JoinSessionMeta } from "@/lib/laravel-api";
import { JoinSessionButton } from "@/components/JoinSessionButton";

interface Session {
  id: number;
  date: string;
  time: string;
  type: string;
  professional: string;
  status: "realizada" | "agendada" | "cancelada";
  notes?: string;
  join_session?: JoinSessionMeta | null;
}

const statusConfig = {
  realizada: {
    label: "Realizada",
    color: "bg-brand-green/10 text-brand-green border-brand-green/20",
    icon: CheckCircle2,
  },
  agendada: {
    label: "Agendada",
    color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
    icon: CalendarClock,
  },
  cancelada: {
    label: "Cancelada",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: Calendar,
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

const PatientSessions = () => {
  const { checkAccess } = useAccessControl();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, used: 0, remaining: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await userListAppointments();
        const mapped: Session[] = res.data.map((s) => ({
          id: s.id,
          date: s.date,
          time: s.time,
          type: "Sessão",
          professional: s.professional_name,
          status: s.status === "completed" ? "realizada" : s.status === "canceled" ? "cancelada" : "agendada",
          join_session: s.join_session ?? null,
        }));
        if (mounted) {
          setSessions(mapped);
          setSummary({
            total: res.summary.total_contracted,
            used: res.summary.used_sessions,
            remaining: res.summary.remaining_sessions,
          });
        }
      } catch (e) {
        const msg =
          isApiError(e) && e.status === 401
            ? "Faça login novamente."
            : "Não foi possível carregar suas sessões.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const upcomingSessions = useMemo(() => sessions.filter((s) => s.status === "agendada"), [sessions]);
  const pastSessions = useMemo(() => sessions.filter((s) => s.status !== "agendada"), [sessions]);
  const todayYMD = useMemo(() => getTodayYMD(nowMs), [nowMs]);
  const goToCall = (appointmentId: number) => navigate(`/sessao/${appointmentId}/chamada`);

  if (!checkAccess("horarios")) {
    return <AccessBlocked pageName="Horários" />;
  }

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
            Sessões
          </h1>
          <p className="text-muted-foreground">
            Visualize suas sessões agendadas e histórico de atendimentos
          </p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground">Total contratadas</p>
            <p className="text-2xl font-bold text-foreground">{summary.total}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground">Utilizadas</p>
            <p className="text-2xl font-bold text-foreground">{summary.used}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-sm text-muted-foreground">Restantes</p>
            <p className="text-2xl font-bold text-foreground">{summary.remaining}</p>
          </div>
        </div>

        {/* Upcoming Sessions */}
        {!loading && upcomingSessions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarClock size={20} className="text-brand-blue" />
              Próximas Sessões
            </h2>
            <div className="space-y-4">
              {upcomingSessions.map((session, index) => {
                const StatusIcon = statusConfig[session.status].icon;
                const showDot = session.date === todayYMD;
                const startMs = parseLocalDateTime(session.date, session.time);
                const shouldRevealBlink =
                  startMs !== null &&
                  nowMs >= startMs - BLINK_BEFORE_MINUTES * 60_000 &&
                  nowMs <= startMs + BLINK_AFTER_MINUTES * 60_000;
                return (
                  <div
                    key={session.id}
                    className="bg-gradient-to-r from-brand-blue/5 to-transparent rounded-xl border border-brand-blue/20 p-5 shadow-sm animate-fade-in"
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Date Badge */}
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-brand-blue/10 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-brand-blue">
                          {new Date(session.date + "T00:00:00").getDate()}
                        </span>
                        <span className="text-xs text-brand-blue uppercase">
                          {new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                          {session.type}
                          {showDot && (
                            <span
                              className={[
                                "inline-block h-2.5 w-2.5 rounded-full bg-brand-orange",
                                shouldRevealBlink ? "animate-pulse" : "",
                              ].join(" ")}
                              title={
                                session?.time
                                  ? `Sessão hoje às ${session.time}${shouldRevealBlink ? " (próxima do horário)" : ""}`
                                  : "Sessão hoje"
                              }
                            />
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground capitalize mb-2">
                          {formatDate(session.date)}
                        </p>
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
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig[session.status].color}`}
                        >
                          <StatusIcon size={14} />
                          {statusConfig[session.status].label}
                        </div>
                        <JoinSessionButton meta={session.join_session} onClick={() => goToCall(session.id)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past Sessions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-brand-green" />
            Histórico de Sessões
          </h2>
          <div className="space-y-4">
            {pastSessions.map((session, index) => {
              const StatusIcon = statusConfig[session.status].icon;
              return (
                <div
                  key={session.id}
                  className="bg-card rounded-xl border border-border p-5 shadow-sm animate-fade-in"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Date Badge */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-muted flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">
                        {new Date(session.date + "T00:00:00").getDate()}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase">
                        {new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{session.type}</h3>
                      <p className="text-sm text-muted-foreground capitalize mb-2">
                        {formatDate(session.date)}
                      </p>
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
                        <p className="mt-2 text-sm text-muted-foreground italic">
                          "{session.notes}"
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig[session.status].color}`}
                      >
                        <StatusIcon size={14} />
                        {statusConfig[session.status].label}
                      </div>
                      <JoinSessionButton meta={session.join_session} onClick={() => goToCall(session.id)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Add Sessions Button */}
      <Link to="/paciente/pacotes">
        <Button
          className="fixed bottom-6 right-6 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 z-50"
        >
          <Plus size={20} className="mr-2" />
          Adicionar Sessões
        </Button>
      </Link>
    </div>
  );
};

export default PatientSessions;
