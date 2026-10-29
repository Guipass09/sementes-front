import { useEffect, useRef, useState } from "react";
import { getSessionMix, sessionChannelGain, subscribeSessionMix } from "@/features/session/session-audio-mix";
import { MouthDemoAudio } from "./mouth-demo-audio";
import { mouthDemoPlaying, mouthDemoPosition, MOUTH_DEMO_DURATION, type MouthDemoState } from "./mouth-demonstrations";

export function useMouthDemoPlayback(options: {
  demo: MouthDemoState | null; now: () => number; live?: boolean; enabled?: boolean;
  prepareAudio?: () => Promise<AudioContext | null>; onStop?: () => void;
}) {
  const current = useRef(options); current.current = options;
  const ownedContext = useRef<AudioContext | null>(null);
  const blockedId = useRef("");
  const [notice, setNotice] = useState<"" | "blocked" | "failed" | "expired">("");
  const [position, setPosition] = useState(0);
  const refresh = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});
  const [suspended, setSuspended] = useState(false);
  useEffect(() => {
    let disposed = false, audible = false;
    const playback = (playing: boolean) => {
      if (playing === audible) return;
      audible = playing;
      if (current.current.live) window.dispatchEvent(new CustomEvent("SESSION_MOUTH_AUDIO_PLAYBACK", { detail: playing }));
    };
    const player = new MouthDemoAudio({
      now: () => current.current.now(), notice: value => { if (!disposed) setNotice(value); }, playback,
      context: async () => {
        if (current.current.prepareAudio) return current.current.prepareAudio();
        if (!ownedContext.current || ownedContext.current.state === "closed") ownedContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ownedContext.current.state !== "running") await ownedContext.current.resume();
        return ownedContext.current;
      },
    });
    const tick = () => {
      const { demo, now, live, enabled = true, onStop } = current.current;
      const time = now();
      const hidden = document.visibilityState === "hidden" || !navigator.onLine;
      if (demo?.status === "playing" && (hidden || !enabled || (live && time >= demo.expiresAt))) {
        blockedId.current = demo.id; setNotice("expired");
        if (enabled) onStop?.();
      }
      const safe = !!demo && demo.id !== blockedId.current && !hidden && enabled;
      setSuspended(!!demo && !safe);
      setPosition(demo ? mouthDemoPosition(demo, time) : 0);
      const volume = (demo?.volume || 0) * (live && getSessionMix().active ? sessionChannelGain("activity") : 1);
      player.sync(demo, volume, !!live, safe);
      if (demo && !demo.repeat && demo.status === "playing" && mouthDemoPosition(demo, time) >= MOUTH_DEMO_DURATION) onStop?.();
    };
    refresh.current = tick;
    retry.current = () => player.retry();
    const interval = window.setInterval(tick, 100);
    const unsub = subscribeSessionMix(tick);
    const halt = () => { const d = current.current.demo; if (d) blockedId.current = d.id; player.stop(); current.current.onStop?.(); };
    window.addEventListener("offline", halt); window.addEventListener("pagehide", halt);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => {
      disposed = true; refresh.current = () => {}; retry.current = () => {}; window.clearInterval(interval); unsub(); player.dispose();
      window.removeEventListener("offline", halt); window.removeEventListener("pagehide", halt); document.removeEventListener("visibilitychange", tick);
      if (ownedContext.current) { void ownedContext.current.close().catch(() => {}); ownedContext.current = null; }
    };
  }, []);
  useEffect(() => { if (!options.demo) setNotice(""); refresh.current(); }, [options.demo, options.enabled]);
  return { notice, position, suspended, activate: () => {
    try {
      retry.current();
      if (!current.current.prepareAudio && (!ownedContext.current || ownedContext.current.state === "closed")) ownedContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      void (current.current.prepareAudio?.() || ownedContext.current?.resume())?.then(() => refresh.current()).catch(() => setNotice("blocked"));
      refresh.current();
    } catch { setNotice("blocked"); }
  } };
}
