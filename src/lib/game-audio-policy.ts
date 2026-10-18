export const GAME_AUDIO_PREFERENCE = "sementes:game-audio-muted";
export const GAME_AUDIO_VOLUME_PREFERENCE = "sementes:game-audio-volume";
export const DEFAULT_GAME_AUDIO_VOLUME = 0.35;
export type GameAudioSettings = { muted: boolean; volume: number };

export function normalizeGameAudioVolume(
  value: unknown,
  fallback = DEFAULT_GAME_AUDIO_VOLUME,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function gameAudioGain(volume: number, maximum: number): number {
  return Number((normalizeGameAudioVolume(volume) * maximum).toFixed(4));
}

export function parseGameAudioSettings(
  value: unknown,
): GameAudioSettings | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<GameAudioSettings>;
  if (typeof data.muted !== "boolean") return null;
  if (
    data.volume !== undefined &&
    (typeof data.volume !== "number" ||
      !Number.isFinite(data.volume) ||
      data.volume < 0 ||
      data.volume > 1)
  )
    return null;
  return {
    muted: data.muted,
    volume: data.volume ?? DEFAULT_GAME_AUDIO_VOLUME,
  };
}

export function gameAudioRoute(path: string) {
  const game =
    /^\/jogos\/(?:\d+|(?:memoria|memoria2|fonema|auditivo|forca|roleta|caca-palavras|cartas|acerte-imagem|sons-imagens|sequencia-imagens)\/\d+)\/?$/.test(
      path,
    );
  return { active: game || /^\/atividades\/\d+\/?$/.test(path), music: game };
}

export function isLiveGameAudio(search: string) {
  const params = new URLSearchParams(search);
  return (
    params.get("session") === "1" &&
    (params.has("session_id") || params.get("story_preview") !== "1")
  );
}

export function initialGameAudioMuted(
  search: string,
  preference: string | null,
  embedded = false,
) {
  return embedded || isLiveGameAudio(search) || preference === "true";
}

export function sessionGameAudioValue(
  message: { from?: string; kind?: string; payload?: unknown; at?: string },
  joinedAt?: string,
): boolean | null {
  return sessionGameAudioSettings(message, joinedAt)?.muted ?? null;
}

export function sessionGameAudioSettings(
  message: { from?: string; kind?: string; payload?: unknown; at?: string },
  joinedAt?: string,
): GameAudioSettings | null {
  if (message.from !== "admin" || message.kind !== "game_audio") return null;
  if (
    joinedAt &&
    (!Number.isFinite(Date.parse(message.at || "")) ||
      Date.parse(message.at!) < Date.parse(joinedAt))
  )
    return null;
  return parseGameAudioSettings(message.payload);
}
