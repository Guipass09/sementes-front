export type WordSpeechStatus = "started" | "ended" | "blocked" | "failed" | "muted";
export type PhonemeSpeak = { game: "phoneme"; kind: "speak"; index: number; word: string; request_id: string };

export function parsePhonemeSpeak(value: unknown): PhonemeSpeak | null {
  if (!value || typeof value !== "object") return null;
  const e = value as PhonemeSpeak;
  if (e.game !== "phoneme" || e.kind !== "speak" || !Number.isSafeInteger(e.index) || e.index < 0 ||
      typeof e.word !== "string" || !e.word.trim() || e.word.length > 180 ||
      typeof e.request_id !== "string" || !/^[\w-]{1,80}$/.test(e.request_id)) return null;
  return { game: "phoneme", kind: "speak", index: e.index, word: e.word.trim(), request_id: e.request_id };
}

// Keep speech in the call's activated top-level window, not an unactivated game iframe.
export class WordSpeechPlayer {
  private options: {
    synth: SpeechSynthesis | undefined;
    create: (text: string) => SpeechSynthesisUtterance;
    volume: () => number;
    playing: (playing: boolean) => void;
  };
  private utterance: SpeechSynthesisUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private report: ((status: WordSpeechStatus) => void) | null = null;
  constructor(options: {
    synth: SpeechSynthesis | undefined;
    create: (text: string) => SpeechSynthesisUtterance;
    volume: () => number;
    playing: (playing: boolean) => void;
  }) { this.options = options; }

  unlock() {
    try {
      if (!this.options.synth || this.utterance) return;
      const silent = this.options.create(" ");
      silent.volume = 0;
      silent.lang = "pt-BR";
      this.options.synth.speak(silent);
    } catch { /* A blocked device is surfaced by the next real playback. */ }
  }

  play(text: string, report: (status: WordSpeechStatus) => void) {
    this.stop();
    const volume = this.options.volume();
    if (volume <= 0) { report("muted"); return; }
    const synth = this.options.synth;
    if (!synth) { report("failed"); return; }
    try {
      const utterance = this.options.create(text);
      this.utterance = utterance;
      this.report = report;
      utterance.lang = "pt-BR";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = Math.min(1, volume);
      const voices = synth.getVoices();
      const portuguese = voices.filter(voice => /^pt[-_]BR$/i.test(voice.lang));
      const voice = portuguese.find(voice => voice.localService) || portuguese[0];
      if (voice) utterance.voice = voice;
      const finish = (status: WordSpeechStatus) => {
        if (this.utterance !== utterance) return;
        this.stop();
        report(status);
      };
      utterance.onstart = () => {
        if (this.utterance !== utterance) return;
        clearTimeout(this.timer);
        this.options.playing(true);
        report("started");
        this.timer = setTimeout(() => finish("failed"), 15000);
      };
      utterance.onend = () => finish("ended");
      utterance.onerror = event => finish(event.error === "not-allowed" ? "blocked" : "failed");
      this.timer = setTimeout(() => finish("blocked"), 4000);
      synth.resume();
      synth.speak(utterance);
    } catch {
      this.stop();
      report("failed");
    }
  }

  refresh() {
    if (!this.utterance) return;
    const volume = this.options.volume();
    if (volume <= 0) {
      const report = this.report;
      this.stop();
      report?.("muted");
    } else this.utterance.volume = Math.min(1, volume);
  }

  stop() {
    clearTimeout(this.timer);
    const utterance = this.utterance;
    this.utterance = null;
    this.report = null;
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      this.options.synth?.cancel();
      this.options.playing(false);
    }
  }
}
