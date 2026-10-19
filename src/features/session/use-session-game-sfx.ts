import { useEffect, useRef, useState, type RefObject } from "react";
import { GameSfxGate } from "@/lib/game-sfx-bridge";
import { getGameAudioContext, playGameSfx, stopGameSfx, unlockSfx } from "@/lib/sfx";
import { sessionChannelGain } from "./session-audio-mix";

export function useSessionGameSfx(options: {
  identity?: string; content: { path: string; share_id: string } | null;
  frame: RefObject<HTMLIFrameElement>; disabled: boolean;
}) {
  const callbacks = useRef(options); callbacks.current = options;
  const [needsActivation, setNeedsActivation] = useState(false);

  const activate = () => {
    void unlockSfx().then(() => setNeedsActivation(getGameAudioContext()?.state !== "running"));
  };
  useEffect(() => {
    const gate = new GameSfxGate();
    setNeedsActivation(false);
    const message = (event: MessageEvent) => {
      const current = callbacks.current;
      if (current.disabled || event.origin !== window.location.origin || event.source !== current.frame.current?.contentWindow) return;
      const effect = gate.accept(event.data, current.content, Date.now());
      if (!effect || sessionChannelGain("effects") <= 0) return;
      // The mirrored game requests local playback only. Never rebroadcast a sound.
      if (getGameAudioContext()?.state !== "running") { setNeedsActivation(true); return; }
      playGameSfx(effect);
    };
    const gesture = () => {
      if (getGameAudioContext()?.state !== "running") activate();
    };
    window.addEventListener("message", message);
    window.addEventListener("pointerdown", gesture, { passive: true });
    window.addEventListener("keydown", gesture);
    window.addEventListener("pagehide", stopGameSfx);
    return () => {
      window.removeEventListener("message", message);
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("keydown", gesture);
      window.removeEventListener("pagehide", stopGameSfx);
      stopGameSfx();
    };
  }, [options.identity, options.content?.path, options.content?.share_id, options.disabled]);
  return { needsActivation, activate };
}
