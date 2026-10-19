import { getGameAudioVolume, isGameAudioMuted, subscribeGameAudio } from "./game-audio-store.ts";
import { gameAudioGain } from "./game-audio-policy.ts";
import { relayLiveGameSfx, type GameSfx } from "./game-sfx-bridge.ts";
import { GameSfxRenderer } from "./game-sfx-renderer.ts";
export { playSessionReaction } from "../features/session/session-reaction-audio.ts";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let renderer: GameSfxRenderer | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") {
    ctx = new Ctor(); (ctx as any)._sementes = true;
    master = null; renderer = null;
  }
  if (!master) {
    master = ctx!.createGain();
    master.gain.value = isGameAudioMuted() ? 0 : gameAudioGain(getGameAudioVolume(), 0.4);
    master.connect(ctx!.destination);
    renderer = new GameSfxRenderer(ctx!, master);
  }
  return ctx;
}
subscribeGameAudio(() => {
  if (master) master.gain.setValueAtTime(isGameAudioMuted() ? 0 : gameAudioGain(getGameAudioVolume(), 0.4), ctx!.currentTime);
  if (isGameAudioMuted()) renderer?.stop();
});
export const getGameAudioContext = getCtx;
export function stopGameSfx(): void {
  renderer?.stop(); renderer = null;
  try { master?.disconnect(); } catch { /* Already disconnected. */ }
  master = null;
}
export async function unlockSfx(): Promise<void> {
  if (isGameAudioMuted()) return;
  const context = getCtx();
  if (!context) return;
  try {
    if (context.state !== "running") await context.resume();
    const gain = context.createGain(); gain.gain.value = 0.0001; gain.connect(master!);
    const oscillator = context.createOscillator(); oscillator.frequency.value = 440; oscillator.connect(gain);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(context.currentTime); oscillator.stop(context.currentTime + 0.01);
    unlocked = context.state === "running";
  } catch { /* Browsers may require a gesture. */ }
}
export function installSfxUnlock(): void {
  if (typeof window === "undefined" || (window as any).__sementesSfxInstalled) return;
  (window as any).__sementesSfxInstalled = true;
  const handler = () => {
    void unlockSfx();
    if (unlocked) {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    }
  };
  window.addEventListener("pointerdown", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
  window.addEventListener("keydown", handler);
}
export function playGameSfx(effect: GameSfx): void {
  if (relayLiveGameSfx(effect) || isGameAudioMuted()) return;
  installSfxUnlock();
  const context = getCtx();
  if (context?.state === "running") renderer?.play(effect);
}
export const playCorrect = () => playGameSfx("correct");
export const playWrong = () => playGameSfx("wrong");
export const playWin = () => playGameSfx("win");
export const playFanfare = () => playGameSfx("fanfare");
export const playCardFlip = () => playGameSfx("cardFlip");
export const playCardShuffle = () => playGameSfx("cardShuffle");
export const playWheelTick = () => playGameSfx("wheelTick");
export const playWheelWin = () => playGameSfx("wheelWin");
