import { useCallback, useEffect, useRef, useState } from "react";
import { setGameAudioSettings } from "@/lib/game-audio-store";
import { GameSoundtrack } from "@/lib/game-soundtrack";
import { acceptAudioMixPacket, getSessionMix, initialSessionAudioMix, parseAudioMixPacket, sessionChannelGain, setSessionMix, subscribeSessionMix, type AudioMixPacket, type SessionAudioMix } from "./session-audio-mix";
import type { SessionMicrophone } from "./session-microphone";

type Message = { kind: string; from: string; payload?: unknown };
type Options = {
  role: "admin" | "user" | null; identity?: string; serverNow?: string;
  send: (kind: string, payload: unknown) => Promise<void>;
  postFrame: (data: unknown) => void; microphone: SessionMicrophone;
  speaking: boolean; musicPlaying: boolean; gameActive: boolean;
  connected: () => boolean;
};
export function useSessionAudioMixer(options: Options) {
  const [mix, setMix] = useState(initialSessionAudioMix);
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const callbacks = useRef(options); callbacks.current = options;
  const engine = useRef<{ change: (mix: SessionAudioMix) => void; receive: (message: Message) => void; publish: () => void } | null>(null);
  const soundtrackLease = useRef(0);
  const postToFrame = useCallback(() => callbacks.current.postFrame({ type: "SESSION_AUDIO_MIX", ...getSessionMix() }), []);

  useEffect(() => {
    const initial = initialSessionAudioMix();
    soundtrackLease.current = 0;
    setMix(initial); setNotice(""); setConfirmed(false);
    setSessionMix({ active: true, mix: initial, speaking: false, musicPlaying: false, activityPlaying: false });
    const { role, identity, serverNow } = callbacks.current;
    const serverAt = Date.parse(serverNow || "");
    const started = performance.now();
    const now = () => Math.floor(serverAt + performance.now() - started);
    const controllerId = crypto.randomUUID();
    let revision = 0;
    let remote: AudioMixPacket | null = null;
    let disposed = false;
    let sending = false;
    let dirty = false;
    let timer = 0;
    let lastAck = -Infinity;
    const supported = () => callbacks.current.microphone.supported;
    const frameChanged = () => {
      const state = getSessionMix();
      const channel = role === "admin" ? "professionalMic" : "patientMic";
      callbacks.current.microphone.setLevel(state.mix.channels[channel]);
      setGameAudioSettings({ muted: state.mix.channels.effects.muted, volume: sessionChannelGain("effects") });
      postToFrame();
    };
    const unsubscribe = subscribeSessionMix(frameChanged);
    frameChanged();
    const publish = async () => {
      if (disposed || role !== "admin" || !identity || !Number.isFinite(serverAt)) return;
      dirty = true;
      if (sending) return;
      sending = true;
      try {
        while (dirty && !disposed) {
          dirty = false;
          const sentRevision = revision;
          const packet: AudioMixPacket = { v: 1, controllerId, controllerAt: serverAt, issuedAt: now(), revision: sentRevision, mix: getSessionMix().mix };
          try { await callbacks.current.send("audio_mix", packet); }
          catch { if (!disposed) { setConfirmed(false); setNotice("Ajuste ainda não confirmado no paciente. Tentando novamente."); } }
        }
      } finally { sending = false; }
    };
    engine.current = {
      publish: () => { void publish(); },
      change(next) {
        if (role !== "admin" || disposed) return;
        revision++; setConfirmed(false); setNotice(""); setMix(next); setSessionMix({ mix: next });
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void publish(); }, 100);
      },
      receive(message) {
        if (disposed || !Number.isFinite(serverAt)) return;
        if (role === "admin") {
          if (message.from !== "user") return;
          if (message.kind === "audio_mix_request") { void publish(); return; }
          if (message.kind !== "audio_mix_ack" || !message.payload || typeof message.payload !== "object") return;
          const ack = message.payload as { controllerId?: string; revision?: number; microphoneSupported?: boolean };
          if (ack.controllerId !== controllerId || ack.revision !== revision) return;
          setConfirmed(true);
          lastAck = performance.now();
          soundtrackLease.current = performance.now() + 6500;
          setNotice(ack.microphoneSupported === false ? "O navegador do paciente não permite ganho digital. O microfone segue no nível original." : "");
          return;
        }
        if (message.from !== "admin" || message.kind !== "audio_mix") return;
        const packet = parseAudioMixPacket(message.payload);
        if (!packet || !acceptAudioMixPacket(packet, remote, serverAt, now())) return;
        remote = packet;
        soundtrackLease.current = performance.now() + 6500;
        setMix(packet.mix); setSessionMix({ mix: packet.mix });
        void callbacks.current.send("audio_mix_ack", { controllerId: packet.controllerId, revision: packet.revision, microphoneSupported: supported() }).catch(() => {});
      },
    };
    let mediaPlaying = false;
    let wordPlaying = false;
    const wordPlayback = (event: Event) => {
      wordPlaying = (event as CustomEvent<boolean>).detail === true;
      setSessionMix({ activityPlaying: mediaPlaying || wordPlaying });
    };
    const ready = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      // Only the call's own current content iframe may report activity playback.
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Conteúdo da sessão"]');
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.data?.type === "GAME_AUDIO_READY") postToFrame();
      if (event.data?.type === "SESSION_ACTIVITY_AUDIO" && typeof event.data.playing === "boolean") {
        mediaPlaying = event.data.playing;
        setSessionMix({ activityPlaying: mediaPlaying || wordPlaying });
      }
    };
    window.addEventListener("message", ready);
    window.addEventListener("SESSION_WORD_AUDIO_PLAYBACK", wordPlayback);
    if (role === "admin") void publish();
    else if (role === "user" && identity) void callbacks.current.send("audio_mix_request", {}).catch(() => {});
    const interval = window.setInterval(() => {
      postToFrame();
      if (role === "admin") { if (performance.now() - lastAck > 6500) setConfirmed(false); void publish(); }
      else if (!remote && identity) void callbacks.current.send("audio_mix_request", {}).catch(() => {});
    }, 2000);
    return () => {
      disposed = true; engine.current = null;
      window.clearTimeout(timer); window.clearInterval(interval); unsubscribe(); window.removeEventListener("message", ready);
      window.removeEventListener("SESSION_WORD_AUDIO_PLAYBACK", wordPlayback);
      setSessionMix({ active: false, mix: initialSessionAudioMix(), speaking: false, musicPlaying: false, activityPlaying: false });
    };
  }, [options.identity, options.role, options.serverNow, postToFrame]);

  useEffect(() => { setSessionMix({ speaking: options.speaking, musicPlaying: options.musicPlaying }); }, [options.speaking, options.musicPlaying]);
  useEffect(() => {
    setSessionMix({ activityPlaying: false });
  }, [options.gameActive]);

  useEffect(() => {
    const soundtrack = new GameSoundtrack(undefined, () => !getSessionMix().active || sessionChannelGain("soundtrack") === 0, true);
    const refresh = () => {
      try {
        const lease = Math.max(0, soundtrackLease.current - performance.now());
        soundtrack.setLease(lease);
        soundtrack.setVolume(sessionChannelGain("soundtrack"));
        if (lease > 0 && callbacks.current.gameActive && callbacks.current.connected() && document.visibilityState !== "hidden" && navigator.onLine) soundtrack.start();
        else soundtrack.pause();
      } catch { soundtrack.pause(); }
    };
    const unsubscribe = subscribeSessionMix(refresh);
    const interval = window.setInterval(refresh, 250);
    const stop = () => soundtrack.pause();
    window.addEventListener("pagehide", stop); window.addEventListener("offline", stop);
    window.addEventListener("pointerdown", refresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      unsubscribe(); window.clearInterval(interval); soundtrack.dispose();
      window.removeEventListener("pagehide", stop); window.removeEventListener("offline", stop);
      window.removeEventListener("pointerdown", refresh); document.removeEventListener("visibilitychange", refresh);
    };
  }, [options.identity]);

  return {
    mix, notice, confirmed,
    change: useCallback((next: SessionAudioMix) => engine.current?.change(next), []),
    reset: useCallback(() => engine.current?.change(initialSessionAudioMix()), []),
    receive: useCallback((message: Message) => engine.current?.receive(message), []),
    publish: useCallback(() => engine.current?.publish(), []),
    postToFrame,
  };
}
