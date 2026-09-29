import assert from "node:assert/strict";
import test from "node:test";
import { gameNoticeKey, markGameOpened, reconcileGameNotices } from "../src/pages/patient/game-notices.ts";

test("first visit establishes a baseline without highlighting every existing game", () => {
  assert.deepEqual(reconcileGameNotices(null, ["memoria:1", "forca:1"]), {
    known: ["memoria:1", "forca:1"],
    pending: [],
  });
});

test("new games remain pending across refreshes until opened", () => {
  const baseline = reconcileGameNotices(null, ["memoria:1"]);
  const added = reconcileGameNotices(baseline, ["memoria:1", "memoria:2"]);
  assert.deepEqual(added.pending, ["memoria:2"]);
  assert.deepEqual(reconcileGameNotices(added, ["memoria:1", "memoria:2"]).pending, ["memoria:2"]);
  assert.deepEqual(markGameOpened(added, "memoria:2").pending, []);
});

test("same numeric id in another category stays distinct", () => {
  assert.notEqual(gameNoticeKey("memoria", 1), gameNoticeKey("forca", 1));
});

test("removed games stop blinking, but a previously opened game stays known", () => {
  const state = { known: ["memoria:1", "memoria:2"], pending: ["memoria:2"] };
  assert.deepEqual(reconcileGameNotices(state, ["memoria:1"]).pending, []);
  assert.deepEqual(reconcileGameNotices(markGameOpened(state, "memoria:2"), ["memoria:1", "memoria:2"]).pending, []);
});
