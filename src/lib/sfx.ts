type AudioCtx = AudioContext & { _sementes?: true };

let ctx: AudioCtx | null = null;
let master: GainNode | null = null;
let unlocked = false;
let winBus: GainNode | null = null;

function getCtx(): AudioCtx | null {
  if (typeof window === "undefined") return null;
  const W: any = window;
  const Ctor = W.AudioContext || W.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor() as AudioCtx;
    ctx._sementes = true;
    master = ctx.createGain();
    master.gain.value = 0.14; // volume padrão (suave)
    master.connect(ctx.destination);
  }
  return ctx;
}

export async function unlockSfx(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    // "ping" silencioso para alguns iOS
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.connect(master!);
    const o = c.createOscillator();
    o.frequency.value = 440;
    o.connect(g);
    const t = c.currentTime;
    o.start(t);
    o.stop(t + 0.01);
    unlocked = true;
  } catch {
    // ignore: browser pode bloquear até gesto do usuário
  }
}

export function installSfxUnlock(): void {
  if (typeof window === "undefined") return;
  // instala só uma vez
  const W: any = window;
  if (W.__sementesSfxInstalled) return;
  W.__sementesSfxInstalled = true;

  const handler = () => {
    void unlockSfx();
    // remove depois de desbloquear
    if (unlocked) {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    }
  };
  window.addEventListener("pointerdown", handler, { passive: true } as any);
  window.addEventListener("touchstart", handler, { passive: true } as any);
  window.addEventListener("keydown", handler);
}

function env(g: GainNode, t0: number, a = 0.001, d = 0.12): void {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1.0, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq: number, when: number, dur: number, type: OscillatorType, vol = 1): void {
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === "suspended") return; // evita "no-op" barulhento

  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = vol;
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  o.connect(g);
  g.connect(master);
  env(g, when, 0.002, Math.max(0.02, dur - 0.01));
  o.start(when);
  o.stop(when + dur);
}

function noise(when: number, dur: number, vol = 0.7): void {
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === "suspended") return;

  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1600;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  env(g, when, 0.001, dur - 0.01);
  src.start(when);
  src.stop(when + dur);
}

function toneTo(target: GainNode, freq: number, when: number, dur: number, type: OscillatorType, vol = 1): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") return;
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = vol;
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  o.connect(g);
  g.connect(target);
  env(g, when, 0.002, Math.max(0.02, dur - 0.01));
  o.start(when);
  o.stop(when + dur);
}

function fireworkBurst(target: GainNode, when: number, dur = 0.18, vol = 0.35): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") return;

  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // mais "estalo" no início, mais "cauda" depois
    const t = i / bufferSize;
    const amp = t < 0.25 ? 1.0 : 0.55;
    data[i] = (Math.random() * 2 - 1) * amp;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;

  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1400, when);

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(2200 + Math.random() * 900, when);
  bp.Q.value = 1.4;

  const g = c.createGain();
  g.gain.value = vol;

  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(target);

  env(g, when, 0.001, dur - 0.01);
  src.start(when);
  src.stop(when + dur);
}

export function playCorrect(): void {
  installSfxUnlock();
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.01;
  // “chime” (triad maior) — criativo porém suave
  tone(523.25, t, 0.14, "triangle", 0.9); // C5
  tone(659.25, t + 0.02, 0.14, "triangle", 0.8); // E5
  tone(783.99, t + 0.04, 0.16, "sine", 0.7); // G5
}

export function playWrong(): void {
  installSfxUnlock();
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.01;
  // “buzzer” curto
  tone(196.0, t, 0.10, "sawtooth", 0.6); // G3
  tone(146.8, t + 0.02, 0.12, "square", 0.5); // D3
  noise(t + 0.02, 0.09, 0.35);
}

export function playWin(): void {
  installSfxUnlock();
  const c = getCtx();
  if (!c) return;
  if (!master) return;
  if (c.state === "suspended") return;

  // Se tocar de novo enquanto ainda toca, silencia o anterior.
  if (winBus) {
    try { winBus.disconnect(); } catch { /* ignore */ }
    winBus = null;
  }
  winBus = c.createGain();
  winBus.gain.value = 1.0;
  winBus.connect(master);

  const t0 = c.currentTime + 0.02;
  const bpm = 132;
  const beat = 60 / bpm; // ~0.45s

  // Melodia curta “conquista” (4s) em C maior, com um toque divertido.
  const notes: Array<[number, number, OscillatorType, number]> = [
    // [freq, startBeat, type, durBeats]
    [523.25, 0.0, "triangle", 0.5], // C5
    [659.25, 0.5, "triangle", 0.5], // E5
    [783.99, 1.0, "sine", 0.5], // G5
    [659.25, 1.5, "triangle", 0.5], // E5
    [698.46, 2.0, "sine", 0.5], // F5
    [659.25, 2.5, "triangle", 0.5], // E5
    [523.25, 3.0, "triangle", 0.6], // C5
    [587.33, 3.6, "sine", 0.4], // D5
    [659.25, 4.0, "sine", 0.6], // E5
    [783.99, 4.6, "sine", 0.7], // G5
  ];

  // Base “plucky” (acordes curtos) para dar sensação de música.
  const chords: Array<[number[], number, number]> = [
    [[261.63, 329.63, 392.0], 0.0, 0.6], // C4-E4-G4
    [[293.66, 369.99, 440.0], 1.3, 0.55], // D4-F#4-A4 (leve brilho)
    [[261.63, 329.63, 392.0], 2.6, 0.6],
    [[349.23, 440.0, 523.25], 3.8, 0.6], // F4-A4-C5
  ];

  for (const [freq, sb, type, db] of notes) {
    toneTo(winBus, freq, t0 + sb * beat, Math.max(0.08, db * beat), type, 0.65);
  }
  for (const [arr, sb, db] of chords) {
    for (const f of arr) {
      toneTo(winBus, f, t0 + sb * beat, Math.max(0.12, db * beat), "triangle", 0.18);
    }
  }

  // “Fogos”: estalos distribuídos ao longo de ~4s
  const bursts = 12;
  for (let i = 0; i < bursts; i++) {
    const tt = t0 + (i * (4.0 / bursts)) + (Math.random() * 0.12);
    fireworkBurst(winBus, tt, 0.16 + Math.random() * 0.08, 0.22 + Math.random() * 0.18);
  }

  // Finalzinho “sparkle”
  fireworkBurst(winBus, t0 + 3.6, 0.26, 0.35);
  toneTo(winBus, 1046.5, t0 + 3.65, 0.18, "sine", 0.35); // C6
  toneTo(winBus, 1318.5, t0 + 3.78, 0.22, "sine", 0.30); // E6
}


