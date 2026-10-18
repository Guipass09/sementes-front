import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  History,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { professionalSubscription } from "@/lib/laravel-api";
import {
  hasIndividualSubscription,
  subscriptionDate,
  subscriptionPlanLabel,
  subscriptionTimeLeft,
} from "@/lib/subscription-details";
import { formatMoney, PAYMENT_METHODS } from "@/features/finance/finance";

const statuses: Record<string, string> = {
  active: "Ativa",
  pending: "Aguardando ativação",
  expired: "Vencida",
  suspended: "Suspensa",
};
const actions: Record<string, string> = {
  activate: "Ativação",
  extend: "Renovação",
  suspend: "Acesso suspenso",
  resume: "Acesso reativado",
};

export default function ProfessionalSubscription() {
  const { user } = useAuth();
  if (!hasIndividualSubscription(user))
    return <Navigate to="/profissional" replace />;
  return <SubscriptionWorkspace key={user!.id} userId={user!.id} />;
}

function SubscriptionWorkspace({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["my-subscription", userId, page],
    queryFn: () => professionalSubscription(page),
    refetchInterval: 60_000,
  });
  const data = query.data;
  const subscription = data?.subscription;
  return (
    <div className="container mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <BadgeCheck className="text-brand-green-dark" size={25} />
            Assinatura
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu plano e histórico de renovações
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            size={15}
            className={`mr-2 ${query.isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </header>
      {query.isPending ? (
        <div
          className="space-y-4"
          role="status"
          aria-label="Carregando assinatura"
        >
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="border-y border-border py-8">
          <h2 className="font-semibold">
            Não foi possível carregar a assinatura
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tente novamente em instantes.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        data &&
        subscription && (
          <>
            <section
              aria-label="Plano atual"
              className="border-y border-border py-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold">
                    {subscriptionPlanLabel(subscription.period)}
                  </h2>
                  <span
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${subscription.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    {statuses[subscription.status] ?? "Não disponível"}
                  </span>
                </div>
                <Button asChild>
                  <a
                    href="https://wa.me/message/GKL4EEB2NSI4A1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    {subscription.status === "active"
                      ? "Solicitar renovação"
                      : "Solicitar ativação"}
                  </a>
                </Button>
              </div>
              <dl className="mt-7 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays size={16} />
                    Validade
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {subscriptionDate(subscription.expires_at)}
                  </dd>
                  {subscription.expires_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Até{" "}
                      {new Date(subscription.expires_at).toLocaleTimeString(
                        "pt-BR",
                        {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                      , horário de Brasília
                    </p>
                  )}
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 size={16} />
                    Tempo até o fim do período
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {subscriptionTimeLeft(subscription)}
                  </dd>
                  {subscription.status === "suspended" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      A suspensão não interrompe a validade do período.
                    </p>
                  )}
                </div>
              </dl>
            </section>
            <section className="py-7" aria-label="Histórico da assinatura">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <History size={18} />
                  Histórico da assinatura
                </h2>
                <span className="text-xs text-muted-foreground">
                  {data.pagination.total}{" "}
                  {data.pagination.total === 1 ? "registro" : "registros"}
                </span>
              </div>
              {data.events.length === 0 ? (
                <p className="border-y border-border py-8 text-sm text-muted-foreground">
                  Nenhuma ativação ou renovação registrada até o momento.
                </p>
              ) : (
                <>
                  <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b border-border pb-3 text-xs font-medium text-muted-foreground md:grid">
                    <span>Registro</span>
                    <span>Plano e validade</span>
                    <span>Valor pago</span>
                    <span>Pagamento</span>
                  </div>
                  <ul>
                    {data.events.map((event) => (
                      <li
                        key={event.id}
                        className="grid min-w-0 gap-4 border-b border-border py-5 sm:grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {actions[event.action] ??
                              "Atualização da assinatura"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {subscriptionDate(event.created_at)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm">
                            {subscriptionPlanLabel(event.period)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.expires_at
                              ? `Validade: ${subscriptionDate(event.expires_at)}`
                              : "Validade não definida"}
                          </p>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                            Valor pago
                          </span>
                          <p
                            className={`text-sm ${event.payment ? "font-semibold tabular-nums" : "text-muted-foreground"}`}
                          >
                            {event.payment
                              ? formatMoney(event.payment.amount_cents)
                              : ["activate", "extend"].includes(event.action)
                                ? "Valor não registrado"
                                : "—"}
                          </p>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                            Pagamento
                          </span>
                          <p className="text-sm">
                            {event.payment
                              ? (PAYMENT_METHODS.find(
                                  (method) =>
                                    method.value === event.payment!.method,
                                )?.label ?? "Outro")
                              : "—"}
                          </p>
                          {event.payment && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {subscriptionDate(event.payment.paid_on)}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.pagination.last_page > 1 && (
                <div className="mt-5 flex items-center justify-end gap-3">
                  <span className="text-xs text-muted-foreground">
                    Página {data.pagination.page} de {data.pagination.last_page}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Página anterior"
                    aria-label="Página anterior"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    <ChevronLeft size={17} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Próxima página"
                    aria-label="Próxima página"
                    disabled={
                      page >= data.pagination.last_page || query.isFetching
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    <ChevronRight size={17} />
                  </Button>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
