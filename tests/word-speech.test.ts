import assert from "node:assert/strict";
import test from "node:test";
import { parsePhonemeSpeak, WordSpeechPlayer } from "../src/features/session/word-speech.ts";

const event = { game: "phoneme", kind: "speak", index: 0, word: "baralho", request_id: "word-1" };
test("only bounded, identified phoneme speech commands are accepted", () => {
  assert.deepEqual(parsePhonemeSpeak(event), event);
  for (const invalid of [null, {}, { ...event, game: "other" }, { ...event, index: -1 }, { ...event, index: 0.5 },
    { ...event, word: " " }, { ...event, word: "a".repeat(181) }, { ...event, request_id: "" }]) {
    assert.equal(parsePhonemeSpeak(invalid), null);
  }
});

function fixture() {
  let volume = 0.7;
  const utterances: any[] = [];
  const statuses: string[] = [];
  const playing: boolean[] = [];
  let cancels = 0;
  const voice = { lang: "pt-BR", localService: true };
  const player = new WordSpeechPlayer({
    synth: { speak: (u: any) => utterances.push(u), cancel: () => cancels++, resume() {}, getVoices: () => [voice] } as any,
    create: text => ({ text } as SpeechSynthesisUtterance), volume: () => volume, playing: value => playing.push(value),
  });
  return { player, utterances, statuses, playing, voice, volume: (n: number) => { volume = n; }, cancels: () => cancels,
    play: () => player.play("baralho", status => statuses.push(status)) };
}

test("word speech uses activity gain, Brazilian voice and playback status", () => {
  const f = fixture();
  try {
    f.play();
    const u = f.utterances[0];
    assert.equal(u.volume, 0.7); assert.equal(u.lang, "pt-BR"); assert.equal(u.voice, f.voice);
    u.onstart(); assert.deepEqual(f.playing, [true]); assert.deepEqual(f.statuses, ["started"]);
    u.onend(); assert.deepEqual(f.playing, [true, false]); assert.deepEqual(f.statuses, ["started", "ended"]);
  } finally { f.player.stop(); }
});

test("rapid repeated clicks replace speech instead of accumulating a queue", () => {
  const f = fixture();
  try {
    f.play(); const old = f.utterances[0]; const staleEnd = old.onend;
    f.play(); assert.equal(f.cancels(), 1); assert.equal(old.onstart, null);
    staleEnd(); assert.deepEqual(f.statuses, []);
    f.utterances[1].onstart(); assert.deepEqual(f.statuses, ["started"]);
  } finally { f.player.stop(); }
});

test("activity mute immediately cancels speech, independently of effects", () => {
  const f = fixture();
  f.play(); f.utterances[0].onstart(); f.volume(0); f.player.refresh();
  assert.deepEqual(f.statuses, ["started", "muted"]); assert.equal(f.cancels(), 1);
  f.play(); assert.equal(f.utterances.length, 1); assert.equal(f.statuses.at(-1), "muted");
});

test("blocked speech is reported, never silently treated as played", () => {
  const f = fixture();
  f.play(); f.utterances[0].onerror({ error: "not-allowed" });
  assert.deepEqual(f.statuses, ["blocked"]); assert.equal(f.cancels(), 1);
});

test("gesture unlock is silent and does not interrupt an active word", () => {
  const f = fixture();
  try {
    f.player.unlock(); assert.equal(f.utterances[0].volume, 0);
    f.play(); f.player.unlock(); assert.equal(f.utterances.length, 2);
    f.player.stop(); assert.deepEqual(f.playing, [false]);
  } finally { f.player.stop(); }
});
