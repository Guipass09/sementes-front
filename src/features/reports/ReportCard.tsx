import { FileText, Calendar, Download, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportSummary } from "./types";
import { formatReportDate, reportTypeConfig } from "./report-config";

export function ReportCard(props: {
  report: ReportSummary;
  onOpen: () => void;
  onDownload?: () => void;
  showPatient?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}): JSX.Element {
  const { report } = props;
  const cfg = reportTypeConfig[report.type];

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full text-left bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText size={24} className="text-primary" />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground">{report.title}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${cfg.badgeClassName}`}>
              {cfg.label}
            </span>
            {report.createdBy.role === "admin" && (
              <span className="text-xs px-2 py-1 rounded-full bg-brand-orange/10 text-brand-orange">
                Criado por Admin
              </span>
            )}
          </div>

          {props.showPatient && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground/80">Paciente:</span>{" "}
              {report.patientName || report.patient.name}
            </p>
          )}

          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {report.summary}
          </p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} />
            {formatReportDate(report.date)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onDownload?.();
            }}
          >
            <Download size={16} className="mr-2" />
            PDF
          </Button>

          {props.canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onEdit?.();
                }}
              >
                <Edit size={16} className="mr-2" />
                Editar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onDelete?.();
                }}
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
    </button>
  );
}


