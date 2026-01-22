import { useEffect, useMemo, useState } from "react";
import { Users, Search, Eye, Activity, Calendar, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/laravel-api";
import type { ProfessionalPatientRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type PatientOverview = {
  user: ProfessionalPatientRow;
  summary: any;
  activities: any[];
  reports: any[];
  appointments: any[];
};

export default function ProfessionalPatients(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<ProfessionalPatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProfessionalPatientRow | null>(null);
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await api.professionalListPatients();
      setPatients(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [patients, search]);

  const openPatient = async (p: ProfessionalPatientRow) => {
    setSelected(p);
    setOverview(null);
    setOverviewLoading(true);
    try {
      const data = await api.professionalGetPatientOverview(p.id);
      setOverview(data as any);
    } finally {
      setOverviewLoading(false);
    }
  };

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Pacientes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Você verá apenas pacientes que o admin vinculou a você.</p>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="pl-9 sm:pl-11 text-sm sm:text-base" />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
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
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum paciente vinculado.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                      {p.profile_photo_url ? (
                        <img src={normalizeMediaUrl(p.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm sm:text-base text-foreground truncate">{p.name}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">{p.email}</div>
                      {p.phone ? <div className="text-xs text-muted-foreground">Celular: {p.phone}</div> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => void openPatient(p)} className="w-full sm:w-auto text-xs sm:text-sm">
                      <Eye size={14} className="sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      Ver Perfil
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              setOverview(null);
            }
          }}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto px-3 sm:px-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Perfil do Paciente</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">Visualização somente leitura (edição/bloqueio é apenas pelo admin).</DialogDescription>
            </DialogHeader>

            {overviewLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : overview ? (
              <div className="space-y-6 mt-4">
                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold">
                      {overview.user.profile_photo_url ? (
                        <img src={normalizeMediaUrl(overview.user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        overview.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{overview.user.name}</div>
                      <div className="text-sm text-muted-foreground">{overview.user.email}</div>
                    </div>
                  </div>
                  {overview.user.phone ? <div className="text-sm text-muted-foreground">Celular: {overview.user.phone}</div> : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><Activity size={14} className="sm:w-4 sm:h-4" /> Atividades</div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">{overview.summary?.activities?.total ?? 0}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                      {overview.summary?.activities?.concluida ?? 0} concluída(s) • {overview.summary?.activities?.em_andamento ?? 0} em andamento
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><FileText size={14} className="sm:w-4 sm:h-4" /> Relatórios</div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">{overview.summary?.reports_total ?? 0}</div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><Calendar size={14} className="sm:w-4 sm:h-4" /> Horários</div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">{overview.appointments?.length ?? 0}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 bg-card">
                  <div className="font-semibold text-foreground mb-2">Jogos</div>
                  <div className="text-sm text-muted-foreground">
                    Memória: {overview.summary?.games?.memory_games ?? 0} • Fonema: {overview.summary?.games?.phoneme_games ?? 0} • Auditivo: {overview.summary?.games?.auditory_games ?? 0} • Forca: {overview.summary?.games?.hangman_games ?? 0} • Roleta: {overview.summary?.games?.spin_wheel_games ?? 0} • Caça-palavras: {overview.summary?.games?.word_search_games ?? 0} • Cartas: {overview.summary?.games?.card_games ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 bg-card">
                  <div className="font-semibold text-foreground mb-2">Horários (com você)</div>
                  {overview.appointments?.length ? (
                    <div className="space-y-2">
                      {overview.appointments.map((a: any) => (
                        <div key={a.id} className="rounded-lg border border-border p-3 bg-background/60">
                          <div className="text-sm text-foreground">{a.session_date} • {a.session_time}</div>
                          <div className="text-xs text-muted-foreground">{a.status}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Nenhum horário encontrado.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Selecione um paciente.</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

