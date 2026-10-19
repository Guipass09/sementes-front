import type { AudioLevel } from "./session-audio-mix.ts";

export const recommendedCapture: MediaStreamConstraints = {
  video: true,
  audio: { echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true }, channelCount: { ideal: 1 } },
};

// Only microphone audio reaches this graph. Never monitor it through local speakers.
export class SessionMicrophone {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private output: MediaStreamAudioDestinationNode | null = null;
  private raw: MediaStream | null = null;
  private level: AudioLevel = { volume: 1, muted: false };
  private generation = 0;
  private createContext: () => AudioContext;
  supported = true;
  constructor(createContext: () => AudioContext = () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()) {
    this.createContext = createContext;
  }

  setLevel(level: AudioLevel) {
    this.level = level;
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(level.muted ? 0 : Math.max(0, Math.min(2, level.volume)), this.context.currentTime, 0.025);
  }
  async resume() {
    if (this.context?.state === "suspended") await this.context.resume();
  }
  async prepare(raw: MediaStream): Promise<MediaStream> {
    if (!raw.getAudioTracks().length) return raw;
    if (this.raw === raw && this.output?.stream.getAudioTracks()[0]?.readyState === "live") {
      await this.resume();
      return new MediaStream([...raw.getVideoTracks(), ...this.output.stream.getAudioTracks()]);
    }
    this.dispose();
    const generation = ++this.generation;
    try {
      const context = this.createContext();
      this.context = context;
      if (context.state === "suspended") await context.resume();
      if (generation !== this.generation) return raw;
      if (context.state !== "running") throw new Error("Microphone audio context is suspended");
      const source = context.createMediaStreamSource(new MediaStream(raw.getAudioTracks()));
      const gain = context.createGain();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -3; compressor.knee.value = 3; compressor.ratio.value = 12;
      compressor.attack.value = 0.003; compressor.release.value = 0.15;
      const output = context.createMediaStreamDestination();
      source.connect(gain); gain.connect(compressor); compressor.connect(output);
      this.raw = raw; this.source = source; this.gain = gain; this.compressor = compressor; this.output = output;
      this.supported = true;
      this.setLevel(this.level);
      return new MediaStream([...raw.getVideoTracks(), ...output.stream.getAudioTracks()]);
    } catch {
      if (generation === this.generation) { this.dispose(); this.supported = false; }
      return raw;
    }
  }
  dispose() {
    this.generation++;
    this.source?.disconnect(); this.gain?.disconnect(); this.compressor?.disconnect();
    this.output?.stream.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {});
    this.context = null; this.source = null; this.gain = null; this.compressor = null; this.output = null; this.raw = null;
  }
}
