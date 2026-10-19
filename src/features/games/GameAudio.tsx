import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  gameAudioRoute,
  initialGameAudioMuted,
  isLiveGameAudio,
  DEFAULT_GAME_AUDIO_VOLUME,
  parseGameAudioSettings,
  type GameAudioSettings,
} from "@/lib/game-audio-policy";
import {
  isGameAudioMuted,
  getGameAudioSettings,
  getGameAudioVolume,
  readGameAudioPreference,
  readGameAudioVolumePreference,
  setGameAudioSettings,
  setGameAudioMuted,
  subscribeGameAudio,
} from "@/lib/game-audio-store";
import { GameSoundtrack } from "@/lib/game-soundtrack";
import { createGameMediaMute } from "@/lib/game-media-audio";
import { createSessionMediaGain } from "@/lib/session-media-gain";
import { stopGameSfx } from "@/lib/sfx";
import { getSessionMix, parseSessionAudioMix, sessionChannelGain, setSessionMix, subscribeSessionMix } from "@/features/session/session-audio-mix";

export function GameAudioButton({
  muted,
  onClick,
  disabled = false,
}: {
  muted: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = muted ? "Ativar sons dos jogos" : "Silenciar sons dos jogos";
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-10 w-10 flex-none bg-background shadow-sm"
      aria-label={label}
      title={label}
      aria-pressed={muted}
      disabled={disabled}
      onClick={onClick}
      data-game-audio-control
    >
      {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
    </Button>
  );
}

export function GameAudioControls({
  settings,
  onChange,
  onCommit,
  disabled = false,
}: {
  settings: GameAudioSettings;
  onChange: (settings: GameAudioSettings) => void;
  onCommit?: (settings: GameAudioSettings) => void;
  disabled?: boolean;
}) {
  const silent = settings.muted || settings.volume === 0;
  const percent = Math.round(settings.volume * 100);
  const commit = (value: string) =>
    onCommit?.({ ...settings, volume: Number(value) / 100 });
  return (
    <fieldset
      disabled={disabled}
      aria-label="Som dos jogos"
      data-game-audio-control
      className="flex h-12 w-[236px] min-w-0 max-w-full flex-none items-center gap-2 rounded-md border border-border bg-background px-1.5 shadow-sm"
    >
      <GameAudioButton
        muted={silent}
        disabled={disabled}
        onClick={() => {
          const next = {
            muted: !silent,
            volume: settings.volume || DEFAULT_GAME_AUDIO_VOLUME,
          };
          onChange(next);
          onCommit?.(next);
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label="Volume dos jogos"
        aria-valuetext={`${percent}%`}
        title="Volume dos jogos"
        className="h-8 min-w-0 flex-1 cursor-pointer accent-primary"
        onChange={(event) =>
          onChange({
            ...settings,
            volume: Number(event.currentTarget.value) / 100,
          })
        }
        onPointerUp={(event) => commit(event.currentTarget.value)}
        onKeyUp={(event) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(event.key)
          )
            commit(event.currentTarget.value);
        }}
        onBlur={(event) => {
          const group = event.currentTarget.closest(
            "fieldset[data-game-audio-control]",
          );
          if (
            event.relatedTarget instanceof Node &&
            group?.contains(event.relatedTarget)
          )
            return;
          commit(event.currentTarget.value);
        }}
      />
      <output
        className="w-9 flex-none text-right text-xs tabular-nums text-muted-foreground"
        aria-label="Volume atual"
      >
        {percent}%
      </output>
    </fieldset>
  );
}

export default function GameAudio() {
  const { pathname, search } = useLocation();
  const route = gameAudioRoute(pathname);
  const params = new URLSearchParams(search);
  if (!route.active) return null;
  return (
    <GameAudioController
      key={`${pathname}:${params.get("session_id")}:${params.get("session_content_id")}`}
      search={search}
      music={route.music && !isLiveGameAudio(search)}
    />
  );
}

function GameAudioController({
  search,
  music,
}: {
  search: string;
  music: boolean;
}) {
  const settings = useSyncExternalStore(
    subscribeGameAudio,
    getGameAudioSettings,
    getGameAudioSettings,
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [controlled, setControlled] = useState(false);
  const live = isLiveGameAudio(search);

  useLayoutEffect(() => {
    setGameAudioSettings({
      muted: initialGameAudioMuted(
        search,
        readGameAudioPreference(),
        window.parent !== window,
      ),
      volume: readGameAudioVolumePreference(),
    });
    return () => {
      stopGameSfx();
      setGameAudioMuted(false);
    };
  }, [search]);

  useEffect(() => {
    const soundtrack = new GameSoundtrack();
    const mediaMute = createGameMediaMute(() =>
      document.querySelectorAll<HTMLMediaElement>("audio, video"),
    );
    const mediaGain = createSessionMediaGain();
    let contentReady = false;
    let animationFrame = 0;
    const childFrame = (source: MessageEventSource | null) =>
      Array.from(document.querySelectorAll("iframe")).find(
        (frame) => frame.contentWindow === source,
      );
    const postChildren = () => {
      for (const frame of document.querySelectorAll("iframe")) {
        frame.contentWindow?.postMessage(
          { type: "GAME_AUDIO_STATE", ...getGameAudioSettings() },
          window.location.origin,
        );
        if (getSessionMix().active) frame.contentWindow?.postMessage({ type: "SESSION_AUDIO_MIX", ...getSessionMix() }, window.location.origin);
      }
    };
    const silenceMedia = () => {
      const mix = getSessionMix();
      mediaMute.apply(mix.active ? mix.mix.channels.activity.muted : isGameAudioMuted(), mix.active ? sessionChannelGain("activity") : getGameAudioVolume(), mix.active ? mediaGain : undefined);
    };
    const reportPlayback = () => {
      if (!getSessionMix().active || window.parent === window) return;
      const playing = sessionChannelGain("activity") > 0 && Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video")).some(media => !media.paused && !media.ended && !media.muted && media.volume > 0);
      window.parent.postMessage({ type: "SESSION_ACTIVITY_AUDIO", playing }, window.location.origin);
    };
    const refresh = () => {
      silenceMedia();
      if (isGameAudioMuted() || getGameAudioVolume() === 0)
        window.speechSynthesis?.cancel();
      soundtrack.setVolume(getGameAudioVolume());
      if (
        music &&
        contentReady &&
        !isGameAudioMuted() &&
        getGameAudioVolume() > 0 &&
        document.visibilityState !== "hidden"
      ) {
        try {
          soundtrack.start();
        } catch {
          /* Sound must never interrupt gameplay. */
        }
      } else soundtrack.pause();
    };
    const settingsChanged = () => {
      refresh();
      postChildren();
      reportPlayback();
    };
    const gesture = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-game-audio-control]")
      )
        return;
      refresh();
    };
    const ready = (event: Event) => {
      contentReady = (event as CustomEvent<boolean>).detail === true;
      refresh();
    };
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (window.parent !== window && event.source === window.parent && data?.type === "SESSION_AUDIO_MIX") {
        const mix = parseSessionAudioMix(data.mix);
        if (!mix || data.active !== true) return;
        setControlled(true);
        setSessionMix({ active: true, mix, speaking: data.speaking === true, musicPlaying: data.musicPlaying === true, activityPlaying: data.activityPlaying === true });
        return;
      }
      if (
        window.parent !== window &&
        event.source === window.parent &&
        data?.type === "GAME_AUDIO_STATE" &&
        parseGameAudioSettings(data) && !getSessionMix().active
      ) {
        setControlled(true);
        setGameAudioSettings(parseGameAudioSettings(data)!);
      } else if (childFrame(event.source)) {
        if (data?.type === "GAME_AUDIO_READY") postChildren();
      }
    };
    const updateDom = () => {
      silenceMedia();
      setPortalTarget(
        (document.fullscreenElement ||
          document.querySelector(".is-pseudo-fullscreen") ||
          document.body) as HTMLElement,
      );
    };
    const observer = new MutationObserver(() => {
      if (!animationFrame)
        animationFrame = requestAnimationFrame(() => {
          animationFrame = 0;
          updateDom();
        });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    const unsubscribe = subscribeGameAudio(settingsChanged);
    const unsubscribeMix = subscribeSessionMix(() => {
      if (getSessionMix().active) setGameAudioSettings({ muted: getSessionMix().mix.channels.effects.muted, volume: sessionChannelGain("effects") });
      settingsChanged();
    });
    window.addEventListener("GAME_CONTENT_READY", ready);
    window.addEventListener("message", message);
    window.addEventListener("pointerdown", gesture, { passive: true });
    window.addEventListener("keydown", gesture);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("fullscreenchange", updateDom);
    document.addEventListener("webkitfullscreenchange", updateDom);
    document.addEventListener("play", silenceMedia, true);
    document.addEventListener("volumechange", silenceMedia, true);
    document.addEventListener("play", reportPlayback, true);
    document.addEventListener("pause", reportPlayback, true);
    document.addEventListener("ended", reportPlayback, true);
    updateDom();
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "GAME_AUDIO_READY" },
        window.location.origin,
      );
    return () => {
      unsubscribe();
      unsubscribeMix();
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      soundtrack.dispose();
      window.speechSynthesis?.cancel();
      window.removeEventListener("GAME_CONTENT_READY", ready);
      window.removeEventListener("message", message);
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("keydown", gesture);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("fullscreenchange", updateDom);
      document.removeEventListener("webkitfullscreenchange", updateDom);
      document.removeEventListener("play", silenceMedia, true);
      document.removeEventListener("volumechange", silenceMedia, true);
      document.removeEventListener("play", reportPlayback, true);
      document.removeEventListener("pause", reportPlayback, true);
      document.removeEventListener("ended", reportPlayback, true);
      mediaMute.dispose();
      mediaGain.dispose();
      setSessionMix({ active: false });
    };
  }, [music]);

  if (!portalTarget || live || controlled) return null;
  return createPortal(
    <div
      className="fixed bottom-4 left-4 z-[10020]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <GameAudioControls
        settings={settings}
        onChange={(next) => setGameAudioSettings(next, true)}
      />
    </div>,
    portalTarget,
  );
}
