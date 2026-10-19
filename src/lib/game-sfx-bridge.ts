import { isLiveGameAudio } from "./game-audio-policy.ts";

export const GAME_SFX = ["correct", "wrong", "win", "fanfare", "cardFlip", "cardShuffle", "wheelTick", "wheelWin"] as const;
export type GameSfx = typeof GAME_SFX[number];
export type GameSfxMessage = { type: "SESSION_GAME_SFX"; effect: GameSfx; id: string; path: string; share_id: string; at: number };

export function relayLiveGameSfx(effect: GameSfx): boolean {
  if (typeof window === "undefined" || !window.parent || window.parent === window || !isLiveGameAudio(window.location.search)) return false;
  const share_id = new URLSearchParams(window.location.search).get("session_content_id");
  if (!share_id) return false;
  try {
    window.parent.postMessage({ type: "SESSION_GAME_SFX", effect, id: crypto.randomUUID(),
      path: window.location.pathname, share_id, at: Date.now() } satisfies GameSfxMessage, window.location.origin);
  } catch { return false; }
  return true;
}

export class GameSfxGate {
  private seen = new Set<string>();
  accept(value: unknown, content: { path: string; share_id: string } | null, now: number): GameSfx | null {
    if (!value || typeof value !== "object" || !content) return null;
    const m = value as GameSfxMessage;
    if (m.type !== "SESSION_GAME_SFX" || !GAME_SFX.includes(m.effect) || m.share_id !== content.share_id ||
      m.path !== content.path.split("?")[0] || !Number.isSafeInteger(m.at) || now - m.at > 1500 || m.at > now + 100 ||
      typeof m.id !== "string" || !/^[\w-]{1,80}$/.test(m.id)) return null;
    const key = `${m.share_id}:${m.id}`;
    if (this.seen.has(key)) return null;
    this.seen.add(key);
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    return m.effect;
  }
}
