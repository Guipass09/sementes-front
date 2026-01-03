import { formatPdfDate } from "./report-config";

function sanitizeFilenamePart(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function buildReportPdfFilename(patientName: string, dateStr: string): string {
  const safeName = sanitizeFilenamePart(patientName) || "paciente";
  const safeDate = sanitizeFilenamePart(formatPdfDate(dateStr));
  return `relatorio_${safeName}_${safeDate}.pdf`;
}

export async function downloadElementAsPdf(params: {
  element: HTMLElement;
  filename: string;
}): Promise<void> {
  // html2pdf.js não tem tipos oficiais; usamos import dinâmico para reduzir bundle.
  const html2pdf = (await import("html2pdf.js")).default as any;

  await html2pdf()
    .set({
      margin: [12, 12, 12, 12], // mm
      filename: params.filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(params.element)
    .save();
}

















