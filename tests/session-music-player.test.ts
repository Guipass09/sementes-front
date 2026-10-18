import assert from "node:assert/strict";
import test from "node:test";
import { SessionMusicPlayer } from "../src/features/session/session-music-player.ts";
import {
  MUSIC_LEASE_MS,
  SESSION_MUSIC_TRACKS,
  initialMusicState,
} from "../src/features/session/session-music-policy.ts";

class Param {
  value = 0;
  events: Array<{ kind: string; value: number; at: number }> = [];
  cancelScheduledValues(at: number) {
    this.events = this.events.filter((event) => event.at < at);
  }
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: "set", value, at });
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "ramp", value, at });
  }
}
class NodeFake {
  gain = new Param();
  disconnected = false;
  target: unknown;
  connect(target: unknown) {
    this.target = target;
  }
  disconnect() {
    this.disconnected = true;
  }
}
class ContextFake {
  currentTime = 10;
  state = "running";
  destination = {};
  gain = new NodeFake();
  source = new NodeFake();
  closed = false;
  createMediaElementSource() {
    return this.source;
  }
  createGain() {
    return this.gain;
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.closed = true;
  }
}
class AudioFake {
  src = "";
  preload = "";
  volume = 1;
  loop = false;
  currentTime = 0;
  readyState = 1;
  paused = true;
  calls = 0;
  loads = 0;
  events = new Map<string, Set<() => void>>();
  async play() {
    this.calls++;
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type: string, callback: () => void) {
    if (!this.events.has(type)) this.events.set(type, new Set());
    this.events.get(type)!.add(callback);
  }
  removeEventListener(type: string, callback: () => void) {
    this.events.get(type)?.delete(callback);
  }
  emit(type: string) {
    for (const cb of this.events.get(type) || []) cb();
  }
  removeAttribute() {
    this.src = "";
  }
  load() {
    this.loads++;
  }
}
function fixture() {
  let now = 0;
  const context = new ContextFake();
  const audio = new AudioFake();
  const stops: string[] = [];
  let allocations = 0;
  const player = new SessionMusicPlayer(
    (reason) => stops.push(reason),
    () => now,
    () => {
      allocations++;
      return audio as unknown as HTMLAudioElement;
    },
    () => context as unknown as AudioContext,
  );
  return {
    player,
    audio,
    context,
    stops,
    allocations: () => allocations,
    setTime(value: number) {
      now = value;
    },
  };
}

test("music starts only on explicit play and schedules silence in the audio renderer without relying on JS timeouts", async () => {
  const f = fixture();
  f.player.unlock();
  assert.equal(f.audio.calls, 0);
  assert.equal(f.audio.src, "");
  await f.player.apply(
    { ...initialMusicState(), playing: true },
    MUSIC_LEASE_MS,
  );
  assert.equal(f.audio.src, SESSION_MUSIC_TRACKS[0].url);
  assert.equal(f.audio.loop, true);
  assert.equal(f.audio.preload, "none");
  assert.equal(f.context.source.target, f.context.gain);
  assert.equal(f.context.gain.target, f.context.destination);
  assert.deepEqual(f.context.gain.gain.events.at(-1), {
    kind: "ramp",
    value: 0,
    at: 15,
  });
  assert.equal(f.context.gain.gain.events[0].value, 0.1);
  f.player.pause();
  assert.equal(f.audio.paused, true);
  assert.equal(f.context.gain.gain.events.at(-1)!.value, 0);
  f.player.dispose();
});

test("pause and disposal cannot be undone by an outstanding play promise", async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    let resolve!: () => void;
    f.audio.play = () =>
      new Promise<void>((r) => {
        resolve = r;
      });
    const pending = f.player.apply(
      { ...initialMusicState(), playing: true },
      MUSIC_LEASE_MS,
    );
    if (dispose) f.player.dispose();
    else f.player.pause();
    f.audio.paused = false;
    resolve();
    assert.equal(await pending, false);
    assert.equal(
      f.audio.paused,
      true,
      "Delayed media playback cannot escape a pause",
    );
    if (dispose) {
      assert.equal(f.context.closed, true);
      assert.equal(f.context.gain.disconnected, true);
    }
    f.player.dispose();
  }
});

test("heartbeats renew the same player without resetting its position, while rewind and volume apply", async () => {
  const f = fixture();
  const state = { ...initialMusicState(), playing: true, position: 20 };
  await f.player.apply(state, MUSIC_LEASE_MS);
  assert.equal(f.audio.currentTime, 20);
  f.audio.currentTime = 21.2;
  await f.player.apply(
    { ...state, position: 21.2, volume: 0.1 },
    MUSIC_LEASE_MS,
  );
  assert.equal(f.audio.currentTime, 21.2);
  assert.equal(f.audio.calls, 1);
  assert.equal(f.allocations(), 1);
  assert.ok(Math.abs(f.context.gain.gain.events[0].value - 0.04) < 0.00001);
  await f.player.apply({ ...state, position: 0 }, MUSIC_LEASE_MS);
  assert.equal(f.audio.currentTime, 0);
  f.audio.currentTime = 0.7;
  await f.player.apply({ ...state, position: 0 }, MUSIC_LEASE_MS, true);
  assert.equal(
    f.audio.currentTime,
    0,
    "Explicit rewind also works near the start",
  );
  f.player.dispose();
});

test("a suspended context must not unlock expired music and can never play without a valid safety gate", async () => {
  const f = fixture();
  await f.player.apply({ ...initialMusicState(), playing: true }, 100);
  f.setTime(101);
  f.context.state = "suspended";
  f.player.unlock();
  assert.equal(f.audio.paused, true);
  const calls = f.audio.calls;
  await f.player.apply({ ...initialMusicState(), playing: true }, 0);
  assert.equal(f.audio.calls, calls);
  f.player.dispose();
});

test("media loading, failure and ended events leave no uncontrolled playback or leaked handlers", async () => {
  const f = fixture();
  f.audio.readyState = 0;
  await f.player.apply(
    { ...initialMusicState(), playing: true, position: 25 },
    MUSIC_LEASE_MS,
  );
  assert.equal(f.player.position(), 25);
  f.audio.readyState = 1;
  f.audio.emit("loadedmetadata");
  assert.equal(f.audio.currentTime, 25);
  f.audio.emit("error");
  assert.equal(f.audio.paused, true);
  assert.deepEqual(f.stops, ["error"]);
  f.player.dispose();
  assert.equal(f.audio.src, "");
  assert.equal(
    [...f.audio.events.values()].reduce(
      (count, events) => count + events.size,
      0,
    ),
    0,
  );
});
