import { useEffect, useMemo, useState } from "react";
import { Calendar, Search, Clock, CalendarClock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as api from "@/lib/laravel-api";
import type { JoinSessionMeta } from "@/lib/laravel-api";
import { JoinSessionButton } from "@/components/JoinSessionButton";
import { BLINK_AFTER_MINUTES, BLINK_BEFORE_MINUTES, getJoinCountdownLabel, getTodayYMD, parseLocalDateTime } from "@/lib/session-alert";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type ProAppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string;
  session_time: string;
  total_sessions: number;
  status: string;
  join_session?: JoinSessionMeta | null;
  user?: { id: number; name: string; email: string; profile_photo_url?: string | null } | null;
};

export default function ProfessionalSessions(): JSX.Element {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProAppointmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.professionalListAppointments();
        if (cancelled) return;
        setRows((res.data ?? []) as any);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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

  const groupedByUser = useMemo(() => {
    const map = new Map<
      number,
      { userId: number; userName: string; userEmail?: string; profile_photo_url?: string | null; items: ProAppointmentRow[] }
    >();
    for (const r of filtered) {
      const userId = r.user?.id ?? r.user_id ?? 0;
      const entry = map.get(userId) || {
        userId,
        userName: r.user?.name ?? `Usuário #${r.user_id}`,
        userEmail: r.user?.email ?? undefined,
        profile_photo_url: r.user?.profile_photo_url ?? null,
        items: [],
      };
      entry.items.push(r);
      map.set(userId, entry);
    }
    for (const entry of map.values()) {
      entry.items.sort((a, b) => `${a.session_date}T${a.session_time}`.localeCompare(`${b.session_date}T${b.session_time}`));
    }
    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [filtered]);

  const todayYMD = useMemo(() => getTodayYMD(nowMs), [nowMs]);
  const goToCall = (appointmentId: number) => navigate(`/sessao/${appointmentId}/chamada`);

  const statusConfig = {
    realizada: { label: "Realizada", color: "bg-brand-green/10 text-brand-green border-brand-green/20", icon: CheckCircle2 },
    agendada: { label: "Agendada", color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20", icon: CalendarClock },
    cancelada: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Calendar },
  } as const;

  const mapStatus = (raw: string) => (raw === "completed" ? "realizada" : raw === "canceled" ? "cancelada" : "agendada") as const;

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Sessões</h1>
          <p className="text-muted-foreground">Visualize suas sessões agendadas e entre na transmissão ao vivo.</p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente (nome ou email)..." className="pl-11" />
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
            <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma sessão agendada para você ainda.</p>
          </div>
        ) : (
          groupedByUser.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum resultado para essa busca.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-4">
              {groupedByUser.map((u) => (
                <AccordionItem key={u.userId} value={String(u.userId)} className="bg-card rounded-xl border border-border px-5">
                  <AccordionTrigger className="py-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold">
                        {u.profile_photo_url ? (
                          <img src={normalizeMediaUrl(u.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.userName.split(" ").map((n) => n[0]).join("").slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">{u.userName}</div>
                        {u.userEmail ? <div className="text-xs text-muted-foreground">{u.userEmail}</div> : null}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <div className="space-y-3">
                      {u.items.map((s) => {
                        const st = mapStatus(s.status);
                        const StatusIcon = statusConfig[st].icon;
                        const showDot = s.session_date === todayYMD;
                        const startMs = parseLocalDateTime(s.session_date, s.session_time);
                        const shouldRevealBlink =
                          startMs !== null &&
                          nowMs >= startMs - BLINK_BEFORE_MINUTES * 60_000 &&
                          nowMs <= startMs + BLINK_AFTER_MINUTES * 60_000;

                        return (
                          <div key={s.id} className="rounded-lg border border-border p-4 bg-background/60">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground flex items-center gap-2">
                                  Sessão
                                  {showDot && (
                                    <span
                                      className={[
                                        "inline-block h-2.5 w-2.5 rounded-full bg-brand-orange",
                                        shouldRevealBlink ? "animate-pulse" : "",
                                      ].join(" ")}
                                      title={s.session_time ? `Sessão hoje às ${s.session_time}` : "Sessão hoje"}
                                    />
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-4 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {s.session_date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {s.session_time}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig[st].color}`}>
                                  <StatusIcon size={14} />
                                  {statusConfig[st].label}
                                </div>
                                <JoinSessionButton
                                  meta={s.join_session}
                                  date={s.session_date}
                                  time={s.session_time}
                                  nowMs={nowMs}
                                  onClick={() => goToCall(s.id)}
                                />
                                {(() => {
                                  const countdown = getJoinCountdownLabel({
                                    date: s.session_date,
                                    time: s.session_time,
                                    nowMs,
                                  });
                                  const showCountdown = s.join_session ? s.join_session.visible : countdown.active;
                                  if (!showCountdown || !countdown.label) return null;
                                  return (
                                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
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
    </div>
  );
}

