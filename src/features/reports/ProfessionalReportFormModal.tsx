import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfessionalUserRow, ReportType } from "@/lib/laravel-api";
import { professionalListUsers } from "@/lib/laravel-api";
import type { ReportDetail } from "./types";
import { reportTypeConfig } from "./report-config";

export type ReportFormDraft = {
  userId: number | null;
  patientName: string;
  professionalName: string;
  title: string;
  reportDate: string;
  type: ReportType;
  content: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFormValue(r?: ReportDetail | null): ReportFormDraft {
  return {
    userId: r?.patient?.id ?? null,
    patientName: (r?.patientName ?? r?.patient?.name ?? "").toString(),
    professionalName: r?.professionalName ?? "",
    title: r?.title ?? "",
    reportDate: r?.date ?? todayIso(),
    type: (r?.type ?? "mensal") as ReportType,
    content: r?.content ?? "",
  };
}

export function ProfessionalReportFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial?: ReportDetail | null;
  fixedUser?: { id: number; name: string } | null;
  draft?: ReportFormDraft | null;
  showMinimize?: boolean;
  onMinimize?: (draft: ReportFormDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    user_id: number;
    patient_name: string;
    professional_name: string;
    title: string;
    report_date: string;
    type: ReportType;
    content: string;
  }) => Promise<void>;
}): JSX.Element {
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<ProfessionalUserRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ReportFormDraft>(() => toFormValue(props.initial));

  useEffect(() => {
    if (!props.open) return;
    const v = props.draft ? { ...props.draft } : toFormValue(props.initial);
    if (props.mode === "create" && props.fixedUser?.id) {
      v.userId = props.fixedUser.id;
      if (!v.patientName.trim()) v.patientName = props.fixedUser.name;
    }
    setForm(v);
  }, [props.open, props.initial, props.fixedUser, props.mode, props.draft]);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await professionalListUsers();
        if (cancelled) return;
        setUsers(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open]);

  const canSubmit = useMemo(() => {
    return (
      !!form.userId &&
      form.patientName.trim().length > 0 &&
      form.professionalName.trim().length > 0 &&
      form.title.trim().length > 0 &&
      form.reportDate.trim().length > 0 &&
      form.content.trim().length > 0
    );
  }, [form]);

  const handleSubmit = async () => {
    if (!canSubmit || !form.userId) return;
    setSaving(true);
    try {
      await props.onSubmit({
        user_id: form.userId,
        patient_name: form.patientName.trim(),
        professional_name: form.professionalName.trim(),
        title: form.title.trim(),
        report_date: form.reportDate,
        type: form.type,
        content: form.content.trim(),
      });
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleMinimize = () => {
    if (saving) return;
    props.onMinimize?.(form);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Novo Relatório" : "Editar Relatório"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">Nome completo da criança</Label>
              <Input id="patientName" value={form.patientName} onChange={(e) => setForm((p) => ({ ...p, patientName: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Usuário (conta)</Label>
              {props.mode === "create" && props.fixedUser?.id ? (
                <Input value={props.fixedUser.name} disabled />
              ) : (
                <Select
                  value={form.userId ? String(form.userId) : ""}
                  onValueChange={(v) => setForm((p) => ({ ...p, userId: Number(v) }))}
                  disabled={loadingUsers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingUsers ? "Carregando..." : "Selecione um paciente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="professionalName">Profissional</Label>
              <Input
                id="professionalName"
                value={form.professionalName}
                onChange={(e) => setForm((p) => ({ ...p, professionalName: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={form.reportDate} onChange={(e) => setForm((p) => ({ ...p, reportDate: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as ReportType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypeConfig).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo do relatório</Label>
            <Textarea id="content" rows={10} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} />
          </div>

          <div className="flex items-center justify-end gap-2">
            {props.showMinimize ? (
              <Button variant="outline" onClick={handleMinimize} disabled={saving}>
                Minimizar
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canSubmit || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

