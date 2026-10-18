import assert from "node:assert/strict";
import test from "node:test";
import {
  REACTION_DURATION_MS,
  REACTION_TYPES,
  createReactionHistory,
  createSessionReaction,
  parseSessionReaction,
  reactionParticles,
  reactionText,
  sessionReactionMessage,
} from "../src/features/session/session-reactions.ts";
import { setGameAudioSettings } from "../src/lib/game-audio-store.ts";
import { playSessionReaction, stopGameSfx } from "../src/lib/sfx.ts";

test("all five reactions round-trip with the same seeded visual layout", () => {
  for (const type of REACTION_TYPES) {
    const local = createSessionReaction(type, "Você foi incrível!");
    const remote = parseSessionReaction(JSON.parse(JSON.stringify(local)));
    assert.deepEqual(remote, local);
    const particles = reactionParticles(local);
    assert.deepEqual(reactionParticles(remote!), particles);
    assert.equal(
      particles.length,
      type === "confetti" ? 80 : type === "message" ? 9 : 24,
    );
    for (const particle of particles) {
      assert.ok(particle.left >= 5 && particle.left <= 95);
      assert.ok(
        (particle.delay + particle.duration) * 1000 < REACTION_DURATION_MS,
      );
    }
  }
});

test("personalized text is bounded, normalized and preserves complete emoji code points", () => {
  assert.equal(reactionText("  Muito\n bem!\u202e  "), "Muito bem!");
  assert.equal(Array.from(reactionText("😄".repeat(40))).length, 32);
  assert.equal(
    parseSessionReaction({
      ...createSessionReaction("message", "x"),
      text: "  ",
    }),
    null,
  );
  assert.equal(
    parseSessionReaction({
      ...createSessionReaction("message", "x"),
      text: "x".repeat(257),
    }),
    null,
  );
});

test("malformed reactions cannot allocate arbitrary particle counts or IDs", () => {
  const valid = createSessionReaction("hearts");
  for (const change of [
    { type: "html" },
    { seed: NaN },
    { seed: -1 },
    { seed: Infinity },
    { seed: 1.1 },
    { seed: 2 ** 32 },
    { id: "" },
    { id: "<img>" },
    { id: "x".repeat(81) },
  ]) {
    assert.equal(parseSessionReaction({ ...valid, ...change }), null);
  }
  for (const value of [null, undefined, 1, "hearts", []])
    assert.equal(parseSessionReaction(value), null);
});

test("only staff reactions from the current join are accepted, including legacy confetti", () => {
  const joinedAt = "2026-10-18T20:00:00Z";
  const message = {
    kind: "session_reaction",
    from: "admin",
    at: "2026-10-18T20:00:01Z",
    payload: createSessionReaction("happy"),
  };
  assert.deepEqual(sessionReactionMessage(message, joinedAt), message.payload);
  assert.equal(
    sessionReactionMessage({ ...message, from: "user" }, joinedAt),
    null,
  );
  assert.equal(
    sessionReactionMessage(
      { ...message, at: "2026-10-18T19:59:59Z" },
      joinedAt,
    ),
    null,
  );
  assert.equal(
    sessionReactionMessage({ ...message, at: "invalid" }, joinedAt),
    null,
  );
  assert.equal(
    sessionReactionMessage({ ...message, kind: "game_event" }, joinedAt),
    null,
  );
  assert.deepEqual(
    sessionReactionMessage({ ...message, kind: "confetti", id: 18 }, joinedAt),
    { id: "legacy:18", type: "confetti", seed: 18 },
  );
});

test("poll echoes do not duplicate local reactions and history is bounded per call", () => {
  const history = createReactionHistory();
  assert.equal(history.accept("first"), true);
  assert.equal(history.accept("first"), false);
  for (let i = 0; i < 128; i++) history.accept(`next-${i}`);
  assert.equal(history.accept("first"), true);
  history.clear();
  assert.equal(history.accept("first"), true);
});

class Param {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
  exponentialRampToValueAtTime() {}
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = "sine";
  onended: (() => void) | null = null;
  buffer: unknown;
  startAt = 0;
  stopAt = 0;
  disconnected = false;
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start(at: number) {
    this.startAt = at;
  }
  stop(at: number) {
    this.stopAt = at;
  }
}
class Context {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  oscillators: Node[] = [];
  noises: Node[] = [];
  gains: Node[] = [];
  createGain() {
    const node = new Node();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new Node();
    this.oscillators.push(node);
    return node;
  }
  createBufferSource() {
    const node = new Node();
    this.noises.push(node);
    return node;
  }
  createBiquadFilter() {
    return new Node();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  async resume() {
    this.state = "running";
  }
}

test("reactions have distinct short sounds, obey mute and volume, and replace queued sounds", () => {
  const previousWindow = globalThis.window;
  const context = new Context();
  globalThis.window = {
    AudioContext: function () {
      return context;
    },
    addEventListener() {},
  } as unknown as Window & typeof globalThis;
  try {
    setGameAudioSettings({ muted: true, volume: 1 });
    for (const type of REACTION_TYPES) playSessionReaction(type);
    assert.equal(context.gains.length, 0);
    setGameAudioSettings({ muted: false, volume: 0 });
    playSessionReaction("applause");
    assert.equal(context.gains.length, 0);
    setGameAudioSettings({ muted: false, volume: 0.2 });
    const signatures: string[] = [];
    for (const type of REACTION_TYPES) {
      const oldGain = context.gains.at(-1);
      const startOsc = context.oscillators.length;
      const startNoise = context.noises.length;
      playSessionReaction(type);
      if (oldGain) assert.ok(context.gains.some((gain) => gain.disconnected));
      const tones = context.oscillators.slice(startOsc);
      const noises = context.noises.slice(startNoise);
      if (type === "applause") {
        assert.equal(noises.length, 20);
        assert.equal(tones.length, 0);
      }
      signatures.push(
        JSON.stringify([
          tones.map((node) => node.frequency.value),
          noises.length,
        ]),
      );
      for (const node of [...tones, ...noises])
        assert.ok(node.stopAt > 0 && node.stopAt < 2);
    }
    assert.equal(new Set(signatures).size, 5);
    setGameAudioSettings({ muted: true, volume: 0.2 });
    const oscillators = context.oscillators.length;
    playSessionReaction("message");
    assert.equal(context.oscillators.length, oscillators);
  } finally {
    stopGameSfx();
    globalThis.window = previousWindow;
    setGameAudioSettings({ muted: false, volume: 0.35 });
  }
});
