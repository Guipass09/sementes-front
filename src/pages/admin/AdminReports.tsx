import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import { listReports } from "@/features/reports/data";
import type { ReportDetail } from "@/features/reports/types";
import { ReportCard } from "@/features/reports/ReportCard";
import { ReportPreviewModal } from "@/features/reports/ReportPreviewModal";
import { ReportFormModal } from "@/features/reports/ReportFormModal";
import * as api from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

const AdminReports = () => {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportDetail | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportDetail | null>(null);

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

  const refresh = async () => {
    if (!auth.user) return;
    const data = await listReports({ currentUser: auth.user });
    setReports(data);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      return (
        r.title.toLowerCase().includes(q) ||
        r.patient.name.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [reports, searchTerm]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
              Relatórios
            </h1>
            <p className="text-muted-foreground">
              Visualize relatórios com preview rápido e baixe o PDF timbrado.
            </p>
          </div>

          {/* BOTÃO DE TESTE VISUAL (para confirmar que o Vite está pegando as mudanças) */}
          <Button
            className="w-full sm:w-auto"
            disabled={loading || !auth.user}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} className="mr-2" />
            Novo Relatório
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={20}
            />
            <Input
              type="text"
              placeholder="Buscar por título, paciente ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

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
            filtered.map((report, index) => (
              <div
                key={report.id}
                className="animate-fade-in"
                style={{ animationDelay: `${0.05 * index}s` }}
              >
                <ReportCard
                  report={report}
                  showPatient
                  onOpen={() => setSelected(report)}
                  onDownload={() => setSelected(report)}
                  canEdit
                  onEdit={() => {
                    setEditing(report);
                    setFormOpen(true);
                  }}
                  onDelete={async () => {
                    setDeleteTarget(report);
                    setDeleteOpen(true);
                  }}
                />
              </div>
            ))
          )}
        </div>

        {!loading && filtered.length === 0 && (
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

        <ReportFormModal
          open={formOpen}
          mode={editing ? "edit" : "create"}
          initial={editing}
          onOpenChange={setFormOpen}
          onSubmit={async (payload) => {
            if (editing) {
              await api.adminUpdateReport(editing.id, {
                user_id: payload.user_id,
                patient_name: payload.patient_name,
                professional_name: payload.professional_name,
                title: payload.title,
                report_date: payload.report_date,
                type: payload.type,
                content: payload.content,
              });
            } else {
              await api.adminCreateReport(payload);
            }
            await refresh();
          }}
        />

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Excluir relatório?"
          description={
            deleteTarget
              ? `Excluir o relatório "${deleteTarget.title}"? Esta ação é permanente.`
              : "Esta ação é permanente."
          }
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => {
            if (!deleteTarget) return;
            void api.adminDeleteReport(deleteTarget.id).then(() => refresh());
          }}
        />
      </div>
    </div>
  );
};

export default AdminReports;





