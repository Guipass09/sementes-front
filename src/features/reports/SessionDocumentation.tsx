import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Minimize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";
import type { ReportRow, ReportType } from "@/lib/laravel-api";
import { formatReportDate, reportTypeConfig } from "./report-config";

const types: ReportType[] = ["evolucao", "avaliacao", "mensal", "trimestral"];
type Form = { title: string; report_date: string; content: string };

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function SessionDocumentation({
  open,
  onOpenChange,
  patient,
  author,
  registerFlush,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: { id: number; name: string } | null;
  author: { id: number; name: string };
  registerFlush: (flush: (() => Promise<void>) | null) => void;
}): JSX.Element {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [category, setCategory] = useState<ReportType>("evolucao");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<ReportRow | null>(null);
  const [viewing, setViewing] = useState<ReportRow | null>(null);
  const [form, setForm] = useState<Form>({ title: "", report_date: localDate(), content: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const draftSaveTimer = useRef<number | null>(null);
  const finalizingRef = useRef(false);
  const latestForm = useRef(form);
  latestForm.current = form;

  const refresh = useCallback(async () => {
    if (!patient) return;
    setLoading(true);
    try {
      const rows = await api.professionalListReports();
      setReports(rows.filter(row => row.patient?.id === patient.id));
    } catch {
      toast({ title: "Documentação", description: "Não foi possível carregar os documentos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patient?.id, toast]);

  useEffect(() => {
    if (open && patient) void refresh();
  }, [open, patient?.id]);

  const saveDraft = useCallback((row: ReportRow, value: Form): Promise<unknown> => {
    const payload = { ...value, status: "draft" as const };
    const next = saveQueue.current.catch(() => {}).then(() => api.professionalUpdateReport(row.id, payload));
    saveQueue.current = next;
    next.then(() => setSaveError(false)).catch(() => setSaveError(true));
    return next;
  }, []);

  useEffect(() => {
    registerFlush(editing && editing.status === "draft" ? async () => {
      await saveDraft(editing, latestForm.current);
    } : null);
    return () => registerFlush(null);
  }, [editing?.id, editing?.status, registerFlush, saveDraft]);

  useEffect(() => {
    if (!editing || editing.status !== "draft") return;
    draftSaveTimer.current = window.setTimeout(() => {
      draftSaveTimer.current = null;
      if (!finalizingRef.current) void saveDraft(editing, latestForm.current);
    }, 900);
    return () => {
      if (draftSaveTimer.current !== null) window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    };
  }, [editing?.id, form, saveDraft]);

  const begin = async (type: ReportType) => {
    if (!patient) return;
    setCreating(true);
    try {
      const date = localDate();
      const row = await api.professionalCreateReport({
        user_id: patient.id,
        patient_name: patient.name,
        professional_name: author.name,
        title: type === "evolucao" ? `Evolução - ${formatReportDate(date)}` : reportTypeConfig[type].label,
        report_date: date,
        type,
        content: "",
        status: "draft",
      });
      setReports(previous => [row, ...previous]);
      setForm({ title: row.title, report_date: row.date, content: "" });
      setEditing(row);
      setCategory(type);
      setChoosing(false);
      onOpenChange(false);
    } catch {
      toast({ title: "Documentação", description: "Não foi possível iniciar o rascunho.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const minimize = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await saveDraft(editing, latestForm.current);
      setEditing(null);
      await refresh();
    } catch {
      toast({ title: "Rascunho não salvo", description: "Tente novamente antes de sair do editor.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!editing || !form.content.trim() || !form.title.trim()) return;
    finalizingRef.current = true;
    if (draftSaveTimer.current !== null) window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = null;
    setSaving(true);
    try {
      await saveQueue.current;
      await api.professionalUpdateReport(editing.id, { ...form, content: form.content.trim(), status: "published" });
      setEditing(null);
      await refresh();
      toast({ title: "Documento finalizado" });
    } catch {
      toast({ title: "Não foi possível finalizar", description: "O rascunho permanece disponível.", variant: "destructive" });
    } finally {
      finalizingRef.current = false;
      setSaving(false);
    }
  };

  const visible = reports.filter(row => row.type === category).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <>
      <Dialog open={open && !editing} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Documentação de {patient?.name ?? "paciente"}</DialogTitle></DialogHeader>
          {!patient ? <p className="text-sm text-muted-foreground">Carregando paciente da sessão...</p> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Registros clínicos do paciente</p>
                <Button type="button" size="sm" onClick={() => setChoosing(!choosing)} aria-label="Criar documento"><Plus size={17} className="mr-1" /> Novo</Button>
              </div>
              {choosing ? <div className="flex flex-wrap gap-2 border-b pb-4">{types.map(type => <Button key={type} variant="outline" size="sm" disabled={creating} onClick={() => void begin(type)}>{reportTypeConfig[type].label}</Button>)}</div> : null}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de documento">
                {types.map(type => <button key={type} type="button" onClick={() => setCategory(type)} aria-pressed={category === type} className={`rounded-md border px-3 py-2 text-sm font-medium ${category === type ? "border-brand-green bg-brand-green/10 text-brand-green" : "border-border text-foreground"}`}>{reportTypeConfig[type].label} <span className="ml-1 text-xs opacity-70">{reports.filter(row => row.type === type).length}</span></button>)}
              </div>
              <div className="space-y-2">
                {loading ? <p className="py-6 text-sm text-muted-foreground">Carregando...</p> : visible.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum documento nesta categoria.</p> : visible.map(row => <button key={row.id} type="button" className="flex w-full items-start gap-3 rounded-md border border-border p-3 text-left hover:bg-muted/30" onClick={() => {
                  if (row.status === "draft" && row.created_by?.id === author.id) {
                    setForm({ title: row.title, report_date: row.date, content: row.content ?? "" });
                    setEditing(row);
                    onOpenChange(false);
                  } else setViewing(row);
                }}><FileText size={18} className="mt-0.5 shrink-0 text-brand-green" /><span className="min-w-0 flex-1"><span className="block font-medium">{row.title}</span><span className="text-xs text-muted-foreground">{formatReportDate(row.date)} · {row.professional_name}</span></span>{row.status === "draft" ? <span className="text-xs font-semibold text-brand-orange">Rascunho</span> : null}</button>)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(next) => { if (!next && !saving) void minimize(); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? reportTypeConfig[editing.type].label : "Documento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="session-document-title">Título</Label><Input id="session-document-title" value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></div>
            <div><Label htmlFor="session-document-date">Data</Label><Input id="session-document-date" type="date" value={form.report_date} onChange={event => setForm(previous => ({ ...previous, report_date: event.target.value }))} /></div>
            <div><Label htmlFor="session-document-content">Registro clínico</Label><Textarea id="session-document-content" rows={12} value={form.content} onChange={event => setForm(previous => ({ ...previous, content: event.target.value }))} className="mt-1 min-h-56" /></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{saveError ? "Falha ao salvar. Minimize para tentar novamente." : "Salvamento automático ativo"}</p><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => void minimize()}><Minimize2 size={16} className="mr-1" /> Minimizar</Button><Button disabled={saving || !form.content.trim() || !form.title.trim()} onClick={() => void finalize()}>{saving ? "Salvando..." : "Finalizar"}</Button></div></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={next => { if (!next) setViewing(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          {viewing ? <><p className="text-sm text-muted-foreground">{formatReportDate(viewing.date)} · {viewing.professional_name}</p><div className="whitespace-pre-wrap break-words text-sm leading-7">{viewing.content}</div></> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
