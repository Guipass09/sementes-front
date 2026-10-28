import assert from "node:assert/strict";
import test from "node:test";
import { professionalOnboardingPath, professionalPlans, professionalSignupPath, subscriptionPlanId } from "../src/features/subscription/plans.ts";

test("each plan uses its own approved Kiwify checkout", () => {
  assert.deepEqual(professionalPlans.map(({ id, checkoutUrl }) => [id, checkoutUrl]), [
    ["monthly", "https://pay.kiwify.com.br/S7a5Tfh"],
    ["quarterly", "https://pay.kiwify.com.br/dtzU5Sd"],
    ["annual", "https://pay.kiwify.com.br/fga1ut3"],
  ]);
  assert.equal(new Set(professionalPlans.map((plan) => plan.checkoutUrl)).size, 3);
});

test("signup keeps the selected plan but never accepts an arbitrary redirect", () => {
  assert.equal(professionalSignupPath("annual"), "/cadastro?perfil=profissional&plano=annual");
  assert.equal(professionalOnboardingPath("?perfil=profissional&plano=annual&next=https://example.test"), "/profissional/assinatura?cadastro=concluido&plano=annual");
  assert.equal(professionalOnboardingPath("?plano=javascript:alert(1)"), "/profissional/assinatura?cadastro=concluido");
  assert.equal(subscriptionPlanId("monthly"), "monthly");
  assert.equal(subscriptionPlanId(null), null);
});
