import type { AuthUser } from "@/lib/laravel-api";
import type { ReportDetail } from "./types";
import { mockReports } from "./mock";

/**
 * Backend do repositório atual NÃO possui endpoints de relatórios.
 * Mesmo assim, deixamos a camada pronta para consumir API caso exista no seu ambiente.
 *
 * Endpoints esperados (ajuste se o seu backend expõe outros):
 * - Admin: GET /api/admin/reports
 * - User:  GET /api/reports
 */
async function tryFetchReportsFromApi(scope: "admin" | "user"): Promise<ReportDetail[] | null> {
  try {
    const mod = await import("@/lib/laravel-api");
    const api = mod as any;

    if (scope === "admin" && typeof api.adminListReports === "function") {
      const rows = await api.adminListReports();
      return (rows || []).map(mapRowToDetail);
    }
    if (scope === "user" && typeof api.userListReports === "function") {
      const rows = await api.userListReports();
      return (rows || []).map(mapRowToDetail);
    }
    return null;
  } catch {
    return null;
  }
}

function mapRowToDetail(r: any): ReportDetail {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    type: r.type,
    professionalName: r.professional_name,
    summary: r.summary,
    content: r.content,
    patientName: (r.patient_name ?? r.patient?.name ?? "").toString(),
    patient: { id: r.patient?.id, name: r.patient?.name },
    createdBy: {
      id: r.created_by?.id,
      name: r.created_by?.name,
      role: r.created_by?.role,
    },
  };
}

export async function listReports(params: {
  currentUser: AuthUser;
}): Promise<ReportDetail[]> {
  const scope = params.currentUser.role === "admin" ? "admin" : "user";

  const fromApi = await tryFetchReportsFromApi(scope);
  if (fromApi && Array.isArray(fromApi)) return fromApi;

  // Fallback: mock (permite desenvolver e validar UI/PDF enquanto a API real não existe)
  if (params.currentUser.role === "admin") return mockReports;
  const mine = mockReports.filter((r) => r.patient.id === params.currentUser.id);
  if (mine.length > 0) return mine;

  // Se o usuário logado não existir nos mocks, gera 1 relatório básico para permitir validar UI/PDF.
  return [
    {
      ...mockReports[0],
      id: Number(`${params.currentUser.id}01`),
      patient: { id: params.currentUser.id, name: params.currentUser.name },
      title: "Relatório Mensal - Prévia",
      date: new Date().toISOString().slice(0, 10),
    },
  ];
}


