import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReportDetail } from "./types";
import { formatReportDate, reportTypeConfig } from "./report-config";
import { buildReportPdfFilename, downloadElementAsPdf } from "./pdf";
import { ReportLetterheadIdentity } from "./ReportLetterheadIdentity";
import { letterheadName } from "./letterhead";
import { useToast } from "@/hooks/use-toast";

function toParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ReportPreviewModal(props: {
  open: boolean;
  report: ReportDetail | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const cfg = props.report ? reportTypeConfig[props.report.type] : null;

  const paragraphs = useMemo(() => {
    if (!props.report) return [];
    return toParagraphs(props.report.content);
  }, [props.report]);

  const handleDownload = async () => {
    if (!props.report) return;
    if (!previewRef.current) return;

    setDownloading(true);
    try {
      await downloadElementAsPdf({
        element: previewRef.current,
        filename: buildReportPdfFilename(props.report.patientName || props.report.patient.name || "modelo", props.report.date),
      });
    } catch {
      toast({ title: "Não foi possível gerar o PDF", description: "Confira se a imagem do cabeçalho carregou e tente novamente.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <DialogTitle>Visualização do Relatório</DialogTitle>
              {props.report && (
                <p className="text-sm text-muted-foreground">
                  {props.report.title} • {formatReportDate(props.report.date)}
                </p>
              )}
            </div>

            <Button onClick={handleDownload} disabled={!props.report || downloading}>
              <Download size={18} className="mr-2" />
              {downloading ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
          </div>
        </DialogHeader>

        {props.report ? (
          <div className="mt-2">
            {/* Metadados rápidos */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {cfg && (
                <span className={`text-xs px-2 py-1 rounded-full ${cfg.badgeClassName}`}>
                  {cfg.label}
                </span>
              )}
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                Paciente: {props.report.patientName || props.report.patient.name || "Não vinculado"}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                Profissional: {props.report.professionalName}
              </span>
              {props.report.createdBy.role === "admin" && (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-orange/10 text-brand-orange">
                  Criado por Admin
                </span>
              )}
            </div>

            {/* Preview estilo PDF */}
            <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
              <div
                ref={previewRef}
                data-report-pdf
                className="mx-auto bg-white text-slate-900 rounded-md shadow-sm border border-slate-200"
                style={{
                  // A4 em px aproximado a 96dpi (apenas para preview)
                  width: "794px",
                  maxWidth: "100%",
                  overflow: "visible",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <div
                  data-report-pdf-content
                  className="px-5 py-7 sm:px-16 sm:py-14"
                  style={{
                    boxSizing: "border-box",
                  }}
                >
                  {/* Cabeçalho */}
                  <div data-pdf-avoid className="flex flex-wrap items-center gap-4 pb-4 border-b border-slate-200">
                    <ReportLetterheadIdentity letterhead={props.report.letterhead} />
                    <div className="text-right text-xs text-slate-600">
                      <div className="font-medium text-slate-900">
                        {formatReportDate(props.report.date)}
                      </div>
                      <div>{cfg?.label}</div>
                    </div>
                  </div>

                  {/* Identificação */}
                  <div data-pdf-avoid className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5">
                      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Paciente</div>
                      <div className="font-semibold">{props.report.patientName || props.report.patient.name || "Não vinculado"}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5">
                      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Profissional</div>
                      <div className="font-semibold">{props.report.professionalName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Criado por: {props.report.createdBy.name}
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="mt-7" data-pdf-text>
                    <h2 data-pdf-avoid className="text-[17px] font-semibold mb-5 text-slate-950">{props.report.title}</h2>
                    <div className="space-y-5 text-[14px] leading-7 text-slate-800">
                      {paragraphs.map((p, idx) => (
                        <p key={idx} data-pdf-avoid className="whitespace-pre-wrap text-justify">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Assinatura */}
                  <div data-pdf-avoid className="mt-14">
                    <div className="flex justify-end">
                      <div className="w-full sm:w-[320px]">
                        <div className="border-t border-slate-300 pt-3 text-sm text-slate-700 text-center">
                          Assinatura do(a) Profissional
                        </div>
                        <div className="text-xs text-slate-500 text-center mt-1">
                          {props.report.professionalName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div data-pdf-avoid className="mt-10 pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap gap-2 items-center justify-between">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{letterheadName(props.report.letterhead)} • Relatório gerado pelo sistema</span>
                    <span>Confidencial</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações inferiores */}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => props.onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            Nenhum relatório selecionado.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


