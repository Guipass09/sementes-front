import assert from "node:assert/strict";
import test from "node:test";
import {
  hasIndividualSubscription,
  subscriptionDate,
  subscriptionEventDetails,
  subscriptionPlanLabel,
  subscriptionTimeLeft,
} from "../src/lib/subscription-details.ts";

test("admin history associates recorded payments with the period snapshot and keeps legacy values missing", () => {
  const period = { plan: "quarterly", quantity: 3, unit: "month" };
  const payment = { amount_cents: 25000, paid_on: "2026-10-18", method: "pix" };
  assert.deepEqual(
    subscriptionEventDetails(
      JSON.stringify({ period, payment, expires_at: "2027-01-18T15:00:00Z" }),
    ),
    { period, payment, expires_at: "2027-01-18T15:00:00Z" },
  );
  assert.equal(
    subscriptionEventDetails(JSON.stringify({ period })).payment,
    null,
  );
  assert.deepEqual(subscriptionEventDetails("invalid"), {
    period: null,
    payment: null,
    expires_at: null,
  });
  assert.equal(
    subscriptionEventDetails(
      JSON.stringify({ payment: { ...payment, amount_cents: -1 } }),
    ).payment,
    null,
  );
  assert.equal(subscriptionEventDetails("null").period, null);
});

test("subscription page is available to active and expired individual subscribers only", () => {
  const user = {
    role: "professional" as const,
    professional_subscription_status: "active" as const,
  };
  assert.equal(hasIndividualSubscription(user), true);
  assert.equal(
    hasIndividualSubscription({
      ...user,
      professional_subscription_status: "inactive",
    }),
    true,
  );
  assert.equal(
    hasIndividualSubscription({
      ...user,
      professional_subscription_status: "legacy",
    }),
    false,
  );
  assert.equal(
    hasIndividualSubscription({ ...user, clinic_name: "Clínica" }),
    false,
  );
  assert.equal(
    hasIndividualSubscription({ ...user, clinic_user_id: 1 }),
    false,
  );
  assert.equal(
    hasIndividualSubscription({ ...user, affiliated_clinic_user_id: 1 }),
    false,
  );
  assert.equal(hasIndividualSubscription({ ...user, role: "user" }), false);
});

test("remaining time uses the server clock and does not display a second-by-second countdown", () => {
  const subscription = {
    status: "active" as const,
    server_now: "2026-10-18T15:00:00Z",
    expires_at: "2026-10-20T15:00:00Z",
    period: null,
  };
  assert.equal(subscriptionTimeLeft(subscription), "2 dias");
  assert.equal(
    subscriptionTimeLeft({
      ...subscription,
      expires_at: "2026-10-18T15:30:00Z",
    }),
    "Até 1 hora",
  );
  assert.equal(
    subscriptionTimeLeft({
      ...subscription,
      expires_at: subscription.server_now,
    }),
    "Período encerrado",
  );
  assert.equal(
    subscriptionTimeLeft({ ...subscription, expires_at: null }),
    "Sem período ativo",
  );
});

test("subscription periods and dates are readable without inventing a missing plan", () => {
  assert.equal(subscriptionPlanLabel(null), "Plano não informado");
  assert.equal(
    subscriptionPlanLabel({ plan: "monthly", quantity: 1, unit: "month" }),
    "Mensal",
  );
  assert.equal(
    subscriptionPlanLabel({ plan: "custom", quantity: 2, unit: "month" }),
    "2 meses",
  );
  assert.equal(subscriptionDate("2026-10-18"), "18/10/2026");
  assert.equal(subscriptionDate("2026-10-19T02:00:00Z"), "18/10/2026");
});
