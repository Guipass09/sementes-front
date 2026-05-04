import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ClinicProfessionalScopeSelector from "@/components/ClinicProfessionalScopeSelector";
import type { ReportDetail } from "@/features/reports/types";
import { ReportCard } from "@/features/reports/ReportCard";
import { ReportPreviewModal } from "@/features/reports/ReportPreviewModal";
import * as api from "@/lib/laravel-api";

function toDetail(report: any): ReportDetail {
  return {
    id: report.id,
    title: report.title,
    date: report.date,
    type: report.type,
    patient: report.patient,
    patientName: report.patient_name ?? report.patient?.name ?? "",
    createdBy: report.created_by,
    professionalName: report.professional_name ?? "",
    summary: report.summary ?? "",
    content: report.content ?? "",
  };
}

export default function ClinicProfessionalReportsView(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<api.ClinicProfessionalRow[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<ReportDetail | null>(null);

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
      setReports([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .professionalListReports({ professional_user_id: selectedProfessionalId })
      .then((rows) => {
        if (cancelled) return;
        setReports((rows ?? []).map((report: any) => toDetail(report)));
      })
      .catch(() => {
        if (cancelled) return;
        setReports([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfessionalId]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter(
      (report) =>
        report.title.toLowerCase().includes(query) ||
        report.patient.name.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query)
    );
  }, [reports, searchTerm]);

  const selectedProfessionalName = useMemo(
    () => professionals.find((professional) => professional.id === selectedProfessionalId)?.name ?? "",
    [professionals, selectedProfessionalId]
  );

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Relatórios</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Consulte os relatórios da clínica organizados por terapeuta.
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
              description="Clique em um profissional para ver os relatórios vinculados ao contexto dele."
            />
          )}
        </div>

        {selectedProfessionalName ? (
          <div className="mb-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            Exibindo relatórios de: <span className="font-semibold text-foreground">{selectedProfessionalName}</span>
          </div>
        ) : null}

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              type="text"
              placeholder="Buscar por título, paciente ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-11 text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-6 shadow-sm">
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
          ) : (
            filtered.map((report, index) => (
              <div key={report.id} className="animate-fade-in" style={{ animationDelay: `${0.05 * index}s` }}>
                <ReportCard
                  report={report}
                  showPatient
                  onOpen={() => setSelected(report)}
                  onDownload={() => setSelected(report)}
                />
              </div>
            ))
          )}
        </div>

        {!loading && professionals.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum terapeuta vinculado à clínica ainda.</p>
          </div>
        )}

        {!loading && professionals.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum relatório encontrado</p>
          </div>
        )}

        <ReportPreviewModal
          open={!!selected}
          report={selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
      </div>
    </div>
  );
}
