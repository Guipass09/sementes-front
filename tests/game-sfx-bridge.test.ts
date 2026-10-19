import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SFX, GameSfxGate } from "../src/lib/game-sfx-bridge.ts";
import { playCorrect, playWrong, playWin, playFanfare, playCardFlip, playCardShuffle, playWheelTick, playWheelWin } from "../src/lib/sfx.ts";
import { setGameAudioSettings } from "../src/lib/game-audio-store.ts";

const content = { path: "/jogos/auditivo/4", share_id: "round-1" };
const message = { type: "SESSION_GAME_SFX", ...content, effect: "correct", id: "sound-1", at: 1000 };
test("accepts every supported effect once for the active content", () => {
  const gate = new GameSfxGate();
  for (const effect of GAME_SFX) {
    const event = { ...message, effect, id: effect };
    assert.equal(gate.accept(event, content, 1100), effect);
    assert.equal(gate.accept(event, content, 1100), null);
  }
});
test("rejects old content, unknown sounds, stale and malformed messages", () => {
  for (const value of [null, {}, { ...message, type: "other" }, { ...message, effect: "arbitrary-url" },
    { ...message, share_id: "old" }, { ...message, path: "/jogos/8" }, { ...message, at: -1000 },
    { ...message, at: 5000 }, { ...message, at: NaN }, { ...message, id: "" }]) {
    assert.equal(new GameSfxGate().accept(value, content, 1100), null);
  }
  assert.equal(new GameSfxGate().accept(message, null, 1100), null);
});
test("all live iframe effects are relayed even before the iframe mixer is ready", () => {
  const previousWindow = globalThis.window;
  const sent: any[] = [];
  globalThis.window = {
    parent: { postMessage: (data: unknown, origin: string) => sent.push({ data, origin }) },
    location: { pathname: content.path, search: "?session=1&session_id=12&session_content_id=round-1", origin: "https://app.test" },
  } as any;
  try {
    setGameAudioSettings({ volume: 0, muted: true });
    const players = [playCorrect, playWrong, playWin, playFanfare, playCardFlip, playCardShuffle, playWheelTick, playWheelWin];
    players.forEach(play => play());
    assert.deepEqual(sent.map(m => m.data.effect), GAME_SFX);
    assert.equal(new Set(sent.map(m => m.data.id)).size, GAME_SFX.length);
    for (const { data, origin } of sent) {
      assert.equal(origin, "https://app.test"); assert.equal(data.share_id, content.share_id);
    }
    (globalThis.window as any).location.search = "?session=1&story_preview=1";
    playCorrect(); assert.equal(sent.length, GAME_SFX.length, "standalone story preview must keep local audio");
  } finally { globalThis.window = previousWindow; setGameAudioSettings({ volume: 0.35, muted: false }); }
});
