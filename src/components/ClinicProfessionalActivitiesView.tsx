import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ClinicProfessionalScopeSelector from "@/components/ClinicProfessionalScopeSelector";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import * as api from "@/lib/laravel-api";

export default function ClinicProfessionalActivitiesView(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<api.ClinicProfessionalRow[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [activities, setActivities] = useState<api.ActivityRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
      setActivities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .professionalListActivities({ professional_user_id: selectedProfessionalId })
      .then((rows) => {
        if (cancelled) return;
        setActivities(rows ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfessionalId]);

  const filteredActivities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter((activity) =>
      [
        activity.title,
        activity.description,
        activity.category ?? "",
        ...(activity.assigned_to?.map((patient) => patient.name) ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [activities, searchTerm]);

  const groupedByPatient = useMemo(() => {
    const byPatient = new Map<number, { id: number; name: string; items: api.ActivityRow[] }>();

    for (const activity of filteredActivities) {
      const assigned = activity.assigned_to ?? [];
      for (const patient of assigned) {
        const entry = byPatient.get(patient.id) ?? { id: patient.id, name: patient.name, items: [] };
        entry.items.push(activity);
        byPatient.set(patient.id, entry);
      }
    }

    for (const entry of byPatient.values()) {
      entry.items.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    }

    return Array.from(byPatient.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filteredActivities]);

  const libraryActivities = useMemo(
    () =>
      filteredActivities
        .filter((activity) => (activity.assigned_to?.length ?? 0) === 0)
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    [filteredActivities]
  );

  const selectedProfessionalName = useMemo(
    () => professionals.find((professional) => professional.id === selectedProfessionalId)?.name ?? "",
    [professionals, selectedProfessionalId]
  );

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Atividades</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Visualize as atividades da clínica organizadas pelo terapeuta responsável.
            </p>
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
              description="Clique em um profissional para ver as atividades vinculadas ao contexto dele."
            />
          )}
        </div>

        {selectedProfessionalName ? (
          <div className="mb-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            Exibindo atividades de: <span className="font-semibold text-foreground">{selectedProfessionalName}</span>
          </div>
        ) : null}

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              type="text"
              placeholder="Buscar por atividade, categoria ou paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : professionals.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum terapeuta vinculado à clínica ainda.</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma atividade encontrada para este terapeuta.</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3 sm:space-y-4">
            {libraryActivities.length > 0 ? (
              <AccordionItem value="biblioteca" className="bg-card rounded-xl border border-border px-4">
                <AccordionTrigger className="py-4 text-left">
                  <div>
                    <div className="font-semibold text-foreground">Biblioteca do terapeuta</div>
                    <div className="text-xs text-muted-foreground">
                      Atividades criadas ou compartilhadas que ainda não foram atribuídas a pacientes.
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {libraryActivities.map((activity) => (
                      <ActivityCard key={`library-${activity.id}`} activity={activity} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {groupedByPatient.map((patient) => (
              <AccordionItem key={patient.id} value={`patient-${patient.id}`} className="bg-card rounded-xl border border-border px-4">
                <AccordionTrigger className="py-4 text-left">
                  <div className="flex w-full items-center justify-between gap-3 pr-2">
                    <div>
                      <div className="font-semibold text-foreground">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">Paciente vinculado ao terapeuta selecionado.</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{patient.items.length} atividade(s)</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {patient.items.map((activity) => (
                      <ActivityCard key={`${patient.id}-${activity.id}`} activity={activity} />
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

function ActivityCard(props: {
  activity: api.ActivityRow;
}): JSX.Element {
  const { activity } = props;

  return (
    <div className="rounded-xl border border-border bg-background/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 flex-shrink-0">
          {activity.thumbnail ? (
            <img src={normalizeMediaUrl(activity.thumbnail.url)} alt="" className="h-full w-full object-cover" />
          ) : (
            <Activity className="h-5 w-5 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{activity.title}</h3>
            {activity.category ? (
              <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs text-brand-green">{activity.category}</span>
            ) : null}
            {activity.estimated_time ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                {activity.estimated_time}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{activity.description}</p>
        </div>
      </div>
    </div>
  );
}
