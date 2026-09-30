import type { ReportDetail, ReportType } from "./types";

export type ReportSection = "relatorio" | "avaliacao" | "evolucao";

export type PatientReportGroup = {
  key: string;
  name: string;
  total: number;
  sections: Record<ReportSection, ReportDetail[]>;
};

const sectionLabels: Record<ReportSection, string> = {
  relatorio: "Relatorios",
  avaliacao: "Avaliacoes",
  evolucao: "Evolucoes",
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function reportSection(type: ReportType): ReportSection {
  if (type === "avaliacao") return "avaliacao";
  if (type === "evolucao") return "evolucao";
  return "relatorio";
}

export function filterReports(reports: ReportDetail[], searchTerm: string): ReportDetail[] {
  const query = normalize(searchTerm);
  if (!query) return reports;
  return reports.filter((report) =>
    normalize([
      report.title,
      report.patient?.name ?? "",
      report.patientName ?? "",
      report.type,
      sectionLabels[reportSection(report.type)],
    ].join(" ")).includes(query)
  );
}

export function groupReportsByPatient(reports: ReportDetail[]): PatientReportGroup[] {
  const groups = new Map<string, PatientReportGroup>();

  for (const report of reports) {
    const id = Number(report.patient?.id);
    const patientName = (report.patient?.name || report.patientName || "").trim();
    const key = Number.isInteger(id) && id > 0
      ? `id:${id}`
      : patientName
        ? `name:${normalize(patientName)}`
        : report.isPrivate ? "private" : "unassigned";
    const name = patientName || (report.isPrivate ? "No meu perfil" : "Sem paciente");
    let group = groups.get(key);
    if (!group) {
      group = { key, name, total: 0, sections: { relatorio: [], avaliacao: [], evolucao: [] } };
      groups.set(key, group);
    } else if (patientName && (group.name === "Sem paciente" || group.name === "No meu perfil")) {
      group.name = patientName;
    }

    group.sections[reportSection(report.type)].push(report);
    group.total += 1;
  }

  return Array.from(groups.values())
    .map((group) => {
      for (const section of Object.values(group.sections)) {
        section.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
      }
      return group;
    })
    .sort((a, b) => a.key === "private" ? -1 : b.key === "private" ? 1 : a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}
