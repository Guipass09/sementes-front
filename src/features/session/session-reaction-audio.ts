import type { ReactionType } from "./session-reactions.ts";
import { getSessionMix, sessionChannelGain, subscribeSessionMix } from "./session-audio-mix.ts";
import { playRecordedApplause } from "../../lib/applause-sound.ts";

let context: AudioContext | null = null;
let gain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let epoch = 0;
const refresh = () => {
  if (!context || !gain) return;
  const volume = getSessionMix().active ? sessionChannelGain("reactions") : 0;
  gain.gain.setTargetAtTime(volume * 0.45, context.currentTime, 0.025);
  if (!volume) epoch++;
};
subscribeSessionMix(refresh);
export function stopSessionReactionAudio() {
  epoch++;
  gain?.disconnect(); limiter?.disconnect();
  void context?.close().catch(() => {});
  context = null; gain = null; limiter = null;
}
export function playSessionReaction(type: ReactionType) {
  if (!getSessionMix().active || !sessionChannelGain("reactions")) return;
  try {
    if (!context) {
      context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      gain = context.createGain(); limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.ratio.value = 12; limiter.attack.value = 0.003;
      gain.connect(limiter); limiter.connect(context.destination); refresh();
    }
    const c = context; const bus = gain!; const generation = epoch;
    const current = () => context === c && epoch === generation && getSessionMix().active && sessionChannelGain("reactions") > 0;
    const play = () => {
      if (!current()) return;
      if (type === "applause") { void playRecordedApplause(c, bus, current); return; }
      const notes = type === "hearts" ? [523.25, 659.25, 523.25, 783.99] : type === "confetti" ? [523.25, 659.25, 783.99, 1046.5] : type === "happy" ? [659.25, 783.99, 1046.5, 783.99] : [523.25, 783.99, 1046.5, 1318.5, 1567.98];
      notes.forEach((frequency, index) => {
        const oscillator = c.createOscillator(); const envelope = c.createGain();
        const t = c.currentTime + 0.01 + index * 0.12;
        oscillator.type = "sine"; oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(0.4, t + 0.015); envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
        oscillator.connect(envelope); envelope.connect(bus);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(t); oscillator.stop(t + 0.28);
      });
    };
    if (c.state === "suspended") void c.resume().then(play).catch(() => {}); else play();
  } catch { /* Visual reactions remain available without audio. */ }
}
