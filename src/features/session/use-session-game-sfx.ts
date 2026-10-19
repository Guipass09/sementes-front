import { useEffect, useRef, useState, type RefObject } from "react";
import { GameSfxGate, type GameSfxMessage } from "@/lib/game-sfx-bridge";
import { sessionChannelGain, subscribeSessionMix } from "./session-audio-mix";
import { SessionGameEffects } from "./session-game-effects";

export function useSessionGameSfx(options: {
  identity?: string; content: { path: string; share_id: string } | null;
  role: "admin" | "user" | null;
  frame: RefObject<HTMLIFrameElement>; disabled: boolean;
  context: RefObject<AudioContext | null>; prepare: () => Promise<AudioContext | null>;
}) {
  const callbacks = useRef(options); callbacks.current = options;
  const engine = useRef<SessionGameEffects | null>(null);
  const controls = useRef<{ activate: () => void; stop: () => void } | null>(null);
  const [needsActivation, setNeedsActivation] = useState(false);

  useEffect(() => {
    const touchPointer = window.matchMedia("(pointer: coarse)");
    const output = new SessionGameEffects(() => sessionChannelGain("effects"),
      () => callbacks.current.role === "user" && touchPointer.matches);
    const outputChanged = () => output.refresh();
    touchPointer.addEventListener("change", outputChanged);
    engine.current = output;
    const gate = new GameSfxGate();
    let disposed = false;
    let pendingId: string | null = null;
    let observed: AudioContext | null = null;
    const stateChanged = () => { if (!disposed) setNeedsActivation(observed?.state !== "running"); };
    const attach = (context: AudioContext) => {
      if (observed !== context) {
        observed?.removeEventListener("statechange", stateChanged);
        observed = context; observed.addEventListener("statechange", stateChanged);
      }
      return output.bind(context);
    };
    const prepare = async () => {
      try {
        const context = await callbacks.current.prepare();
        if (disposed) return false;
        const ready = !!context && attach(context);
        setNeedsActivation(!ready);
        return ready;
      } catch { if (!disposed) setNeedsActivation(true); return false; }
    };
    const stop = () => { pendingId = null; output.stop(); };
    controls.current = { activate: () => { void prepare(); }, stop };
    setNeedsActivation(false);
    const message = (event: MessageEvent) => {
      const current = callbacks.current;
      if (current.disabled || event.origin !== window.location.origin || event.source !== current.frame.current?.contentWindow) return;
      const effect = gate.accept(event.data, current.content, Date.now());
      if (!effect || sessionChannelGain("effects") <= 0) return;
      const context = current.context.current;
      if (context && attach(context)) { output.play(effect); return; }
      const request = event.data as GameSfxMessage;
      pendingId = request.id;
      setNeedsActivation(true);
      // Resume an interrupted call, but never build a queue of old clicks.
      void prepare().then(ready => {
        const latest = callbacks.current;
        if (!ready || disposed || pendingId !== request.id || latest.disabled ||
          latest.content?.share_id !== request.share_id || Date.now() - request.at > 1500) return;
        pendingId = null; output.play(effect);
      });
    };
    const gesture = () => {
      const context = callbacks.current.context.current;
      if (context?.state === "running") { attach(context); setNeedsActivation(false); }
      else void prepare();
    };
    const visible = () => { if (document.visibilityState === "visible") gesture(); else stop(); };
    const unsubscribe = subscribeSessionMix(() => output.refresh());
    window.addEventListener("message", message);
    window.addEventListener("pointerdown", gesture, { passive: true });
    window.addEventListener("touchstart", gesture, { passive: true });
    window.addEventListener("keydown", gesture);
    window.addEventListener("pageshow", gesture);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true; pendingId = null; controls.current = null;
      unsubscribe(); observed?.removeEventListener("statechange", stateChanged);
      touchPointer.removeEventListener("change", outputChanged);
      window.removeEventListener("message", message); window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("touchstart", gesture); window.removeEventListener("keydown", gesture);
      window.removeEventListener("pageshow", gesture); window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", visible);
      output.dispose(); engine.current = null;
    };
  }, [options.identity]);
  useEffect(() => { controls.current?.stop(); }, [options.content?.path, options.content?.share_id, options.disabled]);
  return { needsActivation, activate: () => controls.current?.activate() };
}
