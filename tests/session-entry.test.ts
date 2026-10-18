import assert from "node:assert/strict";
import test from "node:test";
import { sessionEntryMode, sessionForbiddenMessage } from "../src/lib/session-entry-policy.ts";

test("a patient invite takes precedence over a professional, admin or another patient's signed-in account", () => {
  assert.equal(sessionEntryMode(false, true, "valid-invite-token"), "invite");
  assert.equal(sessionEntryMode(false, false, "valid-invite-token"), "invite");
});

test("without an invitation the authenticated endpoint remains mandatory and does not bypass ownership", () => {
  assert.equal(sessionEntryMode(false, true, null), "account");
  assert.equal(sessionEntryMode(false, true, "   "), "account");
  assert.equal(sessionEntryMode(false, false, null), "wait");
});

test("entry waits until the persisted account has been checked before starting either join flow", () => {
  assert.equal(sessionEntryMode(true, true, "valid-invite-token"), "wait");
  assert.equal(sessionEntryMode(true, false, null), "wait");
});

test("access failures explain the account mismatch without hiding expired or invalid invitations", () => {
  assert.match(sessionForbiddenMessage("Forbidden."), /conta que está aberta/);
  assert.match(sessionForbiddenMessage("FORBIDDEN"), /link de convite completo/);
  assert.equal(sessionForbiddenMessage("Convite expirado."), "Convite expirado.");
  assert.equal(sessionForbiddenMessage("Convite inválido."), "Convite inválido.");
  assert.equal(sessionForbiddenMessage("Sessão indisponível no momento."), "Sessão indisponível no momento.");
  assert.match(sessionForbiddenMessage(null), /perto do horário/);
});
