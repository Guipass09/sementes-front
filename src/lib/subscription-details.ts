import type {
  AuthUser,
  ProfessionalSubscription,
  SubscriptionPayment,
} from "./laravel-api.ts";

export function subscriptionEventDetails(snapshot: string): {
  period: ProfessionalSubscription["period"];
  expires_at: string | null;
  payment: SubscriptionPayment | null;
} {
  try {
    const data = JSON.parse(snapshot);
    const period = data?.period;
    const payment = data?.payment;
    return {
      period:
        period &&
        typeof period.plan === "string" &&
        typeof period.unit === "string" &&
        Number.isInteger(period.quantity) &&
        period.quantity > 0
          ? period
          : null,
      expires_at: typeof data?.expires_at === "string" ? data.expires_at : null,
      payment:
        payment &&
        Number.isInteger(payment.amount_cents) &&
        payment.amount_cents > 0 &&
        typeof payment.paid_on === "string" &&
        typeof payment.method === "string"
          ? payment
          : null,
    };
  } catch {
    return { period: null, expires_at: null, payment: null };
  }
}

export function hasIndividualSubscription(
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
) {
  return (
    !!user &&
    user.role === "professional" &&
    !user.clinic_name?.trim() &&
    !user.clinic_user_id &&
    !user.affiliated_clinic_user_id &&
    ["active", "inactive"].includes(user.professional_subscription_status ?? "")
  );
}

export function subscriptionPlanLabel(
  period: ProfessionalSubscription["period"],
) {
  if (!period) return "Plano não informado";
  const plans: Record<string, string> = {
    monthly: "Mensal",
    quarterly: "Trimestral",
    annual: "Anual",
  };
  if (plans[period.plan]) return plans[period.plan];
  const units: Record<string, [string, string]> = {
    hour: ["hora", "horas"],
    day: ["dia", "dias"],
    week: ["semana", "semanas"],
    month: ["mês", "meses"],
    year: ["ano", "anos"],
  };
  const unit = units[period.unit];
  return unit
    ? `${period.quantity} ${unit[period.quantity === 1 ? 0 : 1]}`
    : "Personalizado";
}

export function subscriptionTimeLeft(subscription: ProfessionalSubscription) {
  if (!subscription.expires_at) return "Sem período ativo";
  const milliseconds =
    Date.parse(subscription.expires_at) - Date.parse(subscription.server_now);
  if (!Number.isFinite(milliseconds)) return "Prazo indisponível";
  if (milliseconds <= 0) return "Período encerrado";
  const hours = Math.ceil(milliseconds / 3_600_000);
  if (hours < 24) return hours === 1 ? "Até 1 hora" : `Até ${hours} horas`;
  const days = Math.ceil(milliseconds / 86_400_000);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function subscriptionDate(value: string | null) {
  if (!value) return "Não definida";
  const date = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date)
    : "Não informada";
}
