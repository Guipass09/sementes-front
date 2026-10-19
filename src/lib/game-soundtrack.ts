import { getGameAudioVolume, isGameAudioMuted } from "./game-audio-store.ts";
import {
  DEFAULT_GAME_AUDIO_VOLUME,
  gameAudioGain,
  normalizeGameAudioVolume,
} from "./game-audio-policy.ts";

export const GAME_SOUNDTRACK_URL = "/audio/childrens-march.ogg";
export const GAME_SOUNDTRACK_FALLBACK_URL = "/audio/childrens-march.mp3";
export const GAME_MUSIC_VOLUME = gameAudioGain(DEFAULT_GAME_AUDIO_VOLUME, 0.4);
export const GAME_MUSIC_FADE_SECONDS = 1.5;

export class GameSoundtrack {
  private audio: HTMLAudioElement | null = null;
  private disposed = false;
  private wanted = false;
  private fadeProgress = 0;
  private useOgg = true;
  private fallbackUsed = false;
  private volume = getGameAudioVolume();
  private createAudio: () => HTMLAudioElement;
  private isMuted: () => boolean;
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private useWebAudio: boolean;
  private expiresAt = 0;

  constructor(createAudio: () => HTMLAudioElement = () => new Audio(), isMuted = isGameAudioMuted, useWebAudio = false) {
    this.createAudio = createAudio;
    this.isMuted = isMuted;
    this.useWebAudio = useWebAudio;
  }

  private onPlaying = () => {
    if (
      this.disposed ||
      !this.wanted ||
      this.isMuted() ||
      this.volume === 0
    )
      this.audio?.pause();
  };

  private onTimeUpdate = () => {
    if (this.disposed || !this.audio) return;
    // Fade once using playback time, so pauses and background tabs need no timers.
    this.fadeProgress = Math.max(
      this.fadeProgress,
      Math.min(1, this.audio.currentTime / GAME_MUSIC_FADE_SECONDS),
    );
    this.updateVolume();
  };

  private onError = () => {
    if (this.disposed || !this.audio) return;
    if (this.useOgg && !this.fallbackUsed) {
      this.fallbackUsed = true;
      this.selectSource();
      if (this.wanted) this.play();
    }
  };

  private selectSource() {
    if (!this.audio) return;
    this.audio.pause();
    const ogg = this.useOgg && !this.fallbackUsed;
    this.audio.src = ogg ? GAME_SOUNDTRACK_URL : GAME_SOUNDTRACK_FALLBACK_URL;
    this.audio.loop = true;
    this.updateVolume();
  }

  private updateVolume() {
    const volume = gameAudioGain(this.volume, 0.4 * this.fadeProgress);
    if (this.context && this.gain) {
      const t = this.context.currentTime;
      const remaining = Math.max(0, (this.expiresAt - performance.now()) / 1000);
      this.gain.gain.cancelScheduledValues(t);
      if (remaining <= 0) { this.gain.gain.setValueAtTime(0, t); return; }
      this.gain.gain.setValueAtTime(remaining > 0 ? volume : 0, t);
      this.gain.gain.setValueAtTime(volume, t + Math.max(0, remaining - 0.03));
      this.gain.gain.linearRampToValueAtTime(0, t + remaining);
    } else if (this.audio) this.audio.volume = volume;
  }

  setLease(milliseconds: number) {
    this.expiresAt = performance.now() + Math.max(0, milliseconds);
    this.updateVolume();
    if (milliseconds <= 0) this.pause();
  }

  setVolume(value: number) {
    this.volume = normalizeGameAudioVolume(value);
    this.updateVolume();
    if (this.volume === 0) this.pause();
  }

  private play() {
    if (
      !this.audio ||
      this.disposed ||
      !this.wanted ||
      this.isMuted() ||
      this.volume === 0 ||
      !this.audio.paused
    )
      return;
    const play = () => this.audio!.play();
    void (this.context?.state === "suspended" ? this.context.resume().then(play) : play())
      .then(this.onPlaying)
      .catch(() => {
        // A later user gesture retries blocked autoplay without resetting playback.
      });
  }

  start() {
    if (this.disposed || this.isMuted() || this.volume === 0) return;
    this.wanted = true;
    if (!this.audio) {
      this.audio = this.createAudio();
      if (this.useWebAudio) {
        this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.source = this.context.createMediaElementSource(this.audio);
        this.gain = this.context.createGain(); this.gain.gain.value = 0;
        this.source.connect(this.gain); this.gain.connect(this.context.destination);
        this.audio.volume = 1;
      }
      this.audio.preload = "none";
      this.useOgg = !!this.audio.canPlayType('audio/ogg; codecs="vorbis"');
      this.audio.addEventListener("playing", this.onPlaying);
      this.audio.addEventListener("timeupdate", this.onTimeUpdate);
      this.audio.addEventListener("error", this.onError);
      this.selectSource();
    }
    if (this.useWebAudio && !this.gain) return;
    this.play();
  }

  pause() {
    this.wanted = false;
    this.audio?.pause();
    if (this.context && this.gain) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  dispose() {
    this.disposed = true;
    this.pause();
    if (!this.audio) return;
    this.audio.removeEventListener("playing", this.onPlaying);
    this.audio.removeEventListener("timeupdate", this.onTimeUpdate);
    this.audio.removeEventListener("error", this.onError);
    this.audio.removeAttribute("src");
    this.audio.load();
    this.source?.disconnect(); this.gain?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = null; this.source = null; this.gain = null;
    this.audio = null;
  }
}
