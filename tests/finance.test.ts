import assert from "node:assert/strict";
import test from "node:test";
import {
  canUsePersonalFinance,
  financeCsv,
  moneyInput,
  moneyInputToCents,
  type FinanceEntry,
} from "../src/features/finance/finance.ts";

test("finance is visible only to individual subscription accounts", () => {
  const individual = {
    role: "professional" as const,
    professional_subscription_status: "active" as const,
  };
  assert.equal(canUsePersonalFinance(individual), true);
  assert.equal(
    canUsePersonalFinance({ ...individual, clinic_name: "Clínica" }),
    false,
  );
  assert.equal(
    canUsePersonalFinance({ ...individual, clinic_user_id: 12 }),
    false,
  );
  assert.equal(
    canUsePersonalFinance({ ...individual, affiliated_clinic_user_id: 12 }),
    false,
  );
  assert.equal(
    canUsePersonalFinance({
      ...individual,
      professional_subscription_status: "legacy",
    }),
    false,
  );
  assert.equal(canUsePersonalFinance({ ...individual, role: "admin" }), false);
  assert.equal(canUsePersonalFinance(null), false);
});

test("money inputs produce integer cents without rounding or ambiguous grouping", () => {
  for (const [input, cents] of [
    ["200", 20000],
    ["200,50", 20050],
    ["1.234,56", 123456],
    ["200.50", 20050],
    ["0,01", 1],
    ["R$ 85,9", 8590],
    ["1.200", 120000],
  ] as const) {
    assert.equal(moneyInputToCents(input), cents);
    assert.equal(moneyInputToCents(moneyInput(cents)), cents);
  }
  for (const value of [
    "",
    "-1",
    "12,345",
    "12.34,56",
    "NaN",
    "200abc",
    "1e5",
    "999999999999999999",
  ])
    assert.equal(moneyInputToCents(value), null);
});

test("CSV preserves separators and escapes spreadsheet formulas in patient content", () => {
  const entry: FinanceEntry = {
    id: 1,
    appointment_id: null,
    patient_id: null,
    patient_name: '=HYPERLINK("evil")',
    kind: "income",
    source: "manual",
    description: 'Sessão; "teste"',
    amount_cents: 12345,
    status: "paid",
    category: "sessions",
    occurred_on: "2026-10-01",
    due_on: "2026-10-02",
    paid_on: "2026-10-03",
    payment_method: "pix",
    notes: "  +CMD()",
    needs_review: false,
    version: 1,
  };
  const csv = financeCsv([entry]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Sessão; ""teste"""'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'  +CMD()"));
  assert.ok(csv.includes('"123,45"'));
  assert.ok(csv.includes('"Pix"'));
});
