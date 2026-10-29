import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MOUTH_DEMOS, MOUTH_DEMO_LEASE, MOUTH_DEMO_DURATION, changeMouthDemo, mouthDemoAsset, mouthDemoPlaying, mouthDemoPose, mouthDemoPosition, normalizeMouthDemo, type MouthDemoState } from "../src/features/mouth3d/mouth-demonstrations.ts";
import { normalizeSessionMouthState, initialSessionMouthState } from "../src/features/mouth3d/sessionMouthState.ts";
import { MouthDemoAudio } from "../src/features/mouth3d/mouth-demo-audio.ts";

const demo = (patch: Partial<MouthDemoState> = {}): MouthDemoState => ({ id: "demo-1", preset: "trill", status: "playing", position: 0, startedAt: 10000, speed: 1, repeat: true, muted: false, volume: .7, expiresAt: 10000 + MOUTH_DEMO_LEASE, ...patch });
test("shared demo validation rejects malformed values and preserves legacy manual state", () => {
  assert.deepEqual(normalizeMouthDemo(demo()), demo());
  for (const patch of [{ preset: "unknown" }, { speed: 4 }, { position: -1 }, { volume: 3 }, { expiresAt: Infinity }, { id: "<script>" }, { status: "start" }]) assert.equal(normalizeMouthDemo({ ...demo(), ...patch }), null);
  assert.deepEqual(normalizeSessionMouthState(initialSessionMouthState), initialSessionMouthState);
  assert.equal(normalizeSessionMouthState({ ...initialSessionMouthState, open: false, demo: demo() }).demo, null);
  assert.equal(normalizeSessionMouthState({ ...initialSessionMouthState, open: true, demo: demo() }).demo?.id, "demo-1");
});
test("pause, resume, speed changes and repeats use one shared logical timeline", () => {
  const d = demo({ preset: "ra", repeat: false });
  assert.equal(mouthDemoPosition(d, 11000), 1000);
  const paused = changeMouthDemo(d, { status: "paused" }, 11000);
  assert.equal(mouthDemoPosition(paused, 20000), 1000);
  const slow = changeMouthDemo(paused, { status: "playing", speed: .5 }, 20000);
  assert.equal(mouthDemoPosition(slow, 22000), 2000);
  assert.equal(mouthDemoPosition(slow, 30000), MOUTH_DEMO_DURATION);
  assert.equal(mouthDemoPosition(demo(), 14500), 1500);
});
test("patient fails closed for expired or implausibly future leases and scheduled starts", () => {
  assert.equal(mouthDemoPlaying(demo(), 10001, true), true);
  assert.equal(mouthDemoPlaying(demo(), 15500, true), false);
  assert.equal(mouthDemoPlaying(demo(), 9999, true), false);
  assert.equal(mouthDemoPlaying(demo({ expiresAt: 999999 }), 10000, true), false);
  assert.equal(mouthDemoPlaying(demo({ repeat: false }), 13000), false);
});
test("all movement presets remain finite and within existing model limits", () => {
  for (const p of MOUTH_DEMOS) for (let t = 0; t < 3000; t += 7) {
    const pose = mouthDemoPose(p.id, t);
    for (const [key, value] of Object.entries(pose)) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= (["tongueCurl", "tongueSide", "tongueWidth", "lipShape"].includes(key) ? -1 : 0) && value <= 1);
    }
  }
  assert.notEqual(mouthDemoPose("trill", 100).tongueCurl, mouthDemoPose("trill", 107).tongueCurl);
  assert.ok(mouthDemoPose("tap", 320).tongueLift > mouthDemoPose("tap", 400).tongueLift);
  assert.equal(mouthDemoPose("pa", 120).opening, 0);
});
test("all 30 shipped audio assets match their manifest, including slow versions with preserved pitch", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/audio/mouth3d/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.examples.length, 30);
  for (const p of MOUTH_DEMOS) for (const speed of [.5, .75, 1]) {
    const file = mouthDemoAsset(p.id, speed).split("/").pop()!;
    const entry = manifest.examples.find(e => e.file === file);
    const bytes = readFileSync(new URL(`../public/audio/mouth3d/${file}`, import.meta.url));
    assert.equal(entry.durationMs, 3000 / speed);
    assert.ok(bytes.length > 5000);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  }
});

function fakeAudio() {
  const sources: any[] = [], gains: number[] = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const context: any = { state: "running", currentTime: 0, destination: {}, decodeAudioData: async () => ({ duration: 3 }),
    createGain: () => ({ ...node(), gain: { setTargetAtTime: (v: number) => gains.push(v), setValueAtTime: (v: number) => gains.push(v) } }),
    createDynamicsCompressor: () => ({ ...node(), threshold: {}, knee: {}, ratio: {} }),
    createBufferSource: () => { const source = { ...node(), loop: false, loopEnd: 0, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } }; sources.push(source); return source; },
  };
  return { context, sources, gains };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
test("audio stops on pause, mute and lost lease without closing the call's context", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
  try {
    let now = 10000;
    const { context, sources, gains } = fakeAudio();
    const player = new MouthDemoAudio({ context: async () => context, now: () => now, notice() {}, playback() {} });
    player.sync(demo(), .4, true, true); await flush();
    assert.equal(sources[0].starts, 1); assert.ok(gains.includes(.4));
    player.sync(demo({ status: "paused" }), .4, true, true);
    assert.equal(sources[0].stops, 1);
    player.sync(demo({ id: "second" }), .4, true, true); await flush();
    now = 15500; player.sync(demo({ id: "second" }), .4, true, true);
    assert.equal(sources[1].stops, 1);
    now = 10000; player.sync(demo({ id: "third", muted: true }), .4, true, true); await flush();
    assert.equal(sources.length, 2);
    player.dispose(); assert.equal(context.state, "running");
  } finally { globalThis.fetch = original; }
});
test("a late download cannot start sound after stop and failures do not create a retry storm", async () => {
  const original = globalThis.fetch;
  try {
    let resolve!: (value: any) => void;
    globalThis.fetch = () => new Promise(r => { resolve = r; });
    const { context, sources } = fakeAudio();
    const player = new MouthDemoAudio({ context: async () => context, now: () => 10000, notice() {}, playback() {} });
    player.sync(demo(), .5, true, true); await flush(); player.stop();
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); await flush();
    assert.equal(sources.length, 0);
    let requests = 0;
    globalThis.fetch = async () => { requests++; throw new Error("offline"); };
    player.sync(demo({ id: "failed" }), .5, true, true); await flush();
    for (let i = 0; i < 20; i++) player.sync(demo({ id: "failed" }), .5, true, true);
    await flush(); assert.equal(requests, 1);
    player.dispose();
  } finally { globalThis.fetch = original; }
});
