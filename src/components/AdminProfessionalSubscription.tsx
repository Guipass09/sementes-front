import { useEffect, useState } from "react";
import { Clock, History, ShieldCheck } from "lucide-react";
import {
  adminSubscription,
  isApiError,
  type SubscriptionResponse,
  type ProfessionalSubscription,
} from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import SubscriptionTimer from "./SubscriptionTimer";
import BrandedConfirmDialog from "./BrandedConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  financeToday,
  formatMoney,
  moneyInputToCents,
  PAYMENT_METHODS,
} from "@/features/finance/finance";
import {
  subscriptionDate,
  subscriptionEventDetails,
  subscriptionPlanLabel,
} from "@/lib/subscription-details";

const actions: Record<string, string> = {
  activate: "Período ativado",
  extend: "Prazo ampliado",
  suspend: "Acesso desativado",
  resume: "Acesso reativado",
};
const plans: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  custom: "Personalizado",
};
const units: Record<string, string> = {
  hour: "hora(s)",
  day: "dia(s)",
  week: "semana(s)",
  month: "mês(es)",
  year: "ano(s)",
};
export default function AdminProfessionalSubscription({
  id,
  onChange,
}: {
  id: number;
  onChange: (value: ProfessionalSubscription) => void;
}) {
  const [data, setData] = useState<SubscriptionResponse>();
  const [plan, setPlan] = useState("monthly");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("day");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [recordPayment, setRecordPayment] = useState(true);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(financeToday);
  const [method, setMethod] = useState("pix");
  const paymentCents = moneyInputToCents(amount);
  const invalidPayment =
    recordPayment && (!paymentCents || !paidOn || paidOn > financeToday());
  useEffect(() => {
    setRecordPayment(true);
    setAmount("");
    setPaidOn(financeToday());
    setMethod("pix");
    setError("");
    setConfirmation(null);
  }, [id]);
  useEffect(() => {
    let current = true;
    setData(undefined);
    adminSubscription(id)
      .then((value) => {
        if (current) {
          setData(value);
          const period = value.subscription.period;
          setPlan(
            period &&
              ["monthly", "quarterly", "annual", "custom"].includes(period.plan)
              ? period.plan
              : "monthly",
          );
          setQuantity(period?.quantity ?? 1);
          setUnit(
            period &&
              ["hour", "day", "week", "month", "year"].includes(period.unit)
              ? period.unit
              : "day",
          );
        }
      })
      .catch(() => {
        if (current)
          setError(
            "Não foi possível carregar a assinatura. Reabra o perfil para tentar novamente.",
          );
      });
    return () => {
      current = false;
    };
  }, [id]);
  async function save(action: string, confirmed = false) {
    if ((action === "activate" || action === "extend") && invalidPayment) {
      setError("Confira o valor e a data do pagamento recebido.");
      return;
    }
    if (
      !confirmed &&
      (action === "suspend" ||
        (action === "activate" && data?.subscription.expires_at))
    ) {
      setConfirmation(action);
      return;
    }
    setConfirmation(null);
    setBusy(true);
    setError("");
    try {
      const result = await adminSubscription(
        id,
        action === "suspend" || action === "resume"
          ? { action }
          : {
              action,
              plan,
              quantity,
              unit,
              ...(recordPayment
                ? {
                    payment: {
                      amount_cents: paymentCents!,
                      paid_on: paidOn,
                      method,
                    },
                  }
                : {}),
            },
      );
      setData(result);
      onChange(result.subscription);
      setAmount("");
    } catch (e) {
      setError(
        isApiError(e)
          ? String(e.data?.message ?? "Não foi possível salvar.")
          : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectClass =
    "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const invalidPeriod =
    plan === "custom" &&
    (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000);
  return (
    <section
      className="space-y-4 border-y border-border py-5"
      aria-label="Assinatura profissional"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} /> Assinatura individual
        </h4>
        <span className="text-sm font-medium text-primary">
          <SubscriptionTimer subscription={data?.subscription} />
        </span>
      </div>
      {!data && !error && <p role="status">Carregando assinatura...</p>}
      {data && (
        <>
          {data.subscription.period && (
            <p className="text-sm font-medium">
              {plans[data.subscription.period.plan] ?? "Personalizado"} ·{" "}
              {data.subscription.period.quantity}{" "}
              {units[data.subscription.period.unit]}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm">
            <Clock size={16} />{" "}
            {data.subscription.expires_at
              ? `Validade: ${new Date(data.subscription.expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)`
              : "Nenhum prazo definido"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Plano contratado
              <select
                className={selectClass}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                disabled={busy}
              >
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            {plan === "custom" && (
              <>
                <label className="grid gap-1 text-sm">
                  Duração
                  <input
                    className={selectClass}
                    type="number"
                    min={1}
                    max={10000}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    disabled={busy}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Unidade
                  <select
                    className={selectClass}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={busy}
                  >
                    <option value="hour">Horas</option>
                    <option value="day">Dias</option>
                    <option value="week">Semanas</option>
                    <option value="month">Meses</option>
                    <option value="year">Anos</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="border-y border-border py-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={recordPayment}
                onCheckedChange={(value) => setRecordPayment(value === true)}
                disabled={busy}
              />
              Pagamento recebido por este período
            </label>
            {recordPayment && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  Valor pago pelo período (R$)
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Data do pagamento
                  <Input
                    type="date"
                    min="2000-01-01"
                    max={financeToday()}
                    value={paidOn}
                    onChange={(event) => setPaidOn(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Forma de pagamento
                  <select
                    className={selectClass}
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    disabled={busy}
                  >
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {!recordPayment && (
              <p className="mt-3 text-xs text-muted-foreground">
                Este período ficará sem pagamento registrado.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || invalidPeriod || invalidPayment}
              onClick={() => void save("activate")}
            >
              {busy ? "Salvando..." : "Ativar novo período"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || invalidPeriod || invalidPayment}
              onClick={() => void save("extend")}
            >
              Adicionar prazo
            </Button>
            {data.subscription.status === "suspended" ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void save("resume")}
              >
                Reativar acesso
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void save("suspend")}
              >
                Desativar acesso
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Adicionar prazo preserva o tempo restante. Ao vencer ou desativar, o
            acesso é bloqueado, sem excluir pacientes, atividades ou documentos.
            A desativação não pausa a validade.
          </p>
          <details open>
            <summary className="cursor-pointer text-sm font-medium">
              <History className="mr-2 inline" size={16} />
              Histórico de planos e pagamentos
            </summary>
            <ul className="mt-3 divide-y divide-border">
              {data.events.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  Nenhuma alteração registrada.
                </li>
              )}
              {data.events.map((event) => {
                const details = subscriptionEventDetails(event.after);
                const date = event.created_at.includes("T")
                  ? event.created_at
                  : event.created_at.replace(" ", "T") + "Z";
                return (
                  <li
                    key={event.id}
                    className="grid min-w-0 gap-3 py-4 sm:grid-cols-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {actions[event.action] ?? event.action}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {subscriptionDate(date)} · Admin #{event.admin_id}
                      </p>
                      <p className="mt-2 text-sm">
                        {subscriptionPlanLabel(details.period)}
                      </p>
                      {details.expires_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Validade: {subscriptionDate(details.expires_at)}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Valor pago pelo período
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {details.payment
                          ? formatMoney(details.payment.amount_cents)
                          : ["activate", "extend"].includes(event.action)
                            ? "Valor não registrado"
                            : "Não se aplica"}
                      </p>
                      {details.payment && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {PAYMENT_METHODS.find(
                            (item) => item.value === details.payment!.method,
                          )?.label ?? "Outro"}{" "}
                          · {subscriptionDate(details.payment.paid_on)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <BrandedConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={
          confirmation === "suspend"
            ? "Desativar assinatura?"
            : "Substituir período atual?"
        }
        description={
          confirmation === "suspend"
            ? "O acesso será bloqueado, sem excluir dados. A validade continuará contando."
            : "O novo prazo começa agora e substitui o tempo restante. Para preservar esse tempo, use Adicionar prazo."
        }
        confirmLabel="Confirmar alteração"
        onConfirm={() => {
          if (confirmation) void save(confirmation, true);
        }}
      />
    </section>
  );
}
