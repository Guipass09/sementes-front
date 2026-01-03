import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccessControl } from "@/hooks/use-access-control";
import AccessBlocked from "@/components/AccessBlocked";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import { listReports } from "@/features/reports/data";
import type { ReportDetail } from "@/features/reports/types";
import { ReportCard } from "@/features/reports/ReportCard";
import { ReportPreviewModal } from "@/features/reports/ReportPreviewModal";

const PatientReports = () => {
  const { checkAccess } = useAccessControl();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);

  if (!checkAccess("relatorios")) {
    return <AccessBlocked pageName="Relatórios" />;
  }

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await listReports({ currentUser: auth.user! });
        if (!cancelled) setReports(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Acompanhe a evolução e os relatórios do desenvolvimento
          </p>
          <div className="mt-3 rounded-xl border border-brand-orange/20 bg-brand-orange/10 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">Aviso:</span> antes de utilizar qualquer relatório como documento, solicite a{" "}
            <span className="font-semibold">assinatura do(a) profissional</span>.
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-brand-green/10 via-background to-brand-orange/5 rounded-xl border border-border p-6 mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-green/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={24} className="text-brand-green" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Resumo do Progresso</h3>
              <p className="text-sm text-muted-foreground">
                O desenvolvimento está dentro do esperado. Continue realizando as atividades em casa 
                para potencializar os resultados das sessões terapêuticas.
              </p>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-6 shadow-sm"
                >
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            reports.map((report, index) => (
              <div
                key={report.id}
                className="animate-fade-in"
                style={{ animationDelay: `${0.05 * index}s` }}
              >
                <ReportCard
                  report={report}
                  onOpen={() => setSelected(report)}
                  onDownload={() => setSelected(report)}
                />
              </div>
            ))
          )}
        </div>

        {/* Empty State Note */}
        {!loading && reports.length === 0 && (
          <div className="mt-8 p-6 bg-muted/30 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum relatório disponível no momento.
            </p>
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
};

export default PatientReports;
