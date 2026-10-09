import assert from "node:assert/strict";
import test from "node:test";
import { isPastOpenSession, parseLocalDateTime } from "../src/lib/session-alert.ts";

test("past open session notice waits until after a typical appointment", () => {
  const start = parseLocalDateTime("2026-10-08", "14:00");
  assert.notEqual(start, null);
  assert.equal(isPastOpenSession("2026-10-08", "14:00", start! + 40 * 60_000), false);
  assert.equal(isPastOpenSession("2026-10-08", "14:00", start! + 89 * 60_000), false);
  assert.equal(isPastOpenSession("2026-10-08", "14:00", start! + 90 * 60_000), true);
});

test("past open session notice ignores missing schedule", () => {
  assert.equal(isPastOpenSession("", "14:00", Date.now()), false);
  assert.equal(isPastOpenSession("2026-10-08", "", Date.now()), false);
});
