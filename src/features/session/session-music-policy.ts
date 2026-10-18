import catalog from "./session-music-catalog.json" with { type: "json" };

export const SESSION_MUSIC_TRACKS = catalog;
export const MUSIC_LEASE_MS = 5000;
export const MUSIC_HEARTBEAT_MS = 1400;
export const MUSIC_ACK_TIMEOUT_MS = 6000;
export type MusicState = {
  trackId: string;
  playing: boolean;
  position: number;
  loop: boolean;
  volume: number;
};
export type MusicPacket = MusicState & {
  v: 1;
  controllerId: string;
  controllerAt: number;
  revision: number;
  sequence: number;
  issuedAt: number;
};
export type MusicAck = {
  v: 1;
  controllerId: string;
  revision: number;
  sequence: number;
  issuedAt: number;
  playing: boolean;
};
export type MusicView = MusicState & { notice: string; confirmed: boolean };
export const initialMusicState = (): MusicState => ({
  trackId: SESSION_MUSIC_TRACKS[0].id,
  playing: false,
  position: 0,
  loop: true,
  volume: 0.25,
});
export const musicTrack = (id: string) =>
  SESSION_MUSIC_TRACKS.find((track) => track.id === id);
export function musicPosition(state: MusicState, elapsedSeconds = 0) {
  const duration = musicTrack(state.trackId)?.duration ?? 0;
  const position = Math.max(
    0,
    state.position + (state.playing ? elapsedSeconds : 0),
  );
  return duration > 0
    ? state.loop
      ? position % duration
      : Math.min(position, duration)
    : 0;
}
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const identifier = (value: unknown) =>
  typeof value === "string" && /^[\w:-]{1,80}$/.test(value);
export function parseMusicPacket(value: unknown): MusicPacket | null {
  if (!value || typeof value !== "object") return null;
  const packet = value as MusicPacket;
  if (
    packet.v !== 1 ||
    !identifier(packet.controllerId) ||
    !integer(packet.controllerAt) ||
    !integer(packet.revision) ||
    !integer(packet.sequence) ||
    !integer(packet.issuedAt) ||
    !musicTrack(packet.trackId) ||
    typeof packet.playing !== "boolean" ||
    typeof packet.loop !== "boolean" ||
    typeof packet.position !== "number" ||
    !Number.isFinite(packet.position) ||
    packet.position < 0 ||
    packet.position > 3600 ||
    typeof packet.volume !== "number" ||
    !Number.isFinite(packet.volume) ||
    packet.volume < 0 ||
    packet.volume > 1
  )
    return null;
  return {
    v: 1,
    controllerId: packet.controllerId,
    controllerAt: packet.controllerAt,
    revision: packet.revision,
    sequence: packet.sequence,
    issuedAt: packet.issuedAt,
    trackId: packet.trackId,
    playing: packet.playing,
    position: packet.position,
    loop: packet.loop,
    volume: packet.volume,
  };
}
export function parseMusicAck(value: unknown): MusicAck | null {
  if (!value || typeof value !== "object") return null;
  const packet = value as MusicAck;
  return packet.v === 1 &&
    identifier(packet.controllerId) &&
    integer(packet.revision) &&
    integer(packet.sequence) &&
    integer(packet.issuedAt) &&
    typeof packet.playing === "boolean"
    ? {
        v: 1,
        controllerId: packet.controllerId,
        revision: packet.revision,
        sequence: packet.sequence,
        issuedAt: packet.issuedAt,
        playing: packet.playing,
      }
    : null;
}
export function musicLeaseRemaining(issuedAt: number, serverNow: number) {
  const age = serverNow - issuedAt;
  return age < -1000 ? 0 : Math.max(0, MUSIC_LEASE_MS - Math.max(0, age));
}
