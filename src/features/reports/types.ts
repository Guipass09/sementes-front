export type ReportType = "mensal" | "trimestral" | "avaliacao";

export type ReportAuthor = {
  id?: number;
  name: string;
  role: "admin" | "user";
};

export type ReportPatient = {
  id: number;
  name: string;
};

export type ReportSummary = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  type: ReportType;
  patient: ReportPatient;
  patientName: string; // nome digitado no relatório (pode ser diferente do nome da conta)
  createdBy: ReportAuthor;
  professionalName: string;
  summary: string;
};

export type ReportDetail = ReportSummary & {
  content: string; // texto completo (com quebras de linha)
};


