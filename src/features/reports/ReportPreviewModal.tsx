import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
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

const REPORT_LOGO_CANDIDATES = [
  "/logo-relatorio.png",
  "/logo-relatorio.jpg",
  "/logo-relatorio.webp",
] as const;

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
  const [logoSrc, setLogoSrc] = useState<string>(REPORT_LOGO_CANDIDATES[0]);

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
        filename: buildReportPdfFilename(props.report.patientName || props.report.patient.name, props.report.date),
      });
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
                Paciente: {props.report.patientName || props.report.patient.name}
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
                className="mx-auto bg-white text-slate-900 rounded-lg shadow-sm border border-slate-200"
                style={{
                  // A4 em px aproximado a 96dpi (apenas para preview)
                  width: "794px",
                  maxWidth: "100%",
                  overflow: "visible",
                }}
              >
                <div
                  className="p-4 sm:p-8"
                  style={{
                    padding: "48px",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Cabeçalho */}
                  <div data-pdf-avoid className="flex items-center gap-4 pb-4 border-b border-slate-200">
                    <img
                      src={logoSrc}
                      alt="Sementes da Fala"
                      className="w-14 h-14 rounded-lg object-contain"
                      onError={(e) => {
                        // Tenta próximos formatos em /public; por fim cai no logo padrão do projeto.
                        const current = e.currentTarget.src;
                        const idx = REPORT_LOGO_CANDIDATES.findIndex((u) => current.endsWith(u));
                        const next = idx >= 0 ? REPORT_LOGO_CANDIDATES[idx + 1] : null;
                        if (next) {
                          setLogoSrc(next);
                          return;
                        }
                        e.currentTarget.src = logoImage;
                      }}
                    />
                    <div className="flex-1">
                      <div className="text-lg font-display font-bold">
                        <span className="text-brand-green">Sementes</span>{" "}
                        <span className="text-brand-brown">da Fala</span>
                      </div>
                      <div className="text-sm text-slate-600">Relatório clínico</div>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div className="font-medium text-slate-900">
                        {formatReportDate(props.report.date)}
                      </div>
                      <div>{cfg?.label}</div>
                    </div>
                  </div>

                  {/* Identificação */}
                  <div data-pdf-avoid className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                      <div className="text-slate-500">Paciente</div>
                      <div className="font-semibold">{props.report.patientName || props.report.patient.name}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                      <div className="text-slate-500">Profissional</div>
                      <div className="font-semibold">{props.report.professionalName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Criado por: {props.report.createdBy.name}
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="mt-6" data-pdf-text>
                    <h2 className="text-base font-semibold mb-3">{props.report.title}</h2>
                    <div className="space-y-4 text-[15px] leading-relaxed">
                      {paragraphs.map((p, idx) => (
                        <p key={idx} data-pdf-avoid className="whitespace-pre-wrap">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Assinatura */}
                  <div data-pdf-avoid className="mt-10">
                    <div className="flex justify-end">
                      <div className="w-full sm:w-[360px]">
                        <div className="border-t border-slate-300 pt-2 text-sm text-slate-700 text-center">
                          Assinatura do(a) Profissional
                        </div>
                        <div className="text-xs text-slate-500 text-center mt-1">
                          {props.report.professionalName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé */}
                  <div data-pdf-avoid className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                    <span>Sementes da Fala • Relatório gerado pelo sistema</span>
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


