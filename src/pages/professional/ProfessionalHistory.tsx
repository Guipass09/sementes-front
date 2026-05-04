import { useEffect, useMemo, useState } from "react";
import { Calendar, Search, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/auth/AuthContext";
import ClinicProfessionalAppointmentsPanel from "@/components/ClinicProfessionalAppointmentsPanel";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type ProAppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string;
  session_time: string;
  total_sessions: number;
  status: string;
  user?: { id: number; name: string; email: string; profile_photo_url?: string | null } | null;
};

export default function ProfessionalHistory(): JSX.Element {
  const auth = useAuth();
  const clinicName = String(auth.user?.clinic_name ?? "").trim();
  if (clinicName) {
    return <ClinicProfessionalAppointmentsPanel mode="history" />;
  }

  return <StandardProfessionalHistory />;
}

function StandardProfessionalHistory(): JSX.Element {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProAppointmentRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.professionalListAppointments();
        if (cancelled) return;
        const all = (res.data ?? []) as any[];
        // Mostrar apenas sessões realizadas (completed) e canceladas (canceled)
        const past = all.filter((r) => {
          const status = String(r.status || "").toLowerCase();
          return status === "completed" || status === "canceled";
        });
        setRows(past as any);
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
      entry.items.sort((a, b) => `${b.session_date}T${b.session_time}`.localeCompare(`${a.session_date}T${a.session_time}`));
    }
    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [filtered]);

  const statusLabel = (raw: string) => (raw === "completed" ? "Finalizada" : raw === "canceled" ? "Cancelada" : "—");
  const statusClass = (raw: string) =>
    raw === "completed"
      ? "bg-brand-green/10 text-brand-green border-brand-green/20"
      : raw === "canceled"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : "bg-muted text-muted-foreground border-border";

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Histórico</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Sessões já realizadas (finalizadas) e canceladas.</p>
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
            <CheckCircle2 size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma sessão no histórico ainda.</p>
          </div>
        ) : groupedByUser.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
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
                      <div className="font-semibold text-sm sm:text-base text-foreground truncate">{u.userName}</div>
                      {u.userEmail ? <div className="text-xs text-muted-foreground truncate">{u.userEmail}</div> : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 sm:pb-5">
                  <div className="space-y-2 sm:space-y-3">
                    {u.items.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border p-3 sm:p-4 bg-background/60">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm sm:text-base text-foreground">Sessão</div>
                            <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="sm:w-3.5 sm:h-3.5" />
                                {s.session_date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                                {s.session_time}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start sm:justify-end">
                            <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border ${statusClass(s.status)}`}>
                              <CheckCircle2 size={12} className="sm:w-3.5 sm:h-3.5" />
                              {statusLabel(s.status)}
                            </div>
                            <button
                              className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => navigate(`/profissional/pacientes`)}
                              type="button"
                            >
                              Ver pacientes
                            </button>
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
    </div>
  );
}
