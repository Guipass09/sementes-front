import assert from "node:assert/strict";
import test from "node:test";
import { initialSessionMouthState, normalizeSessionMouthState } from "../src/features/mouth3d/sessionMouthState.ts";

test("restores the shared mouth state on a new join", () => {
  const saved = { ...initialSessionMouthState, open: true, x: 0.22, pose: { ...initialSessionMouthState.pose, tongueCurl: -0.7 } };
  assert.deepEqual(normalizeSessionMouthState(saved), saved);
});

test("keeps shared position and size inside the stage", () => {
  const state = normalizeSessionMouthState({ open: true, x: 9, y: -4, w: 0.8, h: 2 });
  assert.ok(Math.abs(state.x - 0.2) < 0.000001);
  assert.equal(state.y, 0);
  assert.equal(state.w, 0.8);
  assert.equal(state.h, 0.95);
});

test("rejects malformed movement values without crashing the patient view", () => {
  const state = normalizeSessionMouthState({ open: "yes", pose: { tongueSide: Infinity, tongueWidth: -8, lipShape: 8 }, view: "invalid" });
  assert.equal(state.open, false);
  assert.equal(state.pose.tongueSide, 0);
  assert.equal(state.pose.tongueWidth, -1);
  assert.equal(state.pose.lipShape, 1);
  assert.equal(state.view, "front");
});
