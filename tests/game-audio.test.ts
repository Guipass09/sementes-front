import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";
import {
  gameAudioRoute,
  initialGameAudioMuted,
  isLiveGameAudio,
  sessionGameAudioValue,
  DEFAULT_GAME_AUDIO_VOLUME,
} from "../src/lib/game-audio-policy.ts";
import {
  isGameAudioMuted,
  setGameAudioMuted,
  subscribeGameAudio,
  setGameAudioSettings,
  setGameAudioVolume,
} from "../src/lib/game-audio-store.ts";
import {
  GAME_MUSIC_VOLUME,
  GAME_SOUNDTRACK_FALLBACK_URL,
  GAME_SOUNDTRACK_URL,
  GAME_MUSIC_FADE_SECONDS,
  GameSoundtrack,
} from "../src/lib/game-soundtrack.ts";
import { createGameMediaMute } from "../src/lib/game-media-audio.ts";
import {
  playCardFlip,
  playCardShuffle,
  playCorrect,
  playFanfare,
  playWheelTick,
  playWheelWin,
  playWin,
  playWrong,
  stopGameSfx,
} from "../src/lib/sfx.ts";

beforeEach(() =>
  setGameAudioSettings({ muted: false, volume: DEFAULT_GAME_AUDIO_VOLUME }),
);

test("all game routes get music, but libraries and the live call never do", () => {
  for (const slug of [
    "",
    "memoria/",
    "memoria2/",
    "fonema/",
    "auditivo/",
    "forca/",
    "roleta/",
    "caca-palavras/",
    "cartas/",
    "acerte-imagem/",
    "sons-imagens/",
    "sequencia-imagens/",
  ]) {
    assert.deepEqual(gameAudioRoute(`/jogos/${slug}42`), {
      active: true,
      music: true,
    });
  }
  assert.deepEqual(gameAudioRoute("/atividades/42"), {
    active: true,
    music: false,
  });
  for (const path of [
    "/profissional/jogos/memoria",
    "/admin/jogos/roleta/novo",
    "/paciente/jogos",
    "/sessao/42/chamada",
    "/jogos/unknown/42",
  ]) {
    assert.deepEqual(gameAudioRoute(path), { active: false, music: false });
  }
});

test("every live session starts muted even with a saved unmuted preference", () => {
  for (const search of [
    "?session=1&session_role=admin",
    "?session=1&session_role=user&session_id=42",
    "?session=1&story_preview=1&session_id=42",
  ]) {
    assert.equal(isLiveGameAudio(search), true);
    assert.equal(initialGameAudioMuted(search, "false"), true);
  }
  assert.equal(initialGameAudioMuted("", "false"), false);
  assert.equal(initialGameAudioMuted("", "true"), true);
  assert.equal(
    initialGameAudioMuted("?session=1&story_preview=1", null),
    false,
  );
  assert.equal(
    initialGameAudioMuted("?session=1&story_preview=1", null, true),
    true,
  );
});

test("only server-identified staff audio commands can change patient sound", () => {
  assert.equal(
    sessionGameAudioValue({
      kind: "game_audio",
      from: "admin",
      payload: { muted: false },
    }),
    false,
  );
  assert.equal(
    sessionGameAudioValue({
      kind: "game_audio",
      from: "admin",
      payload: { muted: true },
    }),
    true,
  );
  for (const value of [undefined, "true", 1, null])
    assert.equal(
      sessionGameAudioValue({
        kind: "game_audio",
        from: "admin",
        payload: { muted: value },
      }),
      null,
    );
  assert.equal(
    sessionGameAudioValue({
      kind: "game_audio",
      from: "user",
      payload: { muted: false },
    }),
    null,
  );
  assert.equal(
    sessionGameAudioValue({
      kind: "game_event",
      from: "admin",
      payload: { muted: false },
    }),
    null,
  );
});

test("old queued unmute commands cannot make a new call start with sound", () => {
  const message = {
    from: "admin",
    kind: "game_audio",
    payload: { muted: false },
    at: "2026-10-18T12:00:00Z",
  };
  assert.equal(sessionGameAudioValue(message, "2026-10-18T13:00:00Z"), null);
  assert.equal(
    sessionGameAudioValue(
      { ...message, at: "2026-10-18T13:00:01Z" },
      "2026-10-18T13:00:00Z",
    ),
    false,
  );
  assert.equal(
    sessionGameAudioValue(
      { ...message, at: "invalid" },
      "2026-10-18T13:00:00Z",
    ),
    null,
  );
});

test("master mute includes new media, restores individual mute choices, and releases removed media", () => {
  const first = { muted: false, isConnected: true };
  const alreadyMuted = { muted: true, isConnected: true };
  const later = { muted: false, isConnected: true };
  const media = [first, alreadyMuted];
  const control = createGameMediaMute(() => media);
  control.apply(true);
  assert.equal(first.muted, true);
  first.muted = false;
  media.push(later);
  control.apply(true);
  assert.equal(first.muted, true);
  assert.equal(later.muted, true);
  first.isConnected = false;
  media.shift();
  control.apply(true);
  assert.equal(first.muted, false);
  control.apply(false);
  assert.equal(later.muted, false);
  assert.equal(alreadyMuted.muted, true);
  control.apply(true);
  control.dispose();
  assert.equal(later.muted, false);
});

class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  disconnected = false;
  type = "sine";
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: Array<number | undefined> = [];
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
  start(at: number) {
    this.starts.push(at);
  }
  stop(at?: number) {
    this.stops.push(at);
  }
}
class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  gains: FakeNode[] = [];
  sources: FakeNode[] = [];
  listeners = new Set<() => void>();
  createGain() {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
  addEventListener(_name: string, listener: () => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_name: string, listener: () => void) {
    this.listeners.delete(listener);
  }
  async resume() {
    this.state = "running";
  }
}
class FakeTrack {
  src = GAME_SOUNDTRACK_URL;
  preload = "auto";
  loop = false;
  volume = 1;
  paused = true;
  currentTime = 0;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  listeners = new Map<string, Set<() => void>>();
  canPlayType() {
    return "probably";
  }
  emit(name: string) {
    if (name === "ended" || name === "error") this.paused = true;
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
  async play() {
    this.playCalls++;
    this.paused = false;
  }
  pause() {
    this.pauseCalls++;
    this.paused = true;
  }
  load() {
    this.loadCalls++;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  addEventListener(name: string, listener: () => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }
  removeEventListener(name: string, listener: () => void) {
    this.listeners.get(name)?.delete(listener);
    if (!this.listeners.get(name)?.size) this.listeners.delete(name);
  }
}
const trackFor = (track: FakeTrack) => () =>
  track as unknown as HTMLAudioElement;

test("the recorded soundtrack loops quietly, resumes its place, and releases the media resource", () => {
  setGameAudioMuted(false);
  const track = new FakeTrack();
  let allocations = 0;
  const soundtrack = new GameSoundtrack(() => {
    allocations++;
    return track as unknown as HTMLAudioElement;
  });
  try {
    soundtrack.start();
    assert.equal(track.playCalls, 1);
    assert.equal(track.loop, true);
    assert.equal(track.src, GAME_SOUNDTRACK_URL);
    assert.equal(track.volume, 0);
    assert.equal(track.preload, "none");
    soundtrack.start();
    assert.equal(track.playCalls, 1, "Repeated unlocks cannot layer music");
    track.currentTime = GAME_MUSIC_FADE_SECONDS / 2;
    track.emit("timeupdate");
    assert.equal(track.volume, GAME_MUSIC_VOLUME / 2);
    track.currentTime = GAME_MUSIC_FADE_SECONDS;
    track.emit("timeupdate");
    assert.equal(track.volume, GAME_MUSIC_VOLUME);
    track.currentTime = 18;
    soundtrack.pause();
    assert.equal(track.paused, true);
    soundtrack.start();
    assert.equal(track.currentTime, 18, "Unmuting does not restart music");
    assert.equal(track.playCalls, 2);
    track.currentTime = 0;
    track.emit("timeupdate");
    assert.equal(
      track.volume,
      GAME_MUSIC_VOLUME,
      "Looping does not repeat the fade",
    );
    assert.equal(allocations, 1);
  } finally {
    soundtrack.dispose();
  }
  assert.equal(track.listeners.size, 0);
  assert.equal(track.paused, true);
  assert.equal(track.src, "");
  assert.equal(track.loadCalls, 1);
  soundtrack.start();
  assert.equal(track.playCalls, 2);
});

test("muted startup does not create a player or fetch the recording", () => {
  setGameAudioMuted(true);
  let requests = 0;
  const soundtrack = new GameSoundtrack(() => {
    requests++;
    return null;
  });
  soundtrack.start();
  assert.equal(requests, 0);
  soundtrack.dispose();
});

test("an outstanding play promise cannot restart a paused or disposed soundtrack", async () => {
  setGameAudioMuted(false);
  const track = new FakeTrack();
  let resolveResume!: () => void;
  track.play = () =>
    new Promise<void>((resolve) => {
      resolveResume = resolve;
    });
  const soundtrack = new GameSoundtrack(trackFor(track));
  soundtrack.start();
  soundtrack.pause();
  resolveResume();
  await nextTurn();
  assert.equal(track.paused, true);
  soundtrack.dispose();
});

test("autoplay rejection is quiet and a later gesture retries the same player", async () => {
  setGameAudioMuted(false);
  const track = new FakeTrack();
  let blocked = true;
  track.play = async () => {
    track.playCalls++;
    if (blocked) throw new Error("NotAllowedError");
    track.paused = false;
  };
  const soundtrack = new GameSoundtrack(trackFor(track));
  try {
    soundtrack.start();
    await nextTurn();
    assert.equal(track.paused, true);
    blocked = false;
    soundtrack.start();
    await nextTurn();
    assert.equal(track.paused, false);
    assert.equal(track.playCalls, 2);
    setGameAudioMuted(true);
    track.emit("playing");
    assert.equal(
      track.paused,
      true,
      "Delayed playing events still respect mute",
    );
  } finally {
    soundtrack.dispose();
    setGameAudioMuted(false);
  }
});

test("the children's soundtrack assets match their licensed originals", () => {
  const assets = [
    [
      "childrens-march.ogg",
      "OggS",
      "34f5ed0980ffc21a7ef7ac606ec7f915b0659d0262107bffcb75133c29bd66de",
    ],
    [
      "childrens-march.mp3",
      "ID3",
      "5f3948419dc9b9f15ead808fa2d5da901efd1b806f4369fcd60f45c0501e07fc",
    ],
  ];
  for (const [file, signature, hash] of assets) {
    const asset = readFileSync(
      new URL(`../public/audio/${file}`, import.meta.url),
    );
    assert.equal(asset.subarray(0, signature.length).toString(), signature);
    assert.equal(createHash("sha256").update(asset).digest("hex"), hash);
  }
  const credits = readFileSync(
    new URL("../public/audio/CREDITS.md", import.meta.url),
    "utf8",
  );
  assert.match(credits, /Cleyton Kauffman/);
  assert.match(credits, /CC0 1.0 Universal/);
  assert.equal(GAME_SOUNDTRACK_URL, "/audio/childrens-march.ogg");
  assert.equal(GAME_SOUNDTRACK_FALLBACK_URL, "/audio/childrens-march.mp3");
});

test("browsers without Vorbis support get the MP3 compatibility version", () => {
  const originalAudio = globalThis.Audio;
  setGameAudioMuted(false);
  try {
    for (const support of ["probably", "maybe", ""]) {
      const track = new FakeTrack();
      globalThis.Audio = function () {
        return Object.assign(track, { canPlayType: () => support });
      } as unknown as typeof Audio;
      const soundtrack = new GameSoundtrack();
      try {
        soundtrack.start();
        assert.equal(
          track.src,
          support ? GAME_SOUNDTRACK_URL : GAME_SOUNDTRACK_FALLBACK_URL,
        );
      } finally {
        soundtrack.dispose();
      }
    }
  } finally {
    globalThis.Audio = originalAudio;
  }
});

test("music fades gently at the chosen volume and resumes without restarting", () => {
  const track = new FakeTrack();
  const soundtrack = new GameSoundtrack(trackFor(track));
  try {
    soundtrack.start();
    soundtrack.setVolume(0.08);
    assert.equal(track.volume, 0);
    track.currentTime = GAME_MUSIC_FADE_SECONDS / 2;
    track.emit("timeupdate");
    assert.equal(track.volume, 0.016);
    soundtrack.pause();
    soundtrack.start();
    assert.equal(track.volume, 0.016, "Pause preserves the fade position");
    track.currentTime = GAME_MUSIC_FADE_SECONDS;
    track.emit("timeupdate");
    assert.equal(track.volume, 0.032);
    soundtrack.setVolume(1);
    assert.equal(track.volume, 0.4);
    soundtrack.setVolume(0);
    assert.equal(track.paused, true);
    soundtrack.setVolume(0.2);
    soundtrack.start();
    assert.equal(track.src, GAME_SOUNDTRACK_URL);
    assert.equal(track.volume, 0.08);
  } finally {
    soundtrack.dispose();
  }
});

test("media errors after pause cannot restart music until resumed", () => {
  const track = new FakeTrack();
  const soundtrack = new GameSoundtrack(trackFor(track));
  try {
    soundtrack.start();
    soundtrack.pause();
    track.emit("error");
    assert.equal(track.playCalls, 1);
    assert.equal(track.src, GAME_SOUNDTRACK_FALLBACK_URL);
    soundtrack.start();
    assert.equal(track.playCalls, 2);
  } finally {
    soundtrack.dispose();
  }
});

test("unavailable OGG falls back to MP3 without an infinite retry loop", () => {
  const track = new FakeTrack();
  const soundtrack = new GameSoundtrack(trackFor(track));
  try {
    soundtrack.start();
    track.emit("error");
    assert.equal(track.src, GAME_SOUNDTRACK_FALLBACK_URL);
    assert.equal(track.loop, true);
    const attempts = track.playCalls;
    track.emit("error");
    assert.equal(
      track.playCalls,
      attempts,
      "Broken media cannot create an infinite retry loop",
    );
  } finally {
    soundtrack.dispose();
  }
});

test("the global switch silences every SFX, including wheel effects, and notifies once", () => {
  setGameAudioMuted(true);
  let notifications = 0;
  const unsubscribe = subscribeGameAudio(() => notifications++);
  for (const play of [
    playCorrect,
    playWrong,
    playWin,
    playFanfare,
    playCardFlip,
    playCardShuffle,
    playWheelTick,
    playWheelWin,
  ])
    assert.doesNotThrow(play);
  assert.equal(isGameAudioMuted(), true);
  setGameAudioMuted(true);
  assert.equal(notifications, 0);
  setGameAudioMuted(false);
  assert.equal(notifications, 1);
  unsubscribe();
});

test("muting immediately zeros the shared effects gain without creating new sounds", () => {
  const previousWindow = globalThis.window;
  const context = new FakeContext();
  globalThis.window = {
    AudioContext: function () {
      return context;
    },
    addEventListener() {},
  } as unknown as Window & typeof globalThis;
  try {
    setGameAudioMuted(false);
    playCorrect();
    assert.equal(context.sources.length, 3);
    const master = context.gains[0];
    setGameAudioVolume(1);
    assert.equal(master.gain.value, 0.4);
    setGameAudioVolume(0.08);
    assert.equal(master.gain.value, 0.032);
    setGameAudioVolume(DEFAULT_GAME_AUDIO_VOLUME);
    setGameAudioMuted(true);
    assert.equal(master.gain.value, 0);
    playWheelWin();
    assert.equal(context.sources.length, 3);
    setGameAudioMuted(false);
    assert.equal(master.gain.value, 0.14);
    stopGameSfx();
    assert.equal(master.disconnected, true);
  } finally {
    stopGameSfx();
    globalThis.window = previousWindow;
    setGameAudioMuted(false);
  }
});
