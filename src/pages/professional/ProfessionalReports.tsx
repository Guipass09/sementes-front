import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import ClinicProfessionalReportsView from "@/components/ClinicProfessionalReportsView";
import type { ReportDetail } from "@/features/reports/types";
import { ReportCard } from "@/features/reports/ReportCard";
import { ReportPreviewModal } from "@/features/reports/ReportPreviewModal";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import * as api from "@/lib/laravel-api";
import { ProfessionalReportFormModal } from "@/features/reports/ProfessionalReportFormModal";
import { useToast } from "@/hooks/use-toast";

function toDetail(r: any): ReportDetail {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    type: r.type,
    status: r.status,
    isPrivate: !!r.is_private,
    patient: r.patient ?? { id: null, name: "" },
    patientName: r.patient_name ?? r.patient?.name ?? "",
    createdBy: r.created_by,
    professionalName: r.professional_name ?? "",
    summary: r.summary ?? "",
    content: r.content ?? "",
  };
}

export default function ProfessionalReports(): JSX.Element {
  const auth = useAuth();
  const clinicName = String(auth.user?.clinic_name ?? "").trim();
  if (clinicName) {
    return <ClinicProfessionalReportsView />;
  }

  return <StandardProfessionalReports />;
}

function StandardProfessionalReports(): JSX.Element {
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportDetail | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportDetail | null>(null);
  const [sendTarget, setSendTarget] = useState<ReportDetail | null>(null);
  const [recipients, setRecipients] = useState<api.ProfessionalUserRow[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await api.professionalListReports();
      setReports((rows ?? []).map((r: any) => toDetail(r)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.user) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => r.title.toLowerCase().includes(q) || r.patient.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  }, [reports, searchTerm]);

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Relatórios</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Crie e gerencie relatórios para seus usuários.</p>
          </div>
          <Button
            className="w-full sm:w-auto text-xs sm:text-sm"
            disabled={loading || !auth.user}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} className="sm:w-[18px] sm:h-[18px] mr-1.5 sm:mr-2" />
            Novo Relatório
          </Button>
        </div>

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
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-6 shadow-sm">
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
              <div key={report.id} className="animate-fade-in" style={{ animationDelay: `${0.05 * index}s` }}>
                <ReportCard
                  report={report}
                  showPatient
                  onOpen={() => {
                    if (report.status === "draft") {
                      setEditing(report);
                      setFormOpen(true);
                    } else {
                      setSelected(report);
                    }
                  }}
                  onDownload={() => { if (report.status !== "draft") setSelected(report); }}
                  canEdit={report.createdBy.id === auth.user?.id}
                  onSend={report.isPrivate && report.type !== "evolucao" && report.status !== "draft" && report.createdBy.id === auth.user?.id ? () => {
                    setSendTarget(report);
                    setSelectedRecipients([]);
                    void api.professionalListUsers().then((res) => setRecipients(res.data ?? [])).catch(() => {
                      toast({ title: "Não foi possível carregar os pacientes", variant: "destructive" });
                    });
                  } : undefined}
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

        <ProfessionalReportFormModal
          open={formOpen}
          mode={editing ? "edit" : "create"}
          initial={editing ?? undefined}
          onOpenChange={setFormOpen}
          onSubmit={async (payload) => {
            if (editing) {
              await api.professionalUpdateReport(editing.id, { ...payload, status: "published" });
            } else {
              await api.professionalCreateReport({ ...payload, is_private: true });
            }
            await refresh();
          }}
        />

        <Dialog open={!!sendTarget} onOpenChange={(open) => { if (!open) setSendTarget(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Enviar relatório</DialogTitle></DialogHeader>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {recipients.filter((user) => !sendTarget?.patient.id || user.id === sendTarget.patient.id).map((user) => (
                <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                  <Checkbox checked={selectedRecipients.includes(user.id)} onCheckedChange={(checked) => setSelectedRecipients((old) => checked ? [...old, user.id] : old.filter((id) => id !== user.id))} />
                  <span className="text-sm">{user.name}</span>
                </label>
              ))}
            </div>
            <Button disabled={!selectedRecipients.length || sending} onClick={async () => {
              if (!sendTarget) return;
              setSending(true);
              try {
                for (const user of recipients.filter((item) => selectedRecipients.includes(item.id))) {
                  await api.professionalCreateReport({
                    user_id: user.id,
                    patient_name: sendTarget.patientName || user.name,
                    professional_name: sendTarget.professionalName,
                    title: sendTarget.title,
                    report_date: sendTarget.date,
                    type: sendTarget.type,
                    content: sendTarget.content,
                    status: "published",
                    is_private: false,
                  });
                }
                setSendTarget(null);
                toast({ title: "Relatório enviado" });
                await refresh();
              } catch {
                toast({ title: "Não foi possível enviar o relatório", variant: "destructive" });
              } finally {
                setSending(false);
              }
            }}>{sending ? "Enviando..." : "Enviar aos pacientes"}</Button>
          </DialogContent>
        </Dialog>

        <BrandedConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Excluir relatório?"
          description={deleteTarget ? `Excluir o relatório "${deleteTarget.title}"? Esta ação é permanente.` : "Esta ação é permanente."}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => {
            if (!deleteTarget) return;
            void api.professionalDeleteReport(deleteTarget.id).then(() => refresh()).catch(() => {
              toast({ title: "Não foi possível excluir o relatório", variant: "destructive" });
            });
          }}
        />
      </div>
    </div>
  );
}
