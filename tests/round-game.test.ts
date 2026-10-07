import assert from "node:assert/strict";
import test from "node:test";
import { initialRoundState, reduceRoundGame, roundSolved, shuffledChoices, validateRounds } from "../src/features/round-games/round-game.ts";

const rounds = [0, 1].map(n => ({ id: `round-${n}`, prompt: "Qual figura?", choices: [
  { id: "sun", label: "Sol", path: "sun.png", correct: true },
  { id: "ball", label: "Bola", path: "ball.png", correct: false },
  { id: "frog", label: "Sapo", path: "frog.png", correct: true },
] }));

test("sound requires every correct image, ignores duplicate and invalid choices", () => {
  let s = initialRoundState();
  assert.equal(reduceRoundGame(s, { kind: "next", round: 0 }, rounds, "sound"), s);
  s = reduceRoundGame(s, { kind: "choose", round: 0, choice: "ball" }, rounds, "sound");
  assert.equal(s.mistake, "ball");
  assert.deepEqual(s.selected, []);
  s = reduceRoundGame(s, { kind: "choose", round: 0, choice: "frog" }, rounds, "sound");
  assert.equal(s.mistake, null);
  assert.equal(roundSolved(rounds[0], "sound", s.selected), false);
  assert.equal(reduceRoundGame(s, { kind: "choose", round: 0, choice: "frog" }, rounds, "sound"), s);
  assert.equal(reduceRoundGame(s, { kind: "choose", round: 0, choice: "unknown" }, rounds, "sound"), s);
  s = reduceRoundGame(s, { kind: "choose", round: 0, choice: "sun" }, rounds, "sound");
  assert.equal(roundSolved(rounds[0], "sound", s.selected), true);
  s = reduceRoundGame(s, { kind: "next", round: 0 }, rounds, "sound");
  assert.equal(s.round, 1);
  assert.deepEqual(s.selected, []);
  assert.equal(s.completed, false);
  assert.equal(reduceRoundGame(s, { kind: "next", round: 0 }, rounds, "sound"), s);
});

test("sequence follows authored order and allows correction without losing accepted steps", () => {
  let s = initialRoundState();
  s = reduceRoundGame(s, { kind: "choose", round: 0, choice: "frog" }, rounds, "sequence");
  assert.deepEqual(s.selected, []);
  for (const choice of rounds[0].choices) s = reduceRoundGame(s, { kind: "choose", round: 0, choice: choice.id }, rounds, "sequence");
  assert.equal(roundSolved(rounds[0], "sequence", s.selected), true);
  s = reduceRoundGame(s, { kind: "retry", round: 0 }, rounds, "sequence");
  assert.deepEqual(s.selected, []);
  assert.equal(s.round, 0);
});

test("celebration only after final round; restart always permits a fresh game", () => {
  let s = initialRoundState();
  for (let round = 0; round < rounds.length; round++) {
    for (const choice of rounds[round].choices.filter(c => c.correct)) s = reduceRoundGame(s, { kind: "choose", round, choice: choice.id }, rounds, "sound");
    s = reduceRoundGame(s, { kind: "next", round }, rounds, "sound");
  }
  assert.equal(s.completed, true);
  assert.equal(s.celebration, true);
  s = reduceRoundGame(s, { kind: "congrats_close" }, rounds, "sound");
  assert.equal(s.celebration, false);
  assert.equal(s.completed, true);
  s = reduceRoundGame(s, { kind: "restart" }, rounds, "sound");
  assert.deepEqual(s, { ...initialRoundState(), attempt: 1 });
});

test("shuffle is deterministic for both live participants, including seed zero", () => {
  for (let seed = 0; seed < 40; seed++) {
    const a = shuffledChoices(rounds[0], seed);
    assert.deepEqual(a, shuffledChoices(rounds[0], seed));
    assert.notDeepEqual(a, rounds[0].choices);
    assert.deepEqual(a.map(c => c.id).sort(), rounds[0].choices.map(c => c.id).sort());
  }
  assert.equal(rounds[0].choices[0].id, "sun");
});

test("editor rejects incomplete rounds and accepts multiple correct images", () => {
  assert.equal(validateRounds(rounds, "sound"), null);
  assert.ok(validateRounds([], "sound"));
  assert.ok(validateRounds([{ ...rounds[0], prompt: " " }], "sound"));
  assert.ok(validateRounds([{ ...rounds[0], choices: rounds[0].choices.slice(0, 1) }], "sequence"));
  const noCorrect = [{ ...rounds[0], choices: rounds[0].choices.map(c => ({ ...c, correct: false })) }];
  assert.ok(validateRounds(noCorrect, "sound"));
  assert.equal(validateRounds(noCorrect, "sequence"), null);
});
