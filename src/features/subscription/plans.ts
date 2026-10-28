export type SubscriptionPlanId = "monthly" | "quarterly" | "annual";

export const professionalPlans = [
  { id: "monthly", number: "01", name: "Mensal", description: "Oferta de boas-vindas", price: "99,90", cadence: "no primeiro mês", charge: "Depois, R$ 169,90/mês.", saving: "Economize R$ 70,00 no primeiro mês.", featured: false, welcome: true, checkoutUrl: "https://pay.kiwify.com.br/S7a5Tfh" },
  { id: "quarterly", number: "02", name: "Trimestral", description: "Mais fôlego para a sua prática.", price: "152,90", cadence: "por mês, equivalente", charge: "R$ 458,70 a cada 3 meses", saving: "R$ 51,00 de economia por trimestre", featured: false, welcome: false, checkoutUrl: "https://pay.kiwify.com.br/dtzU5Sd" },
  { id: "annual", number: "03", name: "Anual", description: "O melhor valor para crescer.", price: "135,90", cadence: "por mês, equivalente", charge: "R$ 1.630,80 por ano", saving: "R$ 408,00 de economia por ano", featured: true, welcome: false, checkoutUrl: "https://pay.kiwify.com.br/fga1ut3" },
] as const;

export const professionalPlanBenefits = [
  "Sessões ao vivo com interação na tela",
  "Jogos terapêuticos e atividades personalizadas",
  "Agenda e perfis de paciente vinculados",
  "Relatórios, avaliações e evoluções",
  "Boca 3D durante o atendimento",
];

export function subscriptionPlanId(value: string | null): SubscriptionPlanId | null {
  return professionalPlans.find((plan) => plan.id === value)?.id ?? null;
}

export function professionalSignupPath(plan?: SubscriptionPlanId) {
  return `/cadastro?perfil=profissional${plan ? `&plano=${plan}` : ""}`;
}

export function professionalOnboardingPath(search: string) {
  const plan = subscriptionPlanId(new URLSearchParams(search).get("plano"));
  return `/profissional/assinatura?cadastro=concluido${plan ? `&plano=${plan}` : ""}`;
}
