import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffle } from "../src/lib/shuffle.ts";

test("shuffle preserves every memory pair without mutating the original deck", () => {
  const deck = [0, 0, 1, 1, 2, 2];
  for (let round = 0; round < 50; round++) {
    const result = shuffle(deck);
    assert.notEqual(result, deck);
    assert.deepEqual([...result].sort(), deck);
    assert.deepEqual(deck, [0, 0, 1, 1, 2, 2]);
  }
});

test("shuffle handles empty and single-card decks", () => {
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle(["card"]), ["card"]);
});
