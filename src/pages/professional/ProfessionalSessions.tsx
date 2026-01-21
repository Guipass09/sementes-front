import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/laravel-api";

type ProAppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string;
  session_time: string;
  total_sessions: number;
  status: string;
  user?: { id: number; name: string; email: string } | null;
};

export default function ProfessionalSessions(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProAppointmentRow[]>([]);

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

  const grouped = useMemo(() => {
    const map = new Map<string, ProAppointmentRow[]>();
    for (const r of rows) {
      const key = r.session_date || "sem-data";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      map.set(k, [...arr].sort((a, b) => (a.session_time || "").localeCompare(b.session_time || "")));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Horários</h1>
          <p className="text-muted-foreground">Sessões agendadas pelo admin para você.</p>
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
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date} className="bg-card rounded-xl border border-border p-5">
                <div className="font-semibold text-foreground">{date}</div>
                <div className="mt-3 space-y-3">
                  {items.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-4 bg-background/60">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{s.user?.name ?? `Usuário #${s.user_id}`}</div>
                          <div className="text-sm text-muted-foreground">
                            {s.session_time} • {s.professional_name}
                          </div>
                          {s.user?.email ? <div className="text-xs text-muted-foreground">{s.user.email}</div> : null}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">{s.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

