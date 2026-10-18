import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPLAUSE_GAIN,
  APPLAUSE_MAX_SECONDS,
  APPLAUSE_SOUND_URL,
  playRecordedApplause,
} from "../src/lib/applause-sound.ts";

class Param {
  value = 0;
  events: Array<{ kind: string; value: number; at: number }> = [];
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: "set", value, at });
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "ramp", value, at });
  }
}
class AudioNodeFake {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = "";
  buffer: unknown;
  target: unknown;
  disconnected = false;
  starts: number[][] = [];
  onended: (() => void) | null = null;
  connect(target: unknown) {
    this.target = target;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(...args: number[]) {
    this.starts.push(args);
  }
}
class ContextFake {
  currentTime = 10;
  decodes = 0;
  sources: AudioNodeFake[] = [];
  filters: AudioNodeFake[] = [];
  gains: AudioNodeFake[] = [];
  async decodeAudioData() {
    this.decodes++;
    return { duration: 4.486 };
  }
  createBufferSource() {
    const node = new AudioNodeFake();
    this.sources.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = new AudioNodeFake();
    this.filters.push(node);
    return node;
  }
  createGain() {
    const node = new AudioNodeFake();
    this.gains.push(node);
    return node;
  }
}
const asContext = (context: ContextFake) => context as unknown as AudioContext;
const asGain = (gain: AudioNodeFake) => gain as unknown as GainNode;
const response = () => new Response(new Uint8Array([1, 2, 3]));

test("recorded applause is quieter, filtered, smoothly faded and connected through the master mute", async () => {
  const originalFetch = globalThis.fetch;
  const context = new ContextFake();
  const master = new AudioNodeFake();
  let requests = 0;
  globalThis.fetch = async (url) => {
    assert.equal(url, APPLAUSE_SOUND_URL);
    requests++;
    return response();
  };
  try {
    await playRecordedApplause(asContext(context), asGain(master), () => true);
    assert.equal(context.sources.length, 1);
    const [source] = context.sources;
    const [filter] = context.filters;
    const [gain] = context.gains;
    assert.equal(filter.type, "lowpass");
    assert.equal(filter.frequency.value, 2600);
    assert.equal(filter.Q.value, 0.5);
    assert.equal(source.target, filter);
    assert.equal(filter.target, gain);
    assert.equal(gain.target, master);
    assert.deepEqual(
      gain.gain.events.map((event) => [event.kind, event.value]),
      [
        ["set", 0],
        ["ramp", APPLAUSE_GAIN],
        ["set", APPLAUSE_GAIN],
        ["ramp", 0],
      ],
    );
    assert.ok(APPLAUSE_GAIN < 0.5);
    assert.equal(source.starts[0][2], APPLAUSE_MAX_SECONDS);
    source.onended!();
    assert.ok(source.disconnected && filter.disconnected && gain.disconnected);
    await playRecordedApplause(asContext(context), asGain(master), () => true);
    assert.equal(requests, 1, "Repeated clicks reuse the local recording");
    assert.equal(context.decodes, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a stale or muted request never plays when its recording finishes loading", async () => {
  const originalFetch = globalThis.fetch;
  const context = new ContextFake();
  let release!: (value: Response) => void;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  let current = true;
  try {
    const playing = playRecordedApplause(
      asContext(context),
      asGain(new AudioNodeFake()),
      () => current,
    );
    current = false;
    release(response());
    await playing;
    assert.equal(context.sources.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing recordings stay silent and allow a later retry, without synthetic clapping", async () => {
  const originalFetch = globalThis.fetch;
  const context = new ContextFake();
  let requests = 0;
  globalThis.fetch = async () =>
    ++requests === 1 ? new Response(null, { status: 404 }) : response();
  try {
    await playRecordedApplause(
      asContext(context),
      asGain(new AudioNodeFake()),
      () => true,
    );
    assert.equal(context.sources.length, 0);
    await playRecordedApplause(
      asContext(context),
      asGain(new AudioNodeFake()),
      () => true,
    );
    assert.equal(context.sources.length, 1);
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a slow first download cannot play applause after its visual reaction has disappeared", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const context = new ContextFake();
  let now = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    now = 5000;
    return response();
  };
  try {
    await playRecordedApplause(
      asContext(context),
      asGain(new AudioNodeFake()),
      () => true,
    );
    assert.equal(context.sources.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("the bundled applause recording matches its documented public-domain source", () => {
  const data = readFileSync(
    new URL("../public/audio/gentle-applause.mp3", import.meta.url),
  );
  assert.ok(data.length > 10000 && data.length < 200000);
  assert.ok(data.subarray(0, 3).toString() === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0), "Asset must have an MP3 header, not an error page");
  const hash = createHash("sha256").update(data).digest("hex");
  assert.equal(
    hash,
    "0297dc19883bf2ffd6ea2634101eb744c6d52acb588a7b8eab1760d6ebd543ba",
  );
  const credits = readFileSync(
    new URL("../public/audio/CREDITS.md", import.meta.url),
    "utf8",
  );
  assert.ok(
    credits.includes("Breviceps") &&
      credits.includes(hash) &&
      credits.includes("CC0 1.0 Universal"),
  );
});
