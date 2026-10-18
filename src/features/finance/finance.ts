import type { AuthUser } from "../../lib/laravel-api.ts";

export type FinanceSettings = {
  session_fee_cents: number;
  payment_term_days: number;
  auto_record: boolean;
  record_from: string;
  version: number;
};
export type FinanceEntry = {
  id: number;
  appointment_id: number | null;
  patient_id: number | null;
  patient_name: string | null;
  kind: "income" | "expense";
  source: "session" | "manual";
  description: string;
  amount_cents: number;
  status: "pending" | "paid" | "void";
  category: string;
  occurred_on: string;
  due_on: string;
  paid_on: string | null;
  payment_method: string | null;
  notes: string | null;
  needs_review: boolean;
  version: number;
};
export type FinanceEntryInput = {
  kind: FinanceEntry["kind"];
  description: string;
  amount_cents: number;
  occurred_on: string;
  due_on: string;
  patient_id: number | null;
  category: string;
  notes: string;
  paid: boolean;
  paid_on?: string | null;
  payment_method?: string | null;
};
export type FinanceEntryUpdate = {
  action: "pay" | "reopen" | "void" | "restore" | "edit";
  version: number;
  paid_on?: string;
  payment_method?: string;
  amount_cents?: number;
  due_on?: string;
  description?: string;
  notes?: string;
};
export type FinanceData = {
  month: string;
  settings: FinanceSettings | null;
  summary: {
    received_cents: number;
    paid_expense_cents: number;
    balance_cents: number;
    pending_income_cents: number;
    pending_expense_cents: number;
    overdue_cents: number;
    session_count: number;
    session_revenue_cents: number;
    upcoming_count: number;
    forecast_cents: number;
  };
  entries: FinanceEntry[];
  patients: { id: number; name: string }[];
  cash_flow: { month: string; income_cents: number; expense_cents: number }[];
};

export function canUsePersonalFinance(
  user:
    | Pick<
        AuthUser,
        | "role"
        | "clinic_name"
        | "clinic_user_id"
        | "affiliated_clinic_user_id"
        | "professional_subscription_status"
      >
    | null
    | undefined,
): boolean {
  return (
    !!user &&
    user.role === "professional" &&
    !user.clinic_name?.trim() &&
    !user.clinic_user_id &&
    !user.affiliated_clinic_user_id &&
    (user.professional_subscription_status === "active" ||
      user.professional_subscription_status === "inactive")
  );
}

export function moneyInputToCents(input: string): number | null {
  let normalized = input
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (/^\d+\.\d{1,2}$/.test(normalized))
    normalized = normalized.replace(".", ",");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized))
    return null;
  const [whole, fraction = ""] = normalized.replace(/\./g, "").split(",");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= 100_000_000 ? result : null;
}

export const moneyInput = (cents: number) =>
  `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const financeToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const financeDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value + "T12:00:00Z"),
  );

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];
export const FINANCE_CATEGORIES = [
  { value: "sessions", label: "Atendimentos" },
  { value: "materials", label: "Materiais" },
  { value: "rent", label: "Aluguel e espaço" },
  { value: "software", label: "Sistemas e assinaturas" },
  { value: "education", label: "Cursos e formação" },
  { value: "taxes", label: "Taxas e impostos" },
  { value: "other", label: "Outros" },
];

export function financeCsv(entries: FinanceEntry[]): string {
  const escape = (value: unknown) => {
    let cell = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell)) cell = "'" + cell;
    return '"' + cell.replace(/"/g, '""') + '"';
  };
  const rows: unknown[][] = [
    [
      "Tipo",
      "Descrição",
      "Paciente",
      "Data",
      "Vencimento",
      "Valor (R$)",
      "Situação",
      "Data do pagamento",
      "Forma",
      "Observações",
    ],
  ];
  for (const entry of entries)
    rows.push([
      entry.kind === "income" ? "Recebimento" : "Despesa",
      entry.description,
      entry.patient_name,
      entry.occurred_on,
      entry.due_on,
      moneyInput(entry.amount_cents),
      entry.status === "paid"
        ? "Pago"
        : entry.status === "void"
          ? "Cancelado"
          : "Pendente",
      entry.paid_on,
      PAYMENT_METHODS.find((method) => method.value === entry.payment_method)
        ?.label,
      entry.notes,
    ]);
  return "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}
