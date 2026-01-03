import type { ReportType } from "./types";

export const reportTypeConfig: Record<
  ReportType,
  { label: string; badgeClassName: string }
> = {
  mensal: {
    label: "Relatório Mensal",
    badgeClassName: "bg-brand-green/10 text-brand-green",
  },
  trimestral: {
    label: "Relatório Trimestral",
    badgeClassName: "bg-brand-blue/10 text-brand-blue",
  },
  avaliacao: {
    label: "Avaliação",
    badgeClassName: "bg-brand-purple/10 text-brand-purple",
  },
};

export function formatReportDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatPdfDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

















