import assert from "node:assert/strict";
import { initialSessionAudioMix, setSessionMix } from "../src/features/session/session-audio-mix.ts";
import { stopSessionReactionAudio } from "../src/features/session/session-reaction-audio.ts";
import test from "node:test";
import {
  MAX_ACTIVE_REACTIONS,
  appendReactionBurst,
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

test("rapid reactions accumulate without replacing or restarting existing bursts", () => {
  const first = createSessionReaction("confetti");
  const second = createSessionReaction("hearts");
  const original = [first];
  const combined = appendReactionBurst(original, second);
  assert.deepEqual(
    original,
    [first],
    "State updates must not mutate React's previous array",
  );
  assert.deepEqual(combined, [first, second]);
  assert.equal(
    combined[0],
    first,
    "Existing bursts retain their identity and animation key",
  );
  assert.deepEqual(
    appendReactionBurst(combined, first),
    combined,
    "Poll echoes cannot add another burst",
  );
});

test("filling the screen evicts only the oldest burst and bounds particle cost", () => {
  const reactions = Array.from({ length: 30 }, () =>
    createSessionReaction("confetti"),
  );
  let active: typeof reactions = [];
  for (const reaction of reactions) {
    active = appendReactionBurst(active, reaction);
    assert.ok(active.length <= MAX_ACTIVE_REACTIONS);
  }
  assert.deepEqual(active, reactions.slice(-MAX_ACTIVE_REACTIONS));
  assert.ok(
    active.reduce(
      (count, reaction) => count + reactionParticles(reaction).length,
      0,
    ) <= 480,
  );
});

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
  linearRampToValueAtTime() {}
  setTargetAtTime(value: number) { this.value = value; }
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  threshold = new Param(); ratio = new Param(); attack = new Param();
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
  createDynamicsCompressor() { return new Node(); }
  async close() {}
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  async resume() {
    this.state = "running";
  }
}

test("reactions have independent short sounds, obey their own mute, and do not disconnect other effects", () => {
  const previousWindow = globalThis.window;
  const context = new Context();
  globalThis.window = {
    AudioContext: function () {
      return context;
    },
    addEventListener() {},
  } as unknown as Window & typeof globalThis;
  const mix = initialSessionAudioMix();
  try {
    mix.channels.reactions = { muted: true, volume: 1 }; setSessionMix({ active: true, mix });
    setGameAudioSettings({ muted: true, volume: 1 });
    for (const type of REACTION_TYPES) playSessionReaction(type);
    assert.equal(context.gains.length, 0);
    mix.channels.reactions = { muted: false, volume: 0 }; setSessionMix({ mix: structuredClone(mix) });
    playSessionReaction("applause");
    assert.equal(context.gains.length, 0);
    mix.channels.reactions = { muted: false, volume: 0.2 }; setSessionMix({ mix: structuredClone(mix) });
    const signatures: string[] = [];
    for (const type of REACTION_TYPES) {
      const oldGain = context.gains.at(-1);
      const startOsc = context.oscillators.length;
      const startNoise = context.noises.length;
      playSessionReaction(type);
      if (oldGain) assert.equal(context.gains.some((gain) => gain.disconnected), false);
      const tones = context.oscillators.slice(startOsc);
      const noises = context.noises.slice(startNoise);
      if (type === "applause") {
        assert.equal(
          noises.length,
          0,
          "Applause must never use the old synthetic noise",
        );
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
    mix.channels.reactions.muted = true; setSessionMix({ mix: structuredClone(mix) });
    const oscillators = context.oscillators.length;
    playSessionReaction("message");
    assert.equal(context.oscillators.length, oscillators);
  } finally {
    stopGameSfx();
    stopSessionReactionAudio(); setSessionMix({ active: false, mix: initialSessionAudioMix() });
    globalThis.window = previousWindow;
    setGameAudioSettings({ muted: false, volume: 0.35 });
  }
});
