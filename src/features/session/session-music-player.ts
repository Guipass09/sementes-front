import {
  MUSIC_LEASE_MS,
  musicPosition,
  musicTrack,
  type MusicState,
} from "./session-music-policy.ts";
import { getSessionMix, sessionChannelGain, subscribeSessionMix } from "./session-audio-mix.ts";

export interface MusicPlayer {
  apply(
    state: MusicState,
    leaseMs: number,
    forceSeek?: boolean,
  ): Promise<boolean>;
  pause(): void;
  position(): number;
  unlock(): void;
  dispose(): void;
}

export class SessionMusicPlayer implements MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private mixGain: GainNode | null = null;
  private unsubscribeMix: (() => void) | null = null;
  private generation = 0;
  private disposed = false;
  private deadline = 0;
  private state: MusicState | null = null;
  private targetPosition = 0;
  private seeking = false;
  private onStopped: (reason: "ended" | "error") => void;
  private now: () => number;
  private createAudio: () => HTMLAudioElement;
  private createContext: () => AudioContext;

  constructor(
    onStopped: (reason: "ended" | "error") => void,
    now: () => number = () => performance.now(),
    createAudio: () => HTMLAudioElement = () => new Audio(),
    createContext: () => AudioContext = () => new AudioContext(),
  ) {
    this.onStopped = onStopped;
    this.now = now;
    this.createAudio = createAudio;
    this.createContext = createContext;
  }

  private ensure() {
    if (this.disposed) throw new Error("Player disposed");
    if (this.audio) return;
    this.context = this.createContext();
    this.audio = this.createAudio();
    this.audio.preload = "none";
    this.audio.volume = 1;
    this.source = this.context.createMediaElementSource(this.audio);
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.gain);
    this.mixGain = this.context.createGain();
    this.gain.connect(this.mixGain);
    this.mixGain.connect(this.context.destination);
    this.unsubscribeMix = subscribeSessionMix(this.updateMix);
    this.updateMix();
    this.audio.addEventListener("playing", this.onPlaying);
    this.audio.addEventListener("loadedmetadata", this.seek);
    this.audio.addEventListener("ended", this.onEnded);
    this.audio.addEventListener("error", this.onError);
  }

  private seek = () => {
    if (!this.audio || !this.seeking || this.audio.readyState < 1) return;
    this.audio.currentTime = this.targetPosition;
    this.seeking = false;
  };
  private updateMix = () => {
    if (!this.context || !this.mixGain) return;
    const gain = getSessionMix().active ? sessionChannelGain("music") / 0.25 : 1;
    this.mixGain.gain.setValueAtTime(gain, this.context.currentTime);
  };
  private onPlaying = () => {
    if (this.disposed || !this.state?.playing || this.now() >= this.deadline)
      this.pause();
  };
  private onEnded = () => {
    this.pause();
    this.onStopped("ended");
  };
  private onError = () => {
    this.pause();
    this.onStopped("error");
  };

  unlock() {
    if (this.disposed) return;
    try {
      if (this.state?.playing && this.now() >= this.deadline) this.pause();
      this.ensure();
      if (this.context?.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* No music is started by an unlock gesture. */
    }
  }

  async apply(
    state: MusicState,
    leaseMs: number,
    forceSeek = false,
  ): Promise<boolean> {
    if (this.disposed) return false;
    if (!state.playing || state.volume === 0 || leaseMs <= 0) {
      this.pause();
      return false;
    }
    const version = ++this.generation;
    try {
      this.ensure();
      const audio = this.audio!;
      const context = this.context!;
      const gain = this.gain!;
      const changed = this.state?.trackId !== state.trackId;
      this.state = state;
      this.deadline = this.now() + Math.min(MUSIC_LEASE_MS, leaseMs);
      if (changed) {
        audio.pause();
        audio.src = musicTrack(state.trackId)!.url;
      }
      audio.loop = state.loop;
      const position = musicPosition(state);
      if (
        forceSeek ||
        changed ||
        audio.paused ||
        Math.abs(audio.currentTime - position) > 1.5
      ) {
        this.targetPosition = position;
        this.seeking = true;
        this.seek();
      }
      // The audio renderer enforces expiry even if JS timers are throttled or frozen.
      const t = context.currentTime;
      const seconds = Math.min(MUSIC_LEASE_MS, leaseMs) / 1000;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(state.volume * 0.4, t);
      gain.gain.setValueAtTime(
        state.volume * 0.4,
        t + Math.max(0, seconds - 0.03),
      );
      gain.gain.linearRampToValueAtTime(0, t + seconds);
      if (context.state === "suspended") await context.resume();
      if (
        version !== this.generation ||
        this.disposed ||
        this.now() >= this.deadline
      ) {
        if (
          this.disposed ||
          !this.state?.playing ||
          this.now() >= this.deadline
        )
          audio.pause();
        return false;
      }
      if (context.state !== "running") {
        this.pause();
        return false;
      }
      const remaining = Math.max(0, (this.deadline - this.now()) / 1000);
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(state.volume * 0.4, context.currentTime);
      gain.gain.setValueAtTime(
        state.volume * 0.4,
        context.currentTime + Math.max(0, remaining - 0.03),
      );
      gain.gain.linearRampToValueAtTime(0, context.currentTime + remaining);
      if (audio.paused) await audio.play();
      if (
        version !== this.generation ||
        this.disposed ||
        this.now() >= this.deadline
      ) {
        if (
          !this.state?.playing ||
          this.disposed ||
          this.now() >= this.deadline
        ) {
          audio.pause();
          this.pause();
        }
        return false;
      }
      return !audio.paused;
    } catch {
      if (version === this.generation) this.pause();
      return false;
    }
  }

  pause() {
    this.generation++;
    this.deadline = 0;
    if (this.state) this.state = { ...this.state, playing: false };
    if (this.context && this.gain) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.audio?.pause();
  }
  position() {
    return this.seeking ? this.targetPosition : (this.audio?.currentTime ?? 0);
  }

  dispose() {
    this.pause();
    this.disposed = true;
    if (this.audio) {
      this.audio.removeEventListener("playing", this.onPlaying);
      this.audio.removeEventListener("loadedmetadata", this.seek);
      this.audio.removeEventListener("ended", this.onEnded);
      this.audio.removeEventListener("error", this.onError);
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    this.source?.disconnect();
    this.gain?.disconnect();
    this.mixGain?.disconnect();
    this.unsubscribeMix?.(); this.unsubscribeMix = null;
    void this.context?.close().catch(() => {});
    this.audio = null;
    this.context = null;
    this.gain = null;
    this.mixGain = null;
  }
}
