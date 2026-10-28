import { useState } from "react";
import { ArrowRight, Check, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { professionalPlanBenefits, professionalPlans, subscriptionPlanId, type SubscriptionPlanId } from "@/features/subscription/plans";

type Props = { userId: number; email: string; welcomeOffer: boolean };

export default function ProfessionalPlanSelection({ userId, email, welcomeOffer }: Props) {
  const [search, setSearch] = useSearchParams();
  const selected = subscriptionPlanId(search.get("plano"));
  const storageKey = `sementes:subscription-checkout:${userId}`;
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanId | null>(() => {
    try { return subscriptionPlanId(sessionStorage.getItem(storageKey)); } catch { return null; }
  });

  const openCheckout = (plan: SubscriptionPlanId) => {
    setCheckoutPlan(plan);
    try { sessionStorage.setItem(storageKey, plan); } catch { /* Checkout still works without storage. */ }
    setSearch((current) => {
      const next = new URLSearchParams(current);
      next.set("plano", plan);
      return next;
    }, { replace: true, preventScrollReset: true });
  };

  return (
    <section id="planos" aria-labelledby="subscription-plans-title" className="scroll-mt-6">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-green-dark">Seu próximo passo</p>
        <h2 id="subscription-plans-title" className="mt-2 font-display text-2xl font-bold sm:text-3xl">Escolha seu plano e comece a atender.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Todos os planos oferecem acesso completo. Escolha o período e conclua a contratação no checkout da Kiwify.</p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <CreditCard className="mt-0.5 shrink-0 text-brand-green-dark" size={20} aria-hidden="true" />
        <p className="min-w-0 leading-relaxed">Use no pagamento o mesmo e-mail da sua conta: <strong className="break-all text-foreground">{email}</strong>.</p>
      </div>

      {checkoutPlan && (
        <div role="status" className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950">
          <p className="font-semibold">Checkout do plano {professionalPlans.find((plan) => plan.id === checkoutPlan)?.name.toLowerCase()} aberto.</p>
          <p className="mt-1">Conclua o pagamento na outra aba e volte aqui para verificar sua assinatura. Abrir o checkout não confirma a contratação.</p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {professionalPlans.map((plan) => {
          const offer = plan.welcome && welcomeOffer;
          const price = plan.welcome && !welcomeOffer ? "169,90" : plan.price;
          const recommended = plan.welcome && welcomeOffer;
          return (
            <article key={plan.id} aria-label={`Plano ${plan.name}`} className={`flex min-w-0 flex-col rounded-2xl border bg-card p-5 sm:p-6 ${selected === plan.id || recommended ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border"}`}>
              <div className="mb-5 flex min-h-7 flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">ACESSO COMPLETO</span>
                {(offer || plan.featured) && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${offer ? "bg-primary/10 text-brand-green-dark" : "bg-amber-100 text-amber-900"}`}>{offer ? "Oferta de boas-vindas" : "Melhor valor"}</span>}
              </div>
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <div className="mt-5 flex flex-wrap items-baseline gap-1 font-display font-bold"><span className="text-lg">R$</span><span className="text-4xl tracking-tight">{price}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">{offer ? plan.cadence : plan.welcome ? "por mês" : plan.cadence}</p>
              <div className="mt-5 border-y border-border py-4">
                <p className="text-sm font-semibold">{plan.welcome && !offer ? "Cobrança mensal de R$ 169,90" : plan.charge}</p>
                {(!plan.welcome || offer) && <p className="mt-2 text-xs font-semibold text-brand-green-dark">{plan.saving}</p>}
              </div>
              <ul className="my-5 space-y-3">
                {professionalPlanBenefits.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm leading-relaxed"><Check size={16} className="mt-0.5 shrink-0 text-brand-green-dark" aria-hidden="true" /><span>{benefit}</span></li>)}
              </ul>
              <a href={plan.checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={() => openCheckout(plan.id)} aria-label={`${offer ? "Começar por R$ 99,90" : `Assinar ${plan.name.toLowerCase()}`} — checkout da Kiwify em nova aba`} className={`mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${recommended || selected === plan.id ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-primary text-brand-green-dark hover:bg-primary/10"}`}>
                {offer ? "Começar por R$ 99,90" : `Assinar ${plan.name.toLowerCase()}`}<ArrowRight size={17} className="shrink-0" aria-hidden="true" />
              </a>
              <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-brand-green-dark"><ShieldCheck size={17} aria-hidden="true" />7 dias de garantia</p>
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">Reembolso integral se solicitado em até 7 dias após a contratação.</p>
            </article>
          );
        })}
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ExternalLink size={14} className="mt-0.5 shrink-0" aria-hidden="true" />O pagamento é concluído em uma nova aba da Kiwify. Sua conta permanece aberta aqui.</p>
      {welcomeOffer && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Oferta de R$ 99,90 exclusiva para novos assinantes do plano mensal, uma única vez por conta. A partir do segundo mês, R$ 169,90/mês. Não cumulativa com outras promoções.</p>}
    </section>
  );
}
