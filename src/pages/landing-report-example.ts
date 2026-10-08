import type { ReportDetail } from "@/features/reports/types";

// Public demonstration only. No patient record is loaded or persisted.
export const landingReportExample: ReportDetail = {
  id: 0,
  title: "Relatório de acompanhamento — exemplo fictício",
  date: "2026-10-08",
  type: "mensal",
  status: "published",
  patient: { id: null, name: "Paciente demonstrativo" },
  patientName: "Paciente demonstrativo",
  professionalName: "Profissional demonstrativa",
  createdBy: { name: "Profissional demonstrativa", role: "professional" },
  summary: "Exemplo de organização do registro, com dados inteiramente fictícios.",
  content: "EXEMPLO FICTÍCIO — DEMONSTRAÇÃO DA PLATAFORMA\nEste documento não corresponde a um paciente ou atendimento real.\n\nAtividades realizadas\nForam utilizados materiais de nomeação de figuras e identificação de sons, com apoio visual durante a sessão.\n\nObservações do atendimento\nNeste exemplo, o registro reúne a participação nas propostas e os apoios utilizados pela profissional.\n\nPlanejamento\nRetomar as atividades selecionadas e registrar as observações do próximo encontro.",
};
