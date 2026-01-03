import type { ReportDetail } from "./types";

export const mockReports: ReportDetail[] = [
  {
    id: 101,
    title: "Relatório Mensal - Janeiro",
    date: "2025-12-10",
    type: "mensal",
    patient: { id: 1, name: "Darissa Freitas" },
    createdBy: { name: "Admin - Sementes da Fala", role: "admin" },
    professionalName: "Dra. (o) Profissional",
    summary:
      "Progresso consistente em articulação e atenção conjunta. Mantém boa participação nas atividades propostas.",
    content:
      "Durante o mês, observamos evolução consistente na articulação de fonemas e na atenção conjunta.\n\nForam realizadas atividades focadas em: respiração, consciência fonológica e ampliação de vocabulário.\n\nOrientações para casa:\n- Repetir exercícios de respiração 5 minutos/dia\n- Praticar nomeação de figuras 10 minutos/dia\n\nObservação: manter rotina e reforço positivo durante as atividades.",
  },
  {
    id: 102,
    title: "Avaliação Inicial",
    date: "2025-11-22",
    type: "avaliacao",
    patient: { id: 1, name: "Darissa Freitas" },
    createdBy: { name: "Admin - Sementes da Fala", role: "admin" },
    professionalName: "Dra. (o) Profissional",
    summary:
      "Avaliação completa de linguagem e fala. Plano terapêutico estabelecido para as próximas semanas.",
    content:
      "Foi realizada avaliação inicial com coleta de histórico e observação clínica.\n\nResultados:\n- Linguagem receptiva: adequada para a faixa etária\n- Linguagem expressiva: demanda estímulo em construção frasal\n- Articulação: presença de trocas em fonemas específicos\n\nPlano:\nSessões semanais com foco em articulação e expansão de vocabulário.",
  },
  {
    id: 201,
    title: "Relatório Trimestral - Q3",
    date: "2025-10-01",
    type: "trimestral",
    patient: { id: 2, name: "João Silva" },
    createdBy: { name: "Admin - Sementes da Fala", role: "admin" },
    professionalName: "Dra. (o) Profissional",
    summary:
      "Aumento de fluência e melhor organização de fala espontânea. Recomenda-se continuidade do acompanhamento.",
    content:
      "No trimestre, houve aumento de fluência e melhor organização de fala espontânea.\n\nDestaques:\n- Melhoras em turnos conversacionais\n- Redução de pausas prolongadas\n\nRecomendação:\nManter acompanhamento e atividades de leitura guiada.",
  },
];


