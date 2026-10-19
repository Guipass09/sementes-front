import assert from "node:assert/strict";
import test from "node:test";
import { SessionGameEffects } from "../src/features/session/session-game-effects.ts";
import { GAME_SFX } from "../src/lib/game-sfx-bridge.ts";
import { setGameAudioSettings } from "../src/lib/game-audio-store.ts";

class Param {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); threshold = new Param(); knee = new Param();
  ratio = new Param(); attack = new Param(); release = new Param();
  connections: unknown[] = []; starts: number[] = []; stops: (number | undefined)[] = [];
  disconnected = false; onended: (() => void) | null = null;
  connect(target: unknown) { this.connections.push(target); }
  disconnect() { this.disconnected = true; }
  start(at: number) { this.starts.push(at); }
  stop(at?: number) { this.stops.push(at); }
}
class Context {
  state = "running"; currentTime = 10; sampleRate = 8000; destination = {};
  gains: Node[] = []; sources: Node[] = []; compressors: Node[] = []; closed = false;
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createDynamicsCompressor() { const node = new Node(); this.compressors.push(node); return node; }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBiquadFilter() { return new Node(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  close() { this.closed = true; }
}
const audioContext = (context: Context) => context as unknown as AudioContext;

test("live effects use the joined call context and ignore standalone mute/volume", () => {
  const context = new Context();
  const effects = new SessionGameEffects(() => 0.35);
  try {
    setGameAudioSettings({ volume: 0, muted: true });
    assert.equal(effects.bind(audioContext(context)), true);
    assert.equal(effects.play("correct"), true);
    assert.equal(context.sources.length, 3);
    assert.ok(Math.abs(context.gains[0].gain.value - 0.14) < 0.000001);
    assert.equal(context.gains[0].connections[0], context.compressors[0]);
    assert.equal(context.compressors[0].connections[0], context.destination);
  } finally { effects.dispose(); setGameAudioSettings({ volume: 0.35, muted: false }); }
});
test("every effect renders on the same bus without allocating or closing a context", () => {
  const context = new Context(); const effects = new SessionGameEffects(() => 1);
  effects.bind(audioContext(context));
  for (const effect of GAME_SFX) {
    const count = context.sources.length;
    assert.equal(effects.play(effect), true);
    assert.ok(context.sources.length > count, effect);
  }
  assert.equal(context.compressors.length, 1);
  assert.equal(context.gains[0].gain.value, 0.4);
  effects.dispose(); assert.equal(context.closed, false);
});
test("effect mute cancels scheduled notes immediately and unmute never replays them", () => {
  const context = new Context(); let volume = 0.6;
  const effects = new SessionGameEffects(() => volume); effects.bind(audioContext(context)); effects.play("win");
  const count = context.sources.length;
  volume = 0; effects.refresh();
  assert.equal(context.gains[0].gain.value, 0);
  assert.ok(context.sources.every(source => source.stops.includes(undefined)));
  effects.play("correct"); assert.equal(context.sources.length, count);
  volume = 0.2; effects.refresh(); assert.equal(context.sources.length, count);
  effects.play("cardFlip"); assert.equal(context.sources.length, count + 2);
  effects.dispose();
});
test("switching games stops the old score but preserves the activated call bus", () => {
  const context = new Context(); const effects = new SessionGameEffects(() => 0.5);
  effects.bind(audioContext(context)); effects.play("win"); effects.stop();
  assert.equal(context.gains[0].disconnected, false);
  assert.equal(context.closed, false);
  const previous = context.sources.length;
  effects.bind(audioContext(context)); effects.play("cardFlip");
  assert.equal(context.sources.length, previous + 2); assert.equal(context.compressors.length, 1);
  effects.dispose();
});
test("suspended/interrupted audio does not queue old clicks and resumes cleanly", () => {
  const context = new Context(); context.state = "suspended";
  const effects = new SessionGameEffects(() => 0.35);
  assert.equal(effects.bind(audioContext(context)), false);
  assert.equal(effects.play("cardFlip"), false); assert.equal(context.sources.length, 0);
  context.state = "interrupted"; assert.equal(effects.play("win"), false);
  context.state = "running"; assert.equal(effects.play("cardFlip"), true); assert.equal(context.sources.length, 2);
  effects.dispose();
});
test("capture recovery replaces only the effects graph, never another caller's audio", () => {
  const previous = new Context(), next = new Context(); const effects = new SessionGameEffects(() => 0.35);
  effects.bind(audioContext(previous)); effects.play("correct"); effects.bind(audioContext(next)); effects.play("correct");
  assert.equal(previous.gains[0].disconnected, true); assert.equal(previous.closed, false);
  assert.equal(next.sources.length, 3); effects.dispose(); assert.equal(next.closed, false);
});
