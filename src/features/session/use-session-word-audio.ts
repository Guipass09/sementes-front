import { useEffect, useRef, useState } from "react";
import { isCurrentSessionGameEvent } from "@/lib/session-game-event";
import { sessionChannelGain, subscribeSessionMix } from "./session-audio-mix";
import { parsePhonemeSpeak, WordSpeechPlayer, type PhonemeSpeak, type WordSpeechStatus } from "./word-speech";

type Content = { path: string; share_id: string };
type Options = {
  identity?: string; serverNow?: string; role: "admin" | "user" | null; controlGranted: boolean;
  content: Content | null; disabled: boolean;
  send: (kind: string, payload: unknown) => Promise<void>;
};
export function useSessionWordAudio(options: Options) {
  const callbacks = useRef(options); callbacks.current = options;
  const player = useRef<WordSpeechPlayer | null>(null);
  const pending = useRef<{ event: PhonemeSpeak; remote: boolean; expires: number } | null>(null);
  const seen = useRef(new Set<string>());
  const latest = useRef("");
  const confirmation = useRef<ReturnType<typeof setTimeout>>();
  const clock = useRef({ server: 0, local: 0 });
  const [notice, setNotice] = useState("");
  const [needsActivation, setNeedsActivation] = useState(false);

  const stop = () => {
    pending.current = null;
    latest.current = "";
    clearTimeout(confirmation.current);
    player.current?.stop();
    setNeedsActivation(false);
    setNotice("");
  };
  const play = (event: PhonemeSpeak, remote: boolean) => {
    const { content, role, disabled } = callbacks.current;
    if (!content || disabled || !/^\/jogos\/fonema\/\d+$/.test(content.path)) return;
    const key = `${content.share_id}:${event.request_id}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    if (seen.current.size > 128) seen.current.delete(seen.current.values().next().value!);
    pending.current = null;
    setNeedsActivation(false);
    latest.current = event.request_id;
    if (!remote && role === "admin") {
      setNotice("Enviando palavra ao paciente...");
      clearTimeout(confirmation.current);
      confirmation.current = setTimeout(() => setNotice("Reprodução da palavra ainda não confirmada no paciente."), 6000);
    }
    const captured = content;
    player.current?.play(event.word, status => {
      if (!isCurrentSessionGameEvent(callbacks.current.content, captured) || callbacks.current.disabled) return;
      if (status === "blocked") {
        pending.current = { event, remote, expires: Date.now() + 15000 };
        setNeedsActivation(true);
      } else {
        pending.current = null;
        setNeedsActivation(false);
      }
      if (remote && role === "user") void callbacks.current.send("game_event", {
        ...captured, event: { game: "phoneme", kind: "speech_status", request_id: event.request_id, status },
      }).catch(() => {});
    });
  };
  const activate = () => {
    const retry = pending.current;
    if (!retry || Date.now() > retry.expires) { stop(); return; }
    const content = callbacks.current.content;
    if (content) seen.current.delete(`${content.share_id}:${retry.event.request_id}`);
    play(retry.event, retry.remote);
  };

  useEffect(() => {
    clock.current = { server: Date.parse(options.serverNow || ""), local: performance.now() };
  }, [options.identity, options.serverNow]);

  useEffect(() => {
    player.current = new WordSpeechPlayer({
      synth: window.speechSynthesis,
      create: text => new SpeechSynthesisUtterance(text),
      volume: () => sessionChannelGain("activity"),
      playing: playing => window.dispatchEvent(new CustomEvent("SESSION_WORD_AUDIO_PLAYBACK", { detail: playing })),
    });
    seen.current.clear(); setNotice(""); setNeedsActivation(false);
    const unsubscribe = subscribeSessionMix(() => player.current?.refresh());
    const unlock = () => player.current?.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("pagehide", stop);
    return () => {
      unsubscribe(); stop(); player.current = null;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pagehide", stop);
    };
  }, [options.identity, options.content?.path, options.content?.share_id, options.disabled]);

  return {
    notice, needsActivation, activate,
    local(event: unknown) {
      const parsed = parsePhonemeSpeak(event);
      if (parsed) { play(parsed, false); return true; }
      const action = event as { kind?: string } | null;
      if (action?.kind === "reset" || action?.kind === "answer") stop();
      return false;
    },
    receive(message: { kind: string; from: string; at?: string; payload?: any }) {
      if (message.kind !== "game_event" || !isCurrentSessionGameEvent(callbacks.current.content, message.payload)) return false;
      const event = message.payload?.event;
      if (event?.game === "phoneme" && event.kind === "speech_status") {
        if (callbacks.current.role !== "admin" || message.from !== "user" || event.request_id !== latest.current) return true;
        const notices: Record<WordSpeechStatus, string> = {
          started: "Palavra reproduzindo no paciente", ended: "Palavra reproduzida no paciente",
          blocked: "O paciente precisa tocar em Ativar áudio da palavra.",
          failed: "O navegador do paciente não conseguiu reproduzir a palavra.",
          muted: "Áudio das atividades silenciado no mixer.",
        };
        if (Object.prototype.hasOwnProperty.call(notices, event.status)) {
          clearTimeout(confirmation.current);
          setNotice(notices[event.status as WordSpeechStatus]);
        }
        return true;
      }
      if (message.from !== "admin" && !(message.from === "user" && callbacks.current.controlGranted)) return false;
      const parsed = parsePhonemeSpeak(event);
      if (parsed) {
        const sent = Date.parse(message.at || "");
        const now = clock.current.server + performance.now() - clock.current.local;
        if (!Number.isFinite(sent) || sent < clock.current.server || now - sent > 10000 || sent > now + 2000) return true;
        play(parsed, true);
        return true;
      }
      if (event?.kind === "reset" || event?.kind === "answer") stop();
      return false;
    },
  };
}
