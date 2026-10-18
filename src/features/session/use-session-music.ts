import { useCallback, useEffect, useRef, useState } from "react";
import { SessionMusicController } from "./session-music-controller";
import { SessionMusicPlayer } from "./session-music-player";
import {
  initialMusicState,
  type MusicState,
  type MusicView,
} from "./session-music-policy";

type Message = { kind: string; from: string; payload?: unknown; at?: string };
export function useSessionMusic({
  role,
  identity,
  serverNow,
  send,
  connected,
}: {
  role: "admin" | "user" | null;
  identity?: string;
  serverNow?: string;
  send: (kind: string, payload: unknown) => Promise<void>;
  connected: () => boolean;
}) {
  const [view, setView] = useState<MusicView>(() => ({
    ...initialMusicState(),
    notice: "",
    confirmed: false,
  }));
  const controller = useRef<SessionMusicController | null>(null);
  const callbacks = useRef({ send, connected });
  callbacks.current = { send, connected };
  useEffect(() => {
    setView({ ...initialMusicState(), notice: "", confirmed: false });
    const clock = Date.parse(serverNow || "");
    if (!identity || !role || !Number.isFinite(clock)) return;
    let engine: SessionMusicController;
    const player = new SessionMusicPlayer((reason) => {
      if (reason === "ended") engine.ended();
      else
        engine.safetyPause(
          "Não foi possível carregar a música. Escolha outra faixa e tente novamente.",
        );
    });
    engine = new SessionMusicController({
      role,
      serverNow: clock,
      now: () => performance.now(),
      id: crypto.randomUUID(),
      player,
      send: (kind, payload) => callbacks.current.send(kind, payload),
      onView: setView,
    });
    controller.current = engine;
    const interval = window.setInterval(() => {
      if (!callbacks.current.connected() && engine.isPlaying())
        engine.safetyPause(
          "A música foi pausada enquanto a chamada se reconecta.",
        );
      engine.tick();
    }, 250);
    const stop = () =>
      engine.safetyPause(
        "A música foi pausada por segurança. Toque novamente para continuar.",
      );
    const hidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const unlock = () => engine.unlock();
    window.addEventListener("offline", stop);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("offline", stop);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", hidden);
      controller.current = null;
      engine.dispose();
    };
  }, [identity, role, serverNow]);

  const change = useCallback((patch: Partial<MusicState>) => {
    if (patch.playing && !callbacks.current.connected()) {
      controller.current?.safetyPause(
        "Aguarde o paciente se conectar para tocar a música.",
      );
      return;
    }
    controller.current?.change(patch);
  }, []);
  const receive = useCallback(
    (message: Message) => controller.current?.receive(message),
    [],
  );
  const pause = useCallback(
    () =>
      controller.current?.safetyPause(
        "A música foi pausada enquanto a conexão se recupera.",
      ),
    [],
  );
  const isPlaying = useCallback(
    () => controller.current?.isPlaying() ?? false,
    [],
  );
  return { view, change, receive, pause, isPlaying };
}
