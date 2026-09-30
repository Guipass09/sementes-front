import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, ClipboardCheck, FileText, UserRound } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ReportDetail } from "./types";
import { groupReportsByPatient } from "./report-groups";
import type { ReportSection } from "./report-groups";

const sections = [
  { key: "relatorio", label: "Relatórios", icon: FileText, color: "text-brand-green" },
  { key: "avaliacao", label: "Avaliações", icon: ClipboardCheck, color: "text-brand-purple" },
  { key: "evolucao", label: "Evoluções", icon: Activity, color: "text-brand-blue" },
] as const satisfies ReadonlyArray<{ key: ReportSection; label: string; icon: typeof FileText; color: string }>;

export function ReportsByPatient(props: {
  reports: ReportDetail[];
  renderReport: (report: ReportDetail) => ReactNode;
}): JSX.Element {
  const groups = useMemo(() => groupReportsByPatient(props.reports), [props.reports]);
  const [openPatient, setOpenPatient] = useState(() => groups[0]?.key ?? "");

  useEffect(() => {
    setOpenPatient((current) => groups.some((group) => group.key === current) ? current : groups[0]?.key ?? "");
  }, [groups]);

  return (
    <Accordion type="single" collapsible value={openPatient} onValueChange={setOpenPatient} className="border-t border-border">
      {groups.map((group) => (
        <AccordionItem key={group.key} value={group.key} className="border-b border-border">
          <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline sm:py-5">
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserRound size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold text-foreground sm:text-base">{group.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {group.total} {group.total === 1 ? "documento" : "documentos"}
                </span>
              </span>
              <span className="hidden flex-wrap justify-end gap-x-4 gap-y-1 pr-2 text-xs font-normal text-muted-foreground md:flex">
                {sections.filter((section) => group.sections[section.key].length > 0).map((section) => (
                  <span key={section.key}>{section.label} {group.sections[section.key].length}</span>
                ))}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pl-0 sm:pl-[52px]">
            <div className="space-y-6">
              {sections.filter((section) => group.sections[section.key].length > 0).map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.key} aria-label={`${section.label} de ${group.name}`}>
                    <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2">
                      <Icon size={17} className={section.color} aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-foreground">{section.label}</h2>
                      <span className="text-xs text-muted-foreground">{group.sections[section.key].length}</span>
                    </div>
                    <div className="space-y-3">
                      {group.sections[section.key].map((report) => (
                        <div key={report.id}>{props.renderReport(report)}</div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
