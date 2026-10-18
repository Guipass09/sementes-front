import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  DEFAULT_GAME_AUDIO_VOLUME,
  GAME_AUDIO_VOLUME_PREFERENCE,
  GAME_AUDIO_PREFERENCE,
  gameAudioGain,
  normalizeGameAudioVolume,
  parseGameAudioSettings,
  sessionGameAudioSettings,
} from "../src/lib/game-audio-policy.ts";
import {
  getGameAudioSettings,
  getGameAudioVolume,
  isGameAudioMuted,
  readGameAudioVolumePreference,
  setGameAudioSettings,
  setGameAudioVolume,
  subscribeGameAudio,
} from "../src/lib/game-audio-store.ts";
import { createGameMediaMute } from "../src/lib/game-media-audio.ts";

beforeEach(() =>
  setGameAudioSettings({ muted: false, volume: DEFAULT_GAME_AUDIO_VOLUME }),
);

test("volume is bounded and invalid levels cannot enter media APIs", () => {
  assert.equal(normalizeGameAudioVolume(-1), 0);
  assert.equal(normalizeGameAudioVolume(2), 1);
  for (const value of [NaN, Infinity, undefined, "90"])
    assert.equal(normalizeGameAudioVolume(value), DEFAULT_GAME_AUDIO_VOLUME);
  assert.equal(gameAudioGain(0.35, 0.4), 0.14);
  assert.equal(gameAudioGain(0, 0.4), 0);
  assert.equal(gameAudioGain(1, 0.4), 0.4);
});

test("mute and volume update atomically and do not overwrite each other", () => {
  let changes = 0;
  const unsubscribe = subscribeGameAudio(() => changes++);
  try {
    const snapshot = getGameAudioSettings();
    assert.equal(getGameAudioSettings(), snapshot);
    setGameAudioSettings({ muted: true, volume: 0.07 });
    assert.equal(changes, 1);
    assert.equal(isGameAudioMuted(), true);
    assert.equal(getGameAudioVolume(), 0.07);
    setGameAudioVolume(0.95);
    assert.equal(isGameAudioMuted(), true);
    assert.equal(getGameAudioVolume(), 0.95);
    setGameAudioVolume(0.95);
    assert.equal(changes, 2);
  } finally {
    unsubscribe();
  }
});

test("volume preferences survive reload and gracefully tolerate unavailable storage", () => {
  const previousWindow = globalThis.window;
  const values = new Map<string, string>();
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } as unknown as Window & typeof globalThis;
  try {
    assert.equal(readGameAudioVolumePreference(), DEFAULT_GAME_AUDIO_VOLUME);
    setGameAudioSettings({ muted: true, volume: 0.09 }, true);
    assert.equal(values.get(GAME_AUDIO_VOLUME_PREFERENCE), "0.09");
    assert.equal(values.get(GAME_AUDIO_PREFERENCE), "true");
    assert.equal(readGameAudioVolumePreference(), 0.09);
    values.set(GAME_AUDIO_VOLUME_PREFERENCE, "invalid");
    assert.equal(readGameAudioVolumePreference(), DEFAULT_GAME_AUDIO_VOLUME);
    values.set(GAME_AUDIO_VOLUME_PREFERENCE, "");
    assert.equal(readGameAudioVolumePreference(), DEFAULT_GAME_AUDIO_VOLUME);
    Object.defineProperty(globalThis.window, "localStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    });
    assert.equal(readGameAudioVolumePreference(), DEFAULT_GAME_AUDIO_VOLUME);
    assert.doesNotThrow(() => setGameAudioVolume(0.6, true));
  } finally {
    globalThis.window = previousWindow;
  }
});

test("only valid staff messages can control the patient's game volume", () => {
  const message = {
    from: "admin",
    kind: "game_audio",
    payload: { muted: false, volume: 0.08 },
  };
  assert.deepEqual(sessionGameAudioSettings(message), message.payload);
  assert.equal(sessionGameAudioSettings({ ...message, from: "user" }), null);
  assert.deepEqual(parseGameAudioSettings({ muted: true }), {
    muted: true,
    volume: DEFAULT_GAME_AUDIO_VOLUME,
  });
  for (const volume of [-1, 2, NaN, "high", null])
    assert.equal(parseGameAudioSettings({ muted: false, volume }), null);
  assert.deepEqual(parseGameAudioSettings({ muted: false, volume: 0 }), {
    muted: false,
    volume: 0,
  });
});

test("media levels change live and restore original per-player volumes on disposal", () => {
  const media = { muted: false, volume: 0.8, isConnected: true };
  const control = createGameMediaMute(() => [media]);
  control.apply(false, 0.07);
  assert.equal(media.volume, 0.07);
  control.apply(true, 0.95);
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.95);
  control.apply(false, 0);
  assert.equal(media.muted, false);
  assert.equal(media.volume, 0);
  control.dispose();
  assert.equal(media.volume, 0.8);
});
