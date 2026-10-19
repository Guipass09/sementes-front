import assert from "node:assert/strict";
import { test } from "node:test";
import { fitSessionContent } from "../src/features/session/session-content-fit.ts";

test("landscape, portrait, square and panoramic media fit without cropping or stretching", () => {
  for (const [width, height] of [[1440, 720], [1080, 540], [375, 400], [320, 240], [600, 180]]) {
    for (const ratio of [16 / 9, 4 / 3, 1, 3 / 4, 9 / 16, 3]) {
      const fit = fitSessionContent(width, height, ratio);
      assert.ok(fit.width <= width + 0.001 && fit.height <= height + 0.001);
      assert.ok(Math.abs(fit.width / fit.height - ratio) < 0.0001);
      assert.ok(Math.abs(fit.width - width) < 0.001 || Math.abs(fit.height - height) < 0.001);
    }
  }
});

test("games and unavailable metadata use all of the available viewport", () => {
  for (const ratio of [null, 0, -1, NaN, Infinity]) assert.deepEqual(fitSessionContent(1200, 650, ratio), { width: 1200, height: 650 });
});

test("invalid or zero bounds never produce NaN or negative dimensions", () => {
  assert.deepEqual(fitSessionContent(0, -20, null), { width: 1, height: 1 });
  assert.deepEqual(fitSessionContent(NaN, Infinity, 1), { width: 1, height: 1 });
});
