import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Info, Loader2, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import FullscreenToggle from "@/components/FullscreenToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { ActivityRow } from "@/lib/laravel-api";
import { storyGamePath } from "./story-sequence";
import StoryNavigation, { storyStepPresentation } from "./StoryNavigation";

type Props = { story: ActivityRow; inSession: boolean; sessionRole: "admin" | "user" | ""; sessionStep: number | null };

export default function StoryView({ story, inSession, sessionRole, sessionStep }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [index, setIndex] = useState(sessionStep ?? 0);
  const [round, setRound] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [loadedKey, setLoadedKey] = useState("");
  const [failedKey, setFailedKey] = useState("");
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef(false);
  const videoTimerRef = useRef<number>();
  const lastVideoSyncRef = useRef(0);
  const steps = story.story_steps ?? [];
  const activeIndex = inSession && sessionStep !== null ? sessionStep : index;
  const step = steps[activeIndex];
  const media = useMemo(() => step?.type === "media" ? story.media.find(item => item.id === step.media_id) : null, [step, story.media]);
  const current = storyStepPresentation(story, activeIndex);
  const contentKey = `${story.id}:${activeIndex}:${round}`;
  const failed = failedKey === contentKey || (step?.type === "media" && !media);
  const loading = !!step && !failed && loadedKey !== contentKey;

  useEffect(() => {
    if (!inSession || sessionRole !== "user") return;
    document.documentElement.classList.add("fs-lock", "fs-mode");
    return () => document.documentElement.classList.remove("fs-lock", "fs-mode");
  }, [inSession, sessionRole]);

  useEffect(() => {
    if (inSession) return;
    const player = playerRef.current;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !player?.classList.contains("is-pseudo-fullscreen")) {
        document.documentElement.classList.remove("fs-lock", "fs-mode");
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (player?.classList.contains("is-pseudo-fullscreen")) document.documentElement.classList.remove("fs-lock", "fs-mode");
    };
  }, [inSession]);

  useEffect(() => {
    if (!inSession) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== "SESSION_GAME_EVENT" || event.data?.event?.game !== "story_video") return;
      const video = videoRef.current;
      if (!video) return;
      const message = event.data.event;
      remoteVideoRef.current = true;
      if (Math.abs(video.currentTime - Number(message.time || 0)) > 0.6) video.currentTime = Number(message.time || 0);
      if (message.action === "play") void video.play().catch(() => {});
      if (message.action === "pause") video.pause();
      window.clearTimeout(videoTimerRef.current);
      videoTimerRef.current = window.setTimeout(() => { remoteVideoRef.current = false; }, 100);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(videoTimerRef.current);
      remoteVideoRef.current = false;
    };
  }, [inSession, activeIndex]);

  const change = useCallback((next: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, next));
    if (target === activeIndex) return;
    setDirection(target < activeIndex ? "back" : "forward");
    setIndex(target);
    setRound(0);
  }, [activeIndex, steps.length]);

  useEffect(() => {
    if (inSession) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, video, [contenteditable=true], [role=dialog]")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      change(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inSession, activeIndex, change]);

  useEffect(() => {
    const next = steps[activeIndex + 1];
    const nextMedia = next?.type === "media" ? story.media.find(item => item.id === next.media_id) : null;
    if (nextMedia && nextMedia.media_type !== "video") {
      const image = new Image();
      image.src = normalizeMediaUrl(nextMedia.url);
    }
  }, [activeIndex, steps, story.media]);

  const videoEvent = (action: "play" | "pause" | "seek") => {
    if (!inSession || remoteVideoRef.current || !videoRef.current || sessionRole !== "admin") return;
    window.parent.postMessage({ type: "SESSION_GAME_EVENT", event: {
      game: "story_video", action, time: videoRef.current.currentTime,
    } }, window.location.origin);
  };
  const replay = () => setRound(value => value + 1);
  const gameSrc = step?.type === "game" ? `${storyGamePath(step.game_type, step.game_id)}?session=1&session_role=${user?.role === "user" ? "user" : "admin"}&story_preview=1&story_id=${story.id}&session_seed=${activeIndex * 1000 + round}` : null;

  return <div className={inSession ? "story-embedded" : "story-page"}>
    {!inSession && <header className="story-page-header"><div className="story-page-heading">
      <button type="button" className="story-icon-button story-back" title="Voltar" aria-label="Voltar" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
      <span className="story-heading-mark"><BookOpen size={23} strokeWidth={1.6} /></span>
      <div className="story-page-heading-copy"><p>HISTÓRIAS COMPLETAS</p><h1>{story.title}</h1></div>
      {user?.role !== "user" && story.description && <Popover><PopoverTrigger asChild><button type="button" className="story-icon-button" title="Objetivo clínico" aria-label="Objetivo clínico"><Info size={19} /></button></PopoverTrigger><PopoverContent className="story-objective" align="end"><strong>Objetivo clínico</strong>{story.description}</PopoverContent></Popover>}
    </div></header>}
    <main className={inSession ? "h-full" : "story-page-main"}>
      <div ref={playerRef} className="story-player" data-kind={current.kind}>
        <div className="story-stage" aria-busy={loading}>
          <div key={contentKey} className={`story-stage-content${!loading && !failed ? " story-frame-enter" : ""}`} data-story-direction={direction}>
            {step?.type === "media" && media && (media.media_type === "video" ? <video ref={videoRef} src={normalizeMediaUrl(media.url)} poster={media.thumbnail_url ? normalizeMediaUrl(media.thumbnail_url) : undefined} controls playsInline preload="metadata" onLoadedMetadata={() => setLoadedKey(contentKey)} onError={() => setFailedKey(contentKey)} onPlay={() => videoEvent("play")} onPause={() => videoEvent("pause")} onSeeked={() => videoEvent("seek")} onTimeUpdate={() => {
              if (sessionRole !== "admin" || !inSession || !videoRef.current || videoRef.current.paused) return;
              if (Date.now() - lastVideoSyncRef.current < 5000) return;
              lastVideoSyncRef.current = Date.now();
              videoEvent("play");
            }} /> : <img src={normalizeMediaUrl(media.url)} alt={inSession && sessionRole === "user" ? "Imagem da atividade" : media.caption || "Imagem da história"} onLoad={() => setLoadedKey(contentKey)} onError={() => setFailedKey(contentKey)} />)}
            {gameSrc && <iframe title="Jogo da história" src={gameSrc} allow="autoplay; fullscreen" onLoad={() => setLoadedKey(contentKey)} onError={() => setFailedKey(contentKey)} />}
          </div>
          {loading && <div className="story-stage-status" role="status"><Loader2 className="story-loader" size={28} />Carregando etapa...</div>}
          {failed && <div className="story-stage-status story-stage-status--error" role="alert"><Info size={28} /><span>Não foi possível carregar esta etapa.</span><button className="story-icon-button" type="button" title="Tentar novamente" aria-label="Tentar novamente" onClick={replay}><RotateCcw size={20} /></button></div>}
          {!step && <div className="story-stage-status"><BookOpen size={32} />História sem etapas.</div>}
        </div>
        {!inSession && <StoryNavigation story={story} index={activeIndex} onSelect={change} onReplay={replay} tools={<FullscreenToggle targetRef={playerRef} className="story-fullscreen" />} />}
      </div>
    </main>
  </div>;
}
