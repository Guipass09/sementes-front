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

  constructor(createAudio: () => HTMLAudioElement = () => new Audio()) {
    this.createAudio = createAudio;
  }

  private onPlaying = () => {
    if (
      this.disposed ||
      !this.wanted ||
      isGameAudioMuted() ||
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
    if (this.audio)
      this.audio.volume = gameAudioGain(this.volume, 0.4 * this.fadeProgress);
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
      isGameAudioMuted() ||
      this.volume === 0 ||
      !this.audio.paused
    )
      return;
    void this.audio
      .play()
      .then(this.onPlaying)
      .catch(() => {
        // A later user gesture retries blocked autoplay without resetting playback.
      });
  }

  start() {
    if (this.disposed || isGameAudioMuted() || this.volume === 0) return;
    this.wanted = true;
    if (!this.audio) {
      this.audio = this.createAudio();
      this.audio.preload = "none";
      this.useOgg = !!this.audio.canPlayType('audio/ogg; codecs="vorbis"');
      this.audio.addEventListener("playing", this.onPlaying);
      this.audio.addEventListener("timeupdate", this.onTimeUpdate);
      this.audio.addEventListener("error", this.onError);
      this.selectSource();
    }
    this.play();
  }

  pause() {
    this.wanted = false;
    this.audio?.pause();
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
    this.audio = null;
  }
}
