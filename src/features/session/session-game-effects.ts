import type { GameSfx } from "../../lib/game-sfx-bridge.ts";
import { GameSfxRenderer } from "../../lib/game-sfx-renderer.ts";

export class SessionGameEffects {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private renderer: GameSfxRenderer | null = null;
  private level: () => number;
  constructor(level: () => number) { this.level = level; }

  bind(context: AudioContext): boolean {
    if (context !== this.context) {
      this.dispose();
      this.context = context;
      this.gain = context.createGain();
      this.limiter = context.createDynamicsCompressor();
      this.limiter.threshold.value = -3; this.limiter.knee.value = 3;
      this.limiter.ratio.value = 12; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.15;
      this.gain.connect(this.limiter); this.limiter.connect(context.destination);
      this.renderer = new GameSfxRenderer(context, this.gain);
    }
    this.refresh();
    return context.state === "running";
  }
  refresh() {
    if (!this.context || !this.gain) return;
    const level = this.level();
    const volume = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    this.gain.gain.setValueAtTime(volume * 0.4, this.context.currentTime);
    if (volume === 0) this.stop();
  }
  play(effect: GameSfx): boolean {
    this.refresh();
    if (!this.context || this.context.state !== "running") return false;
    if (!this.gain || this.gain.gain.value === 0) return true;
    return this.renderer?.play(effect) === true;
  }
  stop() { this.renderer?.stop(); }
  dispose() {
    this.stop(); this.renderer = null;
    this.gain?.disconnect(); this.gain = null;
    this.limiter?.disconnect(); this.limiter = null;
    // The call owns this context; effects must never close microphone/screen audio.
    this.context = null;
  }
}
