import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionUrgency } from "../src/lib/subscription-status.ts";

const now = Date.parse("2026-10-02T12:00:00Z");
const subscription = (hours: number, status = "active") => ({ status, expires_at: new Date(now + hours * 3600000).toISOString() });
test("expiry warning boundaries", () => {
  assert.equal(subscriptionUrgency(subscription(169), now), "active");
  assert.equal(subscriptionUrgency(subscription(168), now), "soon");
  assert.equal(subscriptionUrgency(subscription(24), now), "urgent");
  assert.equal(subscriptionUrgency(subscription(0), now), "expired");
  assert.equal(subscriptionUrgency(subscription(-1), now), "expired");
});
test("exempt and inactive accounts do not become renewal alerts", () => {
  for (const status of ["suspended", "legacy", "clinic", "pending", "not_applicable"]) {
    assert.equal(subscriptionUrgency(subscription(2, status), now), status);
  }
  assert.equal(subscriptionUrgency(undefined, now), "unknown");
});
