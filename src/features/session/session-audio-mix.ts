export const AUDIO_CHANNELS = ["professionalMic", "patientMic", "activity", "effects", "reactions", "music", "soundtrack", "screen"] as const;
export type AudioChannel = typeof AUDIO_CHANNELS[number];
export type AudioLevel = { volume: number; muted: boolean };
export type SessionAudioMix = { channels: Record<AudioChannel, AudioLevel>; speechPriority: boolean };
export type AudioRuntime = { speaking: boolean; musicPlaying: boolean; activityPlaying: boolean };
export type MixSnapshot = AudioRuntime & { active: boolean; mix: SessionAudioMix };
export const initialSessionAudioMix = (): SessionAudioMix => ({
  speechPriority: true,
  channels: {
    professionalMic: { volume: 1, muted: false }, patientMic: { volume: 1, muted: false },
    activity: { volume: 0.7, muted: false }, effects: { volume: 0.35, muted: false },
    reactions: { volume: 0.3, muted: false }, music: { volume: 0.25, muted: false },
    soundtrack: { volume: 0.2, muted: true }, screen: { volume: 0.7, muted: false },
  },
});
export const channelMaximum = (channel: AudioChannel) => channel === "professionalMic" || channel === "patientMic" ? 2 : 1;
export function parseSessionAudioMix(value: unknown): SessionAudioMix | null {
  if (!value || typeof value !== "object") return null;
  const input = value as SessionAudioMix;
  if (typeof input.speechPriority !== "boolean" || !input.channels) return null;
  const mix = initialSessionAudioMix();
  mix.speechPriority = input.speechPriority;
  for (const channel of AUDIO_CHANNELS) {
    const level = input.channels[channel];
    if (!level || typeof level.muted !== "boolean" || typeof level.volume !== "number" || !Number.isFinite(level.volume) || level.volume < 0 || level.volume > channelMaximum(channel)) return null;
    mix.channels[channel] = { volume: level.volume, muted: level.muted };
  }
  return mix;
}
export function effectiveAudioLevel(channel: AudioChannel, state: MixSnapshot): number {
  const level = state.mix.channels[channel];
  if (level.muted) return 0;
  let attenuation = 1;
  if (state.mix.speechPriority) {
    if ((channel === "activity" || channel === "screen") && state.speaking) attenuation = 0.5;
    if ((channel === "music" || channel === "soundtrack") && (state.speaking || state.activityPlaying)) attenuation = 0.2;
    if (channel === "soundtrack" && state.musicPlaying) attenuation = Math.min(attenuation, 0.15);
    if ((channel === "effects" || channel === "reactions") && state.speaking) attenuation = 0.45;
  }
  return level.volume * attenuation;
}
export type AudioMixPacket = { v: 1; controllerId: string; controllerAt: number; revision: number; issuedAt: number; mix: SessionAudioMix };
export function parseAudioMixPacket(value: unknown): AudioMixPacket | null {
  if (!value || typeof value !== "object") return null;
  const p = value as AudioMixPacket;
  const mix = parseSessionAudioMix(p.mix);
  if (p.v !== 1 || !mix || typeof p.controllerId !== "string" || !/^[\w:-]{1,80}$/.test(p.controllerId) || ![p.controllerAt, p.revision, p.issuedAt].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
  return { v: 1, controllerId: p.controllerId, controllerAt: p.controllerAt, revision: p.revision, issuedAt: p.issuedAt, mix };
}
export function acceptAudioMixPacket(packet: AudioMixPacket, previous: AudioMixPacket | null, joinedAt: number, now: number) {
  if (packet.issuedAt < joinedAt || now - packet.issuedAt > 10000 || packet.issuedAt > now + 2000) return false;
  return !previous || (packet.controllerAt > previous.controllerAt) || (packet.controllerAt === previous.controllerAt && packet.controllerId === previous.controllerId && packet.revision >= previous.revision);
}

let snapshot: MixSnapshot = { active: false, mix: initialSessionAudioMix(), speaking: false, musicPlaying: false, activityPlaying: false };
const listeners = new Set<() => void>();
export const getSessionMix = () => snapshot;
export const subscribeSessionMix = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setSessionMix(next: Partial<MixSnapshot>) {
  const updated = { ...snapshot, ...next, mix: next.mix ? parseSessionAudioMix(next.mix) || snapshot.mix : snapshot.mix };
  if (JSON.stringify(updated) === JSON.stringify(snapshot)) return;
  snapshot = updated;
  for (const listener of listeners) listener();
}
export const sessionChannelGain = (channel: AudioChannel) => effectiveAudioLevel(channel, snapshot);
