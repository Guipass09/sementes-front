import assert from "node:assert/strict";
import test from "node:test";
import { SessionMicrophone, recommendedCapture } from "../src/features/session/session-microphone.ts";

class Track { kind: string; enabled = false; readyState = "live"; constructor(kind: string) { this.kind = kind; } stop() { this.readyState = "ended"; } }
class Stream {
  tracks: Track[];
  constructor(tracks: Track[]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
}
class Node {
  target: unknown; disconnected = false;
  gain = { value: 0, setTargetAtTime: (value: number) => { this.gain.value = value; } };
  threshold = { value: 0 }; knee = { value: 0 }; ratio = { value: 0 }; attack = { value: 0 }; release = { value: 0 };
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
}
class Context {
  state = "running"; currentTime = 0; closed = false;
  destination = {}; source = new Node(); gain = new Node(); compressor = new Node();
  output = { stream: new Stream([new Track("audio")]) };
  createMediaStreamSource() { return this.source; }
  createGain() { return this.gain; }
  createDynamicsCompressor() { return this.compressor; }
  createMediaStreamDestination() { return this.output; }
  async resume() { this.state = "running"; }
  async close() { this.closed = true; }
}
const asStream = (stream: Stream) => stream as unknown as MediaStream;
test("gain affects only outgoing audio, never local speakers, never enables the raw microphone", async () => {
  const previous = globalThis.MediaStream;
  globalThis.MediaStream = Stream as unknown as typeof MediaStream;
  try {
    const ctx = new Context(); const raw = new Stream([new Track("audio"), new Track("video")]);
    const microphone = new SessionMicrophone(() => ctx as unknown as AudioContext);
    const sent = await microphone.prepare(asStream(raw));
    assert.equal(ctx.source.target, ctx.gain); assert.equal(ctx.gain.target, ctx.compressor); assert.equal(ctx.compressor.target, ctx.output);
    assert.notEqual(ctx.compressor.target, ctx.destination);
    assert.equal(sent.getVideoTracks()[0], raw.getVideoTracks()[0]); assert.notEqual(sent.getAudioTracks()[0], raw.getAudioTracks()[0]);
    microphone.setLevel({ volume: 2, muted: false }); assert.equal(ctx.gain.gain.value, 2); assert.equal(raw.getAudioTracks()[0].enabled, false);
    microphone.setLevel({ volume: 2, muted: true }); assert.equal(ctx.gain.gain.value, 0);
    microphone.setLevel({ volume: 5, muted: false }); assert.equal(ctx.gain.gain.value, 2);
    assert.equal(ctx.compressor.threshold.value, -3); assert.equal(ctx.compressor.ratio.value, 12);
    microphone.dispose(); assert.equal(ctx.closed, true); assert.equal(ctx.output.stream.getAudioTracks()[0].readyState, "ended"); assert.equal(raw.getAudioTracks()[0].readyState, "live");
  } finally { globalThis.MediaStream = previous; }
});
test("unsupported Web Audio falls back to raw audio rather than breaking the call", async () => {
  const raw = asStream(new Stream([new Track("audio")]));
  const microphone = new SessionMicrophone(() => { throw new Error("Unsupported"); });
  assert.equal(await microphone.prepare(raw), raw); assert.equal(microphone.supported, false);
});
test("camera-only streams remain usable, and capture requests keep echo cancellation and microphone permission", async () => {
  const raw = asStream(new Stream([new Track("video")]));
  const microphone = new SessionMicrophone(() => { throw new Error("Must not allocate"); });
  assert.equal(await microphone.prepare(raw), raw);
  assert.deepEqual(recommendedCapture.audio, { echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true }, channelCount: { ideal: 1 } });
});
