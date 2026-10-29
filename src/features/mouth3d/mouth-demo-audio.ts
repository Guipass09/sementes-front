import { mouthDemoAsset, mouthDemoPlaying, mouthDemoPosition, MOUTH_DEMO_DURATION, type MouthDemoState } from "./mouth-demonstrations.ts";

type Options = { context: () => Promise<AudioContext | null>; now: () => number; notice: (value: "" | "blocked" | "failed") => void; playback: (playing: boolean) => void };

// Uses the call's unlocked context when available. Its nodes never connect to the microphone sender.
export class MouthDemoAudio {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private desired: { demo: MouthDemoState; volume: number; leased: boolean } | null = null;
  private key = "";
  private generation = 0;
  private pending = false;
  private abort: AbortController | null = null;
  private startedAt = 0;
  private offset = 0;
  private unavailableKey = "";
  private options: Options;
  constructor(options: Options) { this.options = options; }

  sync(demo: MouthDemoState | null, volume: number, leased: boolean, enabled: boolean) {
    if (!demo || !enabled || demo.muted || volume <= 0 || !mouthDemoPlaying(demo, this.options.now(), leased)) { this.desired = null; this.stop(); return; }
    const key = `${demo.id}:${demo.preset}:${demo.speed}:${demo.repeat}`;
    this.desired = { demo, volume, leased };
    if (key !== this.key) { this.stop(); this.key = key; }
    if (key === this.unavailableKey) return;
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(Math.min(1, volume), this.context.currentTime, 0.02);
    if (this.source && this.context?.state === "running") {
      const duration = MOUTH_DEMO_DURATION / 1000 / demo.speed;
      const actual = (this.offset + this.context.currentTime - this.startedAt) % duration;
      const target = mouthDemoPosition(demo, this.options.now()) / 1000 / demo.speed;
      const drift = Math.abs(actual - target);
      if (Math.min(drift, duration - drift) < 0.18) return;
      this.stop(); this.key = key;
    }
    if (this.source && this.context?.state !== "running") { this.stop(); this.key = key; }
    if (!this.pending) void this.start();
  }

  private async start() {
    this.pending = true;
    const generation = ++this.generation;
    try {
      const context = await this.options.context();
      if (generation !== this.generation) return;
      if (!context || context.state !== "running") { this.unavailableKey = this.key; this.options.notice("blocked"); return; }
      if (this.context !== context) {
        this.gain?.disconnect(); this.limiter?.disconnect(); this.buffers.clear();
        this.context = context; this.gain = context.createGain(); this.limiter = context.createDynamicsCompressor();
        this.limiter.threshold.value = -3; this.limiter.knee.value = 3; this.limiter.ratio.value = 12;
        this.gain.connect(this.limiter); this.limiter.connect(context.destination);
      }
      const wanted = this.desired;
      if (!wanted) return;
      const asset = mouthDemoAsset(wanted.demo.preset, wanted.demo.speed);
      let buffer = this.buffers.get(asset);
      if (!buffer) {
        this.abort = new AbortController();
        const response = await fetch(asset, { signal: this.abort.signal });
        if (!response.ok) throw new Error("Audio unavailable");
        buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (generation !== this.generation) return;
        this.buffers.set(asset, buffer);
      }
      const current = this.desired;
      if (generation !== this.generation || !current || !mouthDemoPlaying(current.demo, this.options.now(), current.leased)) return;
      this.source = context.createBufferSource(); this.source.buffer = buffer;
      this.source.loop = current.demo.repeat; this.source.loopEnd = Math.min(buffer.duration, MOUTH_DEMO_DURATION / 1000 / current.demo.speed);
      this.source.connect(this.gain!);
      this.gain!.gain.setValueAtTime(Math.min(1, current.volume), context.currentTime);
      this.offset = mouthDemoPosition(current.demo, this.options.now()) / 1000 / current.demo.speed;
      this.startedAt = context.currentTime;
      this.source.start(0, Math.min(this.offset, buffer.duration - 0.005));
      this.options.notice(""); this.options.playback(true);
    } catch (error) {
      if (generation === this.generation && (error as Error)?.name !== "AbortError") { this.unavailableKey = this.key; this.options.notice("failed"); }
    } finally { if (generation === this.generation) this.pending = false; }
  }

  stop() {
    this.generation++; this.pending = false; this.abort?.abort(); this.abort = null;
    if (this.source) { try { this.source.stop(); } catch { /* Already ended. */ } this.source.disconnect(); this.source = null; }
    this.key = ""; this.options.playback(false);
  }
  retry() { this.unavailableKey = ""; }
  dispose() { this.desired = null; this.stop(); this.gain?.disconnect(); this.limiter?.disconnect(); this.buffers.clear(); }
}
