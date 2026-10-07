import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { ActivityRow } from "@/lib/laravel-api";
import { storyGamePath } from "./story-sequence";

type Props = { story: ActivityRow; inSession: boolean; sessionRole: "admin" | "user" | ""; sessionStep: number | null };

export default function StoryView({ story, inSession, sessionRole, sessionStep }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [index, setIndex] = useState(sessionStep ?? 0);
  const [round, setRound] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef(false);
  const lastVideoSyncRef = useRef(0);
  const steps = story.story_steps ?? [];
  const activeIndex = inSession && sessionStep !== null ? sessionStep : index;
  const step = steps[activeIndex];
  const media = useMemo(() => step?.type === "media" ? story.media.find((item) => item.id === step.media_id) : null, [step, story.media]);

  useEffect(() => {
    if (!inSession || sessionRole !== "user") return;
    document.documentElement.classList.add("fs-lock", "fs-mode");
    return () => document.documentElement.classList.remove("fs-lock", "fs-mode");
  }, [inSession, sessionRole]);

  useEffect(() => {
    if (!inSession) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "SESSION_GAME_EVENT" || event.data?.event?.game !== "story_video") return;
      const video = videoRef.current;
      if (!video) return;
      const message = event.data.event;
      remoteVideoRef.current = true;
      if (Math.abs(video.currentTime - Number(message.time || 0)) > 0.6) video.currentTime = Number(message.time || 0);
      if (message.action === "play") void video.play().catch(() => {});
      if (message.action === "pause") video.pause();
      window.setTimeout(() => { remoteVideoRef.current = false; }, 100);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [inSession, activeIndex]);

  const videoEvent = (action: "play" | "pause" | "seek") => {
    if (!inSession || remoteVideoRef.current || !videoRef.current) return;
    if (sessionRole !== "admin") return;
    window.parent.postMessage({ type: "SESSION_GAME_EVENT", event: {
      game: "story_video", action, time: videoRef.current.currentTime,
    } }, window.location.origin);
  };

  const change = (next: number) => { setIndex(Math.max(0, Math.min(steps.length - 1, next))); setRound(0); };
  const gameSrc = step?.type === "game" ? `${storyGamePath(step.game_type, step.game_id)}?session=1&session_role=${user?.role === "user" ? "user" : "admin"}&story_preview=1&story_id=${story.id}&session_seed=${activeIndex * 1000 + round}` : null;

  return <div className={inSession ? "h-[100svh] w-full bg-white" : "min-h-[100svh] bg-background"}>
    {!inSession && <header className="border-b border-border bg-background"><div className="container flex h-16 items-center gap-3 px-4">
      <Button variant="ghost" size="icon" title="Voltar" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
      <div className="min-w-0"><h1 className="truncate text-base font-semibold">{story.title}</h1><p className="text-xs text-muted-foreground">{steps.length} etapas</p></div>
    </div></header>}
    <main className={inSession ? "h-full" : "container max-w-6xl px-4 py-5 sm:py-8"}>
      {!inSession && user?.role !== "user" ? <p className="mb-4 text-sm text-muted-foreground">{story.description}</p> : null}
      <div className={inSession ? "h-full w-full bg-white" : "relative aspect-video min-h-[60svh] max-h-[75svh] w-full overflow-hidden rounded-md border border-border bg-white sm:min-h-[420px]"}>
        {!step ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">História sem etapas.</div> :
        step.type === "media" ? media?.media_type === "video" ? <video key={`${activeIndex}-${media.id}`} ref={videoRef} src={normalizeMediaUrl(media.url)} controls playsInline className="h-full w-full object-contain" onPlay={() => videoEvent("play")} onPause={() => videoEvent("pause")} onSeeked={() => videoEvent("seek")} onTimeUpdate={() => {
          if (sessionRole !== "admin" || !inSession || !videoRef.current || videoRef.current.paused) return;
          if (Date.now() - lastVideoSyncRef.current < 5000) return;
          lastVideoSyncRef.current = Date.now();
          videoEvent("play");
        }} />
          : media ? <img src={normalizeMediaUrl(media.url)} alt={inSession && sessionRole === "user" ? "Imagem da atividade" : media.caption || "Imagem da história"} className="h-full w-full object-contain" />
          : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Esta mídia não está disponível.</div>
        : <iframe key={`${activeIndex}-${round}`} title="Jogo da história" src={gameSrc || undefined} className="h-full w-full border-0" allow="autoplay" />}
      </div>
      {!inSession && steps.length > 0 ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">Etapa {activeIndex + 1} de {steps.length}</span>
        <div className="flex gap-2">
          {step?.type === "game" ? <Button variant="outline" size="icon" title="Recomeçar jogo" onClick={() => setRound((value) => value + 1)}><RotateCcw className="h-4 w-4" /></Button> : null}
          <Button variant="outline" size="icon" title="Etapa anterior" disabled={activeIndex === 0} onClick={() => change(activeIndex - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" title="Próxima etapa" disabled={activeIndex === steps.length - 1} onClick={() => change(activeIndex + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div> : null}
    </main>
  </div>;
}
