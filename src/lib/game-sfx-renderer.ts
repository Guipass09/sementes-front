import type { GameSfx } from "./game-sfx-bridge.ts";

// One score for standalone games and calls; each caller owns its output bus.
export class GameSfxRenderer {
  private context: AudioContext;
  private target: AudioNode;
  private sources = new Set<AudioScheduledSourceNode>();
  private winBus: GainNode | null = null;
  constructor(context: AudioContext, target: AudioNode) { this.context = context; this.target = target; }

  private envelope(gain: GainNode, when: number, duration: number, attack = 0.002) {
    const peak = Math.max(0.0001, gain.gain.value);
    gain.gain.cancelScheduledValues(when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + Math.max(0.02, duration - 0.01));
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
  }
  private tone(freq: number, when: number, duration: number, type: OscillatorType, volume: number, target = this.target) {
    const source = this.context.createOscillator(), gain = this.context.createGain();
    source.type = type; source.frequency.setValueAtTime(freq, when); gain.gain.value = volume;
    source.connect(gain); gain.connect(target); this.envelope(gain, when, duration);
    this.track(source, [gain]); source.start(when); source.stop(when + duration);
  }
  private noise(when: number, duration: number, volume: number, target = this.target, firework = false) {
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (firework ? (i / samples.length < 0.25 ? 1 : 0.55) : 0.6);
    const source = this.context.createBufferSource(); source.buffer = buffer;
    const highpass = this.context.createBiquadFilter();
    highpass.type = "highpass"; highpass.frequency.setValueAtTime(firework ? 1400 : 1600, when);
    const gain = this.context.createGain(); gain.gain.value = volume;
    source.connect(highpass);
    const nodes: AudioNode[] = [highpass, gain];
    if (firework) {
      const bandpass = this.context.createBiquadFilter();
      bandpass.type = "bandpass"; bandpass.frequency.setValueAtTime(2200 + Math.random() * 900, when); bandpass.Q.value = 1.4;
      highpass.connect(bandpass); bandpass.connect(gain); nodes.push(bandpass);
    } else highpass.connect(gain);
    gain.connect(target); this.envelope(gain, when, duration, 0.001);
    this.track(source, nodes); source.start(when); source.stop(when + duration);
  }
  play(effect: GameSfx): boolean {
    if (this.context.state !== "running") return false;
    const t = this.context.currentTime + 0.01;
    switch (effect) {
      case "correct":
        this.tone(523.25, t, 0.14, "triangle", 0.9); this.tone(659.25, t + 0.02, 0.14, "triangle", 0.8); this.tone(783.99, t + 0.04, 0.16, "sine", 0.7); break;
      case "wrong":
        this.tone(196, t, 0.1, "sawtooth", 0.6); this.tone(146.8, t + 0.02, 0.12, "square", 0.5); this.noise(t + 0.02, 0.09, 0.35); break;
      case "cardFlip":
        this.tone(880, t, 0.05, "triangle", 0.7); this.tone(660, t + 0.01, 0.06, "sine", 0.45); break;
      case "cardShuffle":
        this.noise(t, 0.18, 0.35);
        [[220, 0.02, 0.25], [260, 0.07, 0.22], [300, 0.12, 0.2]].forEach(([freq, offset, volume]) => this.tone(freq, t + offset, 0.08, "square", volume)); break;
      case "wheelTick": this.tone(600, t, 0.04, "sine", 0.4); break;
      case "wheelWin": [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(freq, t + i * 0.15, 0.25, "sine", 0.65)); break;
      case "fanfare": {
        const notes: [number, number, OscillatorType, number][] = [
          [523.25, 0, "square", 0.15], [659.25, 0, "square", 0.15], [783.99, 0, "square", 0.15],
          [587.33, 0.18, "square", 0.12], [698.46, 0.18, "square", 0.12],
          [783.99, 0.33, "square", 0.1], [987.77, 0.33, "square", 0.1], [1046.5, 0.33, "square", 0.1],
          [659.25, 0.46, "sine", 0.25], [783.99, 0.46, "sine", 0.25], [987.77, 0.46, "sine", 0.25],
        ];
        notes.forEach(([freq, start, type, duration]) => this.tone(freq, t + start, duration, type, type === "square" ? 0.55 : 0.45));
        this.noise(t + 0.48, 0.2, 0.4, this.target, true); break;
      }
      case "win": {
        this.winBus?.disconnect();
        this.winBus = this.context.createGain(); this.winBus.gain.value = 1; this.winBus.connect(this.target);
        const target = this.winBus, beat = 60 / 132;
        const notes: [number, number, OscillatorType, number][] = [
          [523.25, 0, "triangle", 0.5], [659.25, 0.5, "triangle", 0.5], [783.99, 1, "sine", 0.5],
          [659.25, 1.5, "triangle", 0.5], [698.46, 2, "sine", 0.5], [659.25, 2.5, "triangle", 0.5],
          [523.25, 3, "triangle", 0.6], [587.33, 3.6, "sine", 0.4], [659.25, 4, "sine", 0.6], [783.99, 4.6, "sine", 0.7],
        ];
        notes.forEach(([freq, start, type, duration]) => this.tone(freq, t + start * beat, Math.max(0.08, duration * beat), type, 0.65, target));
        const chords: [number[], number, number][] = [
          [[261.63, 329.63, 392], 0, 0.6], [[293.66, 369.99, 440], 1.3, 0.55],
          [[261.63, 329.63, 392], 2.6, 0.6], [[349.23, 440, 523.25], 3.8, 0.6],
        ];
        chords.forEach(([frequencies, start, duration]) => frequencies.forEach(freq => this.tone(freq, t + start * beat, Math.max(0.12, duration * beat), "triangle", 0.18, target)));
        for (let i = 0; i < 12; i++) this.noise(t + i * (4 / 12) + Math.random() * 0.12, 0.16 + Math.random() * 0.08, 0.22 + Math.random() * 0.18, target, true);
        this.noise(t + 3.6, 0.26, 0.35, target, true);
        this.tone(1046.5, t + 3.65, 0.18, "sine", 0.35, target); this.tone(1318.5, t + 3.78, 0.22, "sine", 0.3, target); break;
      }
    }
    return true;
  }
  stop() {
    for (const source of this.sources) { try { source.stop(); source.disconnect(); } catch { /* Source already ended. */ } }
    this.sources.clear(); this.winBus?.disconnect(); this.winBus = null;
  }
}
