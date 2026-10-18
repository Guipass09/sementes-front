import {
  GAME_AUDIO_PREFERENCE,
  initialGameAudioMuted,
  GAME_AUDIO_VOLUME_PREFERENCE,
  DEFAULT_GAME_AUDIO_VOLUME,
  normalizeGameAudioVolume,
  type GameAudioSettings,
} from "./game-audio-policy.ts";

export function readGameAudioPreference(): string | null {
  try {
    return window.localStorage.getItem(GAME_AUDIO_PREFERENCE);
  } catch {
    return null;
  }
}

export function readGameAudioVolumePreference(): number {
  try {
    const value = window.localStorage.getItem(GAME_AUDIO_VOLUME_PREFERENCE);
    return value === null || value.trim() === ""
      ? DEFAULT_GAME_AUDIO_VOLUME
      : normalizeGameAudioVolume(Number(value));
  } catch {
    return DEFAULT_GAME_AUDIO_VOLUME;
  }
}

export function saveGameAudioVolumePreference(value: number) {
  try {
    window.localStorage.setItem(
      GAME_AUDIO_VOLUME_PREFERENCE,
      String(normalizeGameAudioVolume(value)),
    );
  } catch {
    /* Storage is optional. */
  }
}

let settings: GameAudioSettings = {
  volume: readGameAudioVolumePreference(),
  muted:
    typeof window !== "undefined"
      ? initialGameAudioMuted(
          window.location.search,
          readGameAudioPreference(),
          window.parent !== window,
        )
      : false,
};
const listeners = new Set<() => void>();

export const isGameAudioMuted = () => settings.muted;
export const getGameAudioVolume = () => settings.volume;
export const getGameAudioSettings = () => settings;
export function subscribeGameAudio(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setGameAudioMuted(value: boolean, persist = false) {
  setGameAudioSettings({ ...settings, muted: value }, persist);
}

export function setGameAudioVolume(value: number, persist = false) {
  setGameAudioSettings({ ...settings, volume: value }, persist);
}

export function setGameAudioSettings(
  value: GameAudioSettings,
  persist = false,
) {
  const next = {
    muted: value.muted,
    volume: normalizeGameAudioVolume(value.volume),
  };
  if (persist) {
    try {
      window.localStorage.setItem(GAME_AUDIO_PREFERENCE, String(next.muted));
    } catch {
      /* Private browsing can disable storage. */
    }
    saveGameAudioVolumePreference(next.volume);
  }
  if (next.muted === settings.muted && next.volume === settings.volume) return;
  settings = next;
  for (const listener of listeners) listener();
}
