import assert from "node:assert/strict";
import { test } from "node:test";
import { reorderStorySteps } from "../src/features/stories/story-reorder.ts";

const steps = [
  { key: "a", type: "media", media: { id: 10 } },
  { key: "b", type: "game", game: { id: 20 } },
  { key: "c", type: "media", file: { name: "video.mp4" } },
  { key: "d", type: "media", sourceMediaId: 30 },
];

test("moves directly down and up without swapping or losing intermediate steps", () => {
  const down = reorderStorySteps(steps, "a", "d");
  assert.deepEqual(down.map(step => step.key), ["b", "c", "d", "a"]);
  assert.deepEqual(reorderStorySteps(down, "a", "b"), steps);
  assert.deepEqual(steps.map(step => step.key), ["a", "b", "c", "d"]);
});

test("preserves exact media, game, file and imported-slide objects", () => {
  const moved = reorderStorySteps(steps, "c", "a");
  assert.strictEqual(moved[0], steps[2]);
  assert.strictEqual(moved[1], steps[0]);
  assert.strictEqual(moved[2], steps[1]);
  assert.strictEqual(moved[3], steps[3]);
});

test("same position, removed destination, unknown item and empty lists are no-ops", () => {
  assert.strictEqual(reorderStorySteps(steps, "b", "b"), steps);
  assert.strictEqual(reorderStorySteps(steps, "b", "missing"), steps);
  assert.strictEqual(reorderStorySteps(steps, "missing", "a"), steps);
  const empty: { key: string }[] = [];
  assert.strictEqual(reorderStorySteps(empty, "a", "b"), empty);
});
