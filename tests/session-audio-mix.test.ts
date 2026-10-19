import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_CHANNELS, acceptAudioMixPacket, effectiveAudioLevel, getSessionMix, initialSessionAudioMix, parseAudioMixPacket, parseSessionAudioMix, setSessionMix, subscribeSessionMix, type AudioMixPacket, type MixSnapshot } from "../src/features/session/session-audio-mix.ts";

const state = (): MixSnapshot => ({ active: true, mix: initialSessionAudioMix(), speaking: false, activityPlaying: false, musicPlaying: false });
test("every session gets fresh recommended levels, microphones at unity and soundtrack muted", () => {
  const a = initialSessionAudioMix(); a.channels.professionalMic.volume = 2; a.channels.soundtrack.muted = false;
  const b = initialSessionAudioMix();
  assert.equal(b.channels.professionalMic.volume, 1); assert.equal(b.channels.patientMic.volume, 1);
  assert.equal(b.channels.soundtrack.muted, true); assert.equal(b.channels.activity.muted, false);
  assert.equal(AUDIO_CHANNELS.length, 8);
});
test("each channel mutes independently and speech priority never reduces a microphone", () => {
  const s = state(); s.mix.channels.soundtrack.muted = false; s.mix.channels.activity.muted = true;
  assert.equal(effectiveAudioLevel("activity", s), 0);
  assert.equal(effectiveAudioLevel("effects", s), 0.35);
  assert.equal(effectiveAudioLevel("reactions", s), 0.3);
  s.speaking = true;
  assert.equal(effectiveAudioLevel("professionalMic", s), 1); assert.equal(effectiveAudioLevel("patientMic", s), 1);
  assert.equal(effectiveAudioLevel("screen", s), 0.35);
  assert.equal(effectiveAudioLevel("music", s), 0.05); assert.ok(effectiveAudioLevel("soundtrack", s) < 0.05);
  s.mix.speechPriority = false; assert.equal(effectiveAudioLevel("music", s), 0.25);
});
test("activity playback and selected music reduce competing soundtrack without resetting chosen levels", () => {
  const s = state(); s.mix.channels.soundtrack.muted = false; s.activityPlaying = true;
  assert.equal(effectiveAudioLevel("music", s), 0.05);
  s.activityPlaying = false; s.musicPlaying = true;
  assert.equal(effectiveAudioLevel("soundtrack", s), 0.03);
  assert.equal(s.mix.channels.soundtrack.volume, 0.2);
});
test("rejects missing channels, invalid volumes, excessive gain and malformed packets", () => {
  for (const value of [-1, NaN, Infinity, 2.01, "1"]) {
    const mix = initialSessionAudioMix(); mix.channels.patientMic.volume = value as number;
    assert.equal(parseSessionAudioMix(mix), null);
  }
  const mix = initialSessionAudioMix(); mix.channels.professionalMic.volume = 2;
  assert.ok(parseSessionAudioMix(mix)); mix.channels.activity.volume = 1.01; assert.equal(parseSessionAudioMix(mix), null);
  assert.equal(parseSessionAudioMix({ channels: {}, speechPriority: true }), null);
  assert.equal(parseAudioMixPacket({ v: 1, mix: initialSessionAudioMix() }), null);
});
test("ignores old sessions and reordered updates while allowing controller reconnection", () => {
  const p: AudioMixPacket = { v: 1, controllerId: "controller-a", controllerAt: 1000, revision: 5, issuedAt: 2000, mix: initialSessionAudioMix() };
  assert.ok(parseAudioMixPacket(p)); assert.ok(acceptAudioMixPacket(p, null, 1000, 2100));
  assert.equal(acceptAudioMixPacket({ ...p, issuedAt: 999 }, null, 1000, 2100), false);
  assert.equal(acceptAudioMixPacket(p, null, 1000, 20000), false);
  assert.equal(acceptAudioMixPacket({ ...p, revision: 4 }, p, 1000, 2100), false);
  assert.equal(acceptAudioMixPacket({ ...p, controllerId: "other" }, p, 1000, 2100), false);
  assert.ok(acceptAudioMixPacket({ ...p, controllerAt: 2000, controllerId: "new", revision: 0 }, p, 1000, 2100));
});
test("store broadcasts changes once, never uses saved preferences, and cleans subscriptions", () => {
  let calls = 0; const stop = subscribeSessionMix(() => calls++);
  setSessionMix(state()); const before = calls;
  setSessionMix({ speaking: true }); assert.equal(calls, before + 1);
  setSessionMix({ speaking: true }); assert.equal(calls, before + 1);
  stop(); setSessionMix({ speaking: false }); assert.equal(calls, before + 1);
  assert.equal(getSessionMix().mix.channels.professionalMic.volume, 1);
});
