import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, CalendarClock, CheckCircle2, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ClinicProfessionalScopeSelector from "@/components/ClinicProfessionalScopeSelector";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import * as api from "@/lib/laravel-api";

type ClinicAppointmentsMode = "active" | "history";

type AppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string;
  session_time: string;
  total_sessions: number;
  status: string;
  session_kind?: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    profile_photo_url?: string | null;
    responsible_name?: string | null;
    child_name?: string | null;
  } | null;
};

const patientDisplayName = (u: { name: string; child_name?: string | null }) => (u.child_name?.trim() ? u.child_name.trim() : u.name);

export default function ClinicProfessionalAppointmentsPanel(props: {
  mode: ClinicAppointmentsMode;
}): JSX.Element {
  const { mode } = props;
  const [loading, setLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [professionals, setProfessionals] = useState<api.ClinicProfessionalRow[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfessionalsLoading(true);
    void api
      .clinicListProfessionals()
      .then((res) => {
        if (cancelled) return;
        setProfessionals(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setProfessionals([]);
      })
      .finally(() => {
        if (!cancelled) setProfessionalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (professionals.length === 0) {
      setSelectedProfessionalId(null);
      return;
    }

    if (selectedProfessionalId === null || !professionals.some((professional) => professional.id === selectedProfessionalId)) {
      setSelectedProfessionalId(professionals[0].id);
    }
  }, [professionals, selectedProfessionalId]);

  useEffect(() => {
    if (!selectedProfessionalId) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .professionalListAppointments({ professional_user_id: selectedProfessionalId })
      .then((res) => {
        if (cancelled) return;
        const all = (res.data ?? []) as AppointmentRow[];
        const filteredByMode =
          mode === "active"
            ? all.filter((row) => String(row.status || "").toLowerCase() === "active")
            : all.filter((row) => {
                const status = String(row.status || "").toLowerCase();
                return status === "completed" || status === "canceled";
              });
        setRows(filteredByMode);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, selectedProfessionalId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (row.user ? patientDisplayName(row.user) : "").toLowerCase();
      const email = (row.user?.email ?? "").toLowerCase();
      const responsible = (row.user?.responsible_name ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || responsible.includes(q);
    });
  }, [rows, search]);

  const groupedByUser = useMemo(() => {
    const map = new Map<
      number,
      { userId: number; userName: string; userEmail?: string; profile_photo_url?: string | null; items: AppointmentRow[] }
    >();

    for (const row of filtered) {
      const userId = row.user?.id ?? row.user_id ?? 0;
      const entry = map.get(userId) || {
        userId,
        userName: row.user ? patientDisplayName(row.user) : `Usuário #${row.user_id}`,
        userEmail: row.user?.email ?? undefined,
        profile_photo_url: row.user?.profile_photo_url ?? null,
        items: [],
      };
      entry.items.push(row);
      map.set(userId, entry);
    }

    for (const entry of map.values()) {
      entry.items.sort((a, b) => `${b.session_date}T${b.session_time}`.localeCompare(`${a.session_date}T${a.session_time}`));
    }

    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
  }, [filtered]);

  const selectedProfessionalName = useMemo(
    () => professionals.find((professional) => professional.id === selectedProfessionalId)?.name ?? "",
    [professionals, selectedProfessionalId]
  );

  const title = mode === "active" ? "Sessões" : "Histórico";
  const description =
    mode === "active"
      ? "Acompanhe os horários agendados da clínica organizados por terapeuta."
      : "Consulte as sessões finalizadas e canceladas da clínica por terapeuta.";

  const emptyMessage =
    mode === "active"
      ? "Nenhuma sessão agendada para este terapeuta."
      : "Nenhuma sessão no histórico para este terapeuta.";

  const statusConfig = {
    realizada: { label: "Realizada", color: "bg-brand-green/10 text-brand-green border-brand-green/20", icon: CheckCircle2 },
    agendada: { label: "Agendada", color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20", icon: CalendarClock },
    avaliacao: { label: "Avaliação", color: "bg-brand-purple/10 text-brand-purple border-brand-purple/20", icon: CalendarClock },
    cancelada: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: CalendarIcon },
  } as const;

  const mapStatus = (raw: string, kind?: string | null) =>
    (raw === "completed"
      ? "realizada"
      : raw === "canceled"
        ? "cancelada"
        : String(kind || "").toLowerCase() === "evaluation"
          ? "avaliacao"
          : "agendada") as const;

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">{title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
          </div>

          {professionalsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1].map((item) => (
                <div key={item} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-4 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <ClinicProfessionalScopeSelector
              professionals={professionals}
              selectedProfessionalId={selectedProfessionalId}
              onSelect={setSelectedProfessionalId}
              title="Escolha o terapeuta"
              description={`Clique em um profissional para ver ${mode === "active" ? "os horários" : "o histórico"} dele.`}
            />
          )}
        </div>

        {selectedProfessionalName ? (
          <div className="mb-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            Exibindo dados de: <span className="font-semibold text-foreground">{selectedProfessionalName}</span>
          </div>
        ) : null}

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente, responsável ou email..."
              className="pl-9 sm:pl-11 text-sm sm:text-base"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="bg-card rounded-xl border border-border p-5 shadow-sm">
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
        ) : professionals.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum terapeuta vinculado à clínica ainda.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : groupedByUser.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum resultado para essa busca.</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3 sm:space-y-4">
            {groupedByUser.map((user) => (
              <AccordionItem key={user.userId} value={String(user.userId)} className="bg-card rounded-xl border border-border px-3 sm:px-4 md:px-5">
                <AccordionTrigger className="py-3 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3 text-left w-full">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                      {user.profile_photo_url ? (
                        <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.userName.split(" ").map((part) => part[0]).join("").slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-base text-foreground truncate">{user.userName}</div>
                      {user.userEmail ? <div className="text-xs text-muted-foreground truncate">{user.userEmail}</div> : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 sm:pb-5">
                  <div className="space-y-2 sm:space-y-3">
                    {user.items.map((session) => {
                      const status = mapStatus(session.status, session.session_kind);
                      const StatusIcon = statusConfig[status].icon;
                      return (
                        <div key={session.id} className="rounded-lg border border-border p-3 sm:p-4 bg-background/60">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm sm:text-base text-foreground">Sessão</div>
                              <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
                                <span className="flex items-center gap-1">
                                  <CalendarIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                                  {session.session_date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                                  {session.session_time}
                                </span>
                              </div>
                            </div>

                            <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border ${statusConfig[status].color}`}>
                              <StatusIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                              {statusConfig[status].label}
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
  );
}
