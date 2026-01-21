import { useEffect, useMemo, useState } from "react";
import { Calendar, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const [search, setSearch] = useState("");

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
    const map = new Map<number, { userId: number; userName: string; userEmail?: string; items: ProAppointmentRow[] }>();
    for (const r of filtered) {
      const userId = r.user?.id ?? r.user_id ?? 0;
      const entry = map.get(userId) || {
        userId,
        userName: r.user?.name ?? `Usuário #${r.user_id}`,
        userEmail: r.user?.email ?? undefined,
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

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Horários</h1>
          <p className="text-muted-foreground">Sessões agendadas pelo admin para você.</p>
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
                    <div className="text-left">
                      <div className="font-semibold text-foreground">{u.userName}</div>
                      {u.userEmail ? <div className="text-xs text-muted-foreground">{u.userEmail}</div> : null}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <div className="space-y-3">
                      {u.items.map((s) => (
                        <div key={s.id} className="rounded-lg border border-border p-4 bg-background/60">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-foreground">
                                {s.session_date} • {s.session_time}
                              </div>
                              <div className="text-xs text-muted-foreground">{s.professional_name}</div>
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">{s.status}</div>
                          </div>
                        </div>
                      ))}
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

