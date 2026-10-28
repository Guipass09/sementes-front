import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CheckCircle2,
  History,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { me, professionalSubscription } from "@/lib/laravel-api";
import ProfessionalPlanSelection from "@/components/ProfessionalPlanSelection";
import { useSubscriptionExpired } from "@/components/SubscriptionTimer";
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
  kiwify_update: "Atualização do pagamento Kiwify",
};

export default function ProfessionalSubscription() {
  const { user } = useAuth();
  if (!hasIndividualSubscription(user))
    return <Navigate to="/profissional" replace />;
  return <SubscriptionWorkspace key={user!.id} userId={user!.id} />;
}

function SubscriptionWorkspace({ userId }: { userId: number }) {
  const auth = useAuth();
  const user = auth.user!;
  const expired = useSubscriptionExpired(user.professional_subscription);
  const needsSubscription = user.professional_subscription_status === "inactive" || expired;
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState(false);
  const [verification, setVerification] = useState("");
  const query = useQuery({
    queryKey: ["my-subscription", userId, page],
    queryFn: () => professionalSubscription(page),
    refetchInterval: needsSubscription ? 15_000 : 60_000,
  });
  const data = query.data;
  const subscription = data?.subscription;
  const welcomeOffer = subscription?.status === "pending" && !subscription.expires_at && !subscription.period && data?.pagination.total === 0;

  useEffect(() => {
    if (subscription?.status !== "active" || !needsSubscription) return;
    let cancelled = false;
    void me().then((fresh) => {
      if (!cancelled && fresh.id === userId) auth.setAuthUser(fresh);
    }).catch(() => { /* Preserve the current access state if verification fails. */ });
    return () => { cancelled = true; };
  }, [subscription?.status, needsSubscription, userId, auth.setAuthUser]);

  const verifySubscription = async () => {
    if (checking) return;
    setChecking(true);
    setVerification("");
    try {
      const fresh = await me();
      if (fresh.id !== userId) throw new Error("Conta diferente");
      auth.setAuthUser(fresh);
      await query.refetch();
      setVerification(fresh.professional_subscription_status === "active"
        ? "Assinatura ativa. Seu espaço profissional está disponível."
        : "Sua assinatura ainda não está ativa. Se você já pagou, aguarde a confirmação e verifique novamente.");
    } catch {
      setVerification("Não foi possível verificar agora. Sua conta foi preservada; tente novamente em instantes.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <BadgeCheck className="text-brand-green-dark" size={25} />
            {needsSubscription ? "Sua conta está pronta." : "Assinatura"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsSubscription ? "Falta escolher seu plano para liberar seu espaço profissional." : "Seu plano e histórico de renovações"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void verifySubscription()}
          disabled={checking}
        >
          <RefreshCw
            size={15}
            className={`mr-2 ${checking ? "animate-spin" : ""}`}
          />
          {checking ? "Verificando..." : needsSubscription ? "Verificar assinatura" : "Atualizar"}
        </Button>
      </header>
      {verification && <p role="status" className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">{verification}</p>}
      {needsSubscription ? (
        <>
          <ol aria-label="Etapas da contratação" className="mb-8 flex flex-wrap gap-x-6 gap-y-3 border-y border-border py-4 text-sm">
            <li className="flex items-center gap-2 text-brand-green-dark"><CheckCircle2 size={18} aria-hidden="true" />1. Conta criada</li>
            <li className="font-semibold" aria-current="step">2. Escolha seu plano</li>
            <li className="text-muted-foreground">3. Pagamento na Kiwify</li>
          </ol>
          <ProfessionalPlanSelection userId={userId} email={user.email} welcomeOffer={welcomeOffer} />
          <section aria-label="Conferir pagamento" className="my-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div className="max-w-xl"><h2 className="font-semibold">Já concluiu o pagamento?</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Volte a esta página para acompanhar sua assinatura. O acesso é liberado após a confirmação do pagamento.</p></div>
            <Button variant="outline" className="min-h-11" onClick={() => void verifySubscription()} disabled={checking}><RefreshCw size={16} className={`mr-2 ${checking ? "animate-spin" : ""}`} />Já paguei, verificar assinatura</Button>
          </section>
        </>
      ) : <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={20} className="text-brand-green-dark" />Sua assinatura está ativa.</p><Button asChild><Link to="/profissional">Acessar meu espaço</Link></Button></div>}
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
            {(subscription.period || !needsSubscription) && <section
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
            </section>}
            {(data.events.length > 0 || !needsSubscription) && <section className="py-7" aria-label="Histórico da assinatura">
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
            </section>}
          </>
        )
      )}
    </div>
  );
}
