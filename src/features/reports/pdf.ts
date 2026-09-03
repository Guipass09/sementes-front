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
      margin: [0, 0, 0, 0],
      filename: params.filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        onclone: (clonedDocument: Document) => {
          const report = clonedDocument.querySelector<HTMLElement>("[data-report-pdf]");
          if (report) {
            Object.assign(report.style, {
              width: "794px",
              maxWidth: "794px",
              margin: "0",
              border: "0",
              borderRadius: "0",
              boxShadow: "none",
              overflow: "visible",
            });
          }

          clonedDocument.querySelectorAll<HTMLElement>("[data-pdf-avoid]").forEach((node) => {
            Object.assign(node.style, {
              breakInside: "avoid",
              pageBreakInside: "avoid",
            });
          });

          clonedDocument.querySelectorAll<HTMLElement>("[data-pdf-text]").forEach((node) => {
            Object.assign(node.style, {
              overflowWrap: "break-word",
              wordBreak: "normal",
              hyphens: "auto",
            });
          });
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ["[data-pdf-avoid]", "p", "h1", "h2", "h3", "table", "tr", "img"],
      },
    })
    .from(params.element)
    .save();
}

















