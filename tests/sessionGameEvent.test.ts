import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentSessionGameEvent } from "../src/lib/session-game-event.ts";
test("reopening the same game rejects completion events from the previous round", () => {
  const active = { path: "/jogos/forca/1", share_id: "round-2" };
  assert.equal(isCurrentSessionGameEvent(active, { ...active, share_id: "round-1" }), false);
  assert.equal(isCurrentSessionGameEvent(active, active), true);
  assert.equal(isCurrentSessionGameEvent(active, { path: active.path }), false);
  assert.equal(isCurrentSessionGameEvent(active, { ...active, path: "/atividades/1" }), false);
  assert.equal(isCurrentSessionGameEvent(null, active), false);
});
