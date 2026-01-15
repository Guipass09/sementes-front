import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Play,
  Sparkles,
  Tag,
  Timer,
  Trophy,
} from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityMediaRow, ActivityRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { useToast } from "@/hooks/use-toast";
import { emitUserProgressChanged } from "@/lib/user-events";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import { playCorrect, playWrong } from "@/lib/sfx";
import FullscreenToggle from "@/components/FullscreenToggle";

const ActivityView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as "admin" | "user" | "";
  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const emitSessionEvent = (event: any) => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    if (sessionRole === "user" && !controlAllowedRef.current) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
      }
    } catch {
      // ignore
    }
  };

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(1);
  const [count, setCount] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const saveTimerRef = useMemo(() => ({ t: 0 as any }), []);
  const [finishing, setFinishing] = useState(false);
  const [stepConfirmOpen, setStepConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishCongratsOpen, setFinishCongratsOpen] = useState(false);
  const [pendingStep, setPendingStep] = useState<null | { stepIdx: number; isLast: boolean }>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);

  const activityId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/entrar");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    if (!activityId) {
      setNotFound(true);
      setForbidden(false);
      setActivity(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      try {
        const a = user.role === "admin" ? await api.adminGetActivity(activityId) : await api.userGetActivity(activityId);
        if (cancelled) return;
        setActivity(a);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        }
        setActivity(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId, user, navigate]);

  const orderedMedia = useMemo<ActivityMediaRow[]>(() => {
    const list = activity?.media ?? [];
    return [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [activity?.media]);

  useEffect(() => {
    if (!carouselApi) return;
    const update = () => {
      setCount(carouselApi.scrollSnapList().length);
      setCurrent(carouselApi.selectedScrollSnap() + 1);
      setCanPrev(carouselApi.canScrollPrev());
      setCanNext(carouselApi.canScrollNext());

      if (inSession && !applyingRemoteRef.current) {
        emitSessionEvent({
          game: "activity",
          kind: "slide",
          idx: carouselApi.selectedScrollSnap(),
        });
      }
    };

    update();
    carouselApi.on("select", update);
    carouselApi.on("reInit", update);
    return () => {
      carouselApi.off("select", update);
    };
  }, [carouselApi]);

  // Inicializa/restaura progresso quando a atividade carregar
  useEffect(() => {
    if (!activity) return;
    if (inSession) {
      setCompletedSteps([]);
      return;
    }
    const p = activity.progress;
    if (p?.completed_steps?.length) {
      setCompletedSteps(Array.from(new Set(p.completed_steps)).sort((a, b) => a - b));
    } else {
      setCompletedSteps([]);
    }
  }, [activity?.id]);

  // Ao ter carouselApi e progresso, rola para o passo atual (restaura após refresh)
  useEffect(() => {
    if (!carouselApi) return;
    if (inSession) return;
    if (!activity?.progress) return;
    const idx = Math.max(0, Math.min(activity.progress.current_step ?? 0, (count || 1) - 1));
    // scrollTo só funciona bem após reInit
    carouselApi.scrollTo(idx, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselApi, activity?.id, count]);

  const persistProgress = async (nextStep?: number, nextCompleted?: number[]) => {
    if (!activityId) return;
    if (inSession) return;
    if (!user || user.role !== "user") return; // progresso é do usuário
    // debounce simples
    if (saveTimerRef.t) window.clearTimeout(saveTimerRef.t);
    const currentStepIdx = typeof nextStep === "number" ? nextStep : Math.max(0, current - 1);
    const completed = (nextCompleted ?? completedSteps).slice();
    saveTimerRef.t = window.setTimeout(async () => {
      try {
        await api.userUpdateActivityProgress(activityId, {
          current_step: currentStepIdx,
          completed_steps: completed,
        });
      } catch {
        // silencioso (não travar UX)
      }
    }, 400);
  };

  // Salva passo atual quando o usuário navega (inclui swipe e bolinhas)
  useEffect(() => {
    if (inSession) return;
    if (!activity || !user || user.role !== "user") return;
    void persistProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, activity?.id]);

  // Sessão ao vivo: sincroniza completedSteps
  useEffect(() => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    emitSessionEvent({ game: "activity", kind: "completed", steps: completedSteps });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps, inSession]);

  // Sessão ao vivo: recebe controle e eventos (slide/completed)
  useEffect(() => {
    if (!inSession) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data: any = ev.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "SESSION_CONTROL") {
        const granted = !!data.granted;
        controlAllowedRef.current = sessionRole === "admin" ? true : granted;
        return;
      }

      if (data.type !== "SESSION_GAME_EVENT") return;
      const evt = data.event;
      if (!evt || typeof evt !== "object") return;
      if (evt.game !== "activity") return;

      if (evt.kind === "slide") {
        const idx = Number(evt.idx);
        if (!carouselApi) return;
        if (!Number.isFinite(idx)) return;
        applyingRemoteRef.current = true;
        try {
          carouselApi.scrollTo(Math.max(0, idx), true);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
        return;
      }

      if (evt.kind === "completed") {
        const steps = Array.isArray(evt.steps) ? evt.steps.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)) : [];
        applyingRemoteRef.current = true;
        try {
          setCompletedSteps(Array.from(new Set(steps)).sort((a, b) => a - b));
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole, carouselApi]);

  const progress = useMemo(() => {
    if (!count) return 0;
    return Math.max(0, Math.min(100, Math.round((current / count) * 100)));
  }, [current, count]);

  const goTo = (idx: number) => {
    if (!carouselApi) return;
    carouselApi.scrollTo(idx);
  };

  const handleNext = async () => {
    if (!carouselApi) return;
    if (!activity) return;

    const stepIdx = Math.max(0, current - 1);
    const isLast = count > 0 && current === count;

    // Confirma conclusão da etapa atual antes de avançar (modal com logo)
    setPendingStep({ stepIdx, isLast });
    setStepConfirmOpen(true);
  };

  const handleFinishActivity = async () => {
    if (!activityId) return;
    if (!user || user.role !== "user") return;
    if (count <= 0) return;
    if (finishing) return;

    setFinishConfirmOpen(true);
  };

  return (
    <div className="min-h-[100svh] bg-transparent">

      {!inSession && (
        <header className="fs-hide-when-fullscreen sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              <div className="h-6 w-px bg-border hidden sm:block" />

              <div className="flex items-center gap-3 min-w-0">
                <img src={logoImage} alt="Sementes da Fala" className="w-9 h-9 rounded-lg object-contain bg-white/60" />
                <span className="hidden sm:block font-display font-bold text-base truncate">
                  <span className="text-brand-green">Sementes</span>{" "}
                  <span className="text-brand-brown">da Fala</span>
                </span>
              </div>
            </div>

            {/* Indicador estilo “1 de N” */}
            {count > 0 && (
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                <span className="font-semibold text-foreground">{current}</span> de {count}
              </div>
            )}
          </div>
        </header>
      )}

      <main className="relative">
        <div className={cn("container mx-auto px-4 py-8 lg:py-10", inSession && "px-0 py-0")}>
          <div className="max-w-5xl mx-auto">
            <div
              ref={fsRef}
              className="fs-target fs-allow-scroll relative rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col"
            >
              {/* botão pequeno dentro do conteúdo (canto superior direito) */}
              <FullscreenToggle targetRef={fsRef} className="absolute top-3 right-3 z-30" mode={inSession ? "pseudo" : "auto"} />
              {/* Cabeçalho interno */}
              <div className="px-6 sm:px-10 pt-7 sm:pt-10 pb-5 border-b border-border/60">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                    </div>
                  </div>
                ) : activity ? (
                  <div className="flex flex-col gap-3">
                    <div className="min-w-0">
                      <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                        {activity.title}
                      </h1>
                      <p className="text-muted-foreground mt-2 leading-relaxed">{activity.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge className="bg-brand-purple/90 text-white shadow-sm">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" /> Atividade
                        </span>
                      </Badge>
                      {activity.category && (
                        <Badge variant="secondary" className="gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          {activity.category}
                        </Badge>
                      )}
                      {activity.estimated_time && (
                        <Badge variant="secondary" className="gap-1">
                          <Timer className="h-3.5 w-3.5" />
                          {activity.estimated_time}
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-background/60">
                        {orderedMedia.length} item(ns)
                      </Badge>

                      {count > 0 && current === count && (
                        <Badge className="bg-brand-green text-white shadow-sm">
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="h-3.5 w-3.5" /> Último item
                          </span>
                        </Badge>
                      )}
                    </div>

                    {/* Progresso + bolinhas clicáveis (bem visível) */}
                    {count > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            Progresso: <span className="font-semibold text-foreground">{progress}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Etapa <span className="font-semibold text-foreground">{current}</span> de{" "}
                            <span className="font-semibold text-foreground">{count}</span>
                          </div>
                        </div>

                        <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden border border-border/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-blue via-brand-green to-brand-yellow transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {Array.from({ length: count }).map((_, idx) => {
                            const active = idx + 1 === current;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => goTo(idx)}
                                className={cn(
                                  "h-3 w-3 rounded-full border transition-all",
                                  active
                                    ? "bg-brand-green border-brand-green shadow-[0_0_0_3px_rgba(34,197,94,0.18)]"
                                    : "bg-background border-border hover:bg-muted",
                                )}
                                aria-label={`Ir para item ${idx + 1}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : notFound ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Atividade não encontrada</h1>
                    <p className="text-muted-foreground">
                      Parece que essa atividade não existe (ou foi removida). Volte e selecione outra.
                    </p>
                  </div>
                ) : forbidden ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Acesso negado</h1>
                    <p className="text-muted-foreground">Você não tem permissão para visualizar essa atividade.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Não foi possível carregar</h1>
                    <p className="text-muted-foreground">Tente novamente em alguns instantes.</p>
                  </div>
                )}
              </div>

              {/* Conteúdo/Carrossel */}
              <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
                {loading ? (
                  <div className="rounded-2xl border border-border bg-background/40 p-4 sm:p-6">
                    <Skeleton className="h-[48vh] sm:h-[56vh] w-full rounded-xl" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ) : activity && orderedMedia.length > 0 ? (
                  <div className="relative">
                    <Carousel
                      setApi={setCarouselApi}
                      opts={{
                        align: "start",
                        loop: false,
                      }}
                      className="w-full"
                    >
                      <CarouselContent className="-ml-4">
                        {orderedMedia.map((item) => (
                          <CarouselItem key={item.id} className="pl-4">
                            {/* Card “mais chamativo” */}
                            <div className="rounded-3xl border border-border bg-gradient-to-b from-background to-muted/30 shadow-sm overflow-hidden">
                              <div className="relative">
                                {/* Área principal (mídia) */}
                                <div className="h-[46vh] sm:h-[54vh] lg:h-[58vh] bg-muted/30 flex items-center justify-center">
                                  {item.media_type === "image" ? (
                                    <img
                                      src={normalizeMediaUrl(item.url)}
                                      alt={item.caption ?? activity.title}
                                      className="h-full w-full object-contain bg-white"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.src = "/placeholder.svg";
                                      }}
                                    />
                                  ) : item.media_type === "video" ? (
                                    <video
                                      src={normalizeMediaUrl(item.url)}
                                      poster={
                                        item.thumbnail_url
                                          ? normalizeMediaUrl(item.thumbnail_url)
                                          : activity.thumbnail?.media_type === "image"
                                            ? normalizeMediaUrl(activity.thumbnail.url)
                                            : undefined
                                      }
                                      className="h-full w-full object-contain bg-black"
                                      controls
                                      playsInline
                                      preload="metadata"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                                      <ImageIcon className="h-10 w-10 mb-2" />
                                      <div>Mídia indisponível</div>
                                    </div>
                                  )}
                                </div>

                                {/* Badge “tipo” */}
                                <div className="absolute top-3 left-3">
                                  <Badge
                                    className={cn(
                                      "shadow-sm",
                                      item.media_type === "video" ? "bg-brand-blue" : "bg-brand-green",
                                    )}
                                  >
                                    {item.media_type === "video" ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Play className="h-3.5 w-3.5" /> Vídeo
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1">
                                        <ImageIcon className="h-3.5 w-3.5" /> Imagem
                                      </span>
                                    )}
                                  </Badge>
                                </div>

                                {/* Faixa “Etapa” */}
                                {count > 0 && (
                                  <div className="absolute top-3 right-3">
                                    <Badge className="bg-background/90 text-foreground border border-border shadow-sm">
                                      Etapa {current} / {count}
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* Texto (caption) */}
                              <div className="px-5 sm:px-7 py-5">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                  Instrução
                                </div>
                                <div className="text-lg sm:text-xl font-display font-bold text-foreground leading-relaxed">
                                  {item.caption?.trim()
                                    ? item.caption
                                    : "Siga as orientações do(a) profissional e observe com atenção."}
                                </div>
                              </div>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>

                      {/* Setas */}
                      <CarouselPrevious
                        variant="secondary"
                        className="left-2 sm:left-3 md:-left-10 h-10 w-10 shadow-md bg-background/90"
                      />
                      <CarouselNext
                        variant="secondary"
                        className="right-2 sm:right-3 md:-right-10 h-10 w-10 shadow-md bg-background/90"
                      />
                    </Carousel>

                    {/* Navegação grande (mais acessível/chamativa) */}
                    <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => carouselApi?.scrollPrev()}
                        disabled={!canPrev}
                        className="sm:w-44 justify-center"
                      >
                        <ChevronLeft className="h-5 w-5 mr-2" />
                        Anterior
                      </Button>

                      <div className="text-center text-sm text-muted-foreground">
                        Use as setas, toque nas bolinhas ou deslize (swipe).
                      </div>

                      <Button
                        size="lg"
                        onClick={() => void handleNext()}
                        disabled={!canNext}
                        className="sm:w-44 justify-center bg-brand-green text-white hover:bg-brand-green/90"
                      >
                        Próximo
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </Button>
                    </div>

                    {/* Mensagem final */}
                    {count > 0 && current === count && (
                      <div className="mt-4 rounded-2xl border border-border bg-brand-green/10 px-4 py-3 text-sm">
                        <div className="font-semibold text-foreground inline-flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-brand-green" />
                          Você chegou ao final da atividade
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Se quiser, volte um item para revisar ou pressione “Voltar” para escolher outra atividade.
                        </div>
                        {user?.role === "user" && (
                          <div className="mt-3">
                            <Button
                              onClick={() => void handleFinishActivity()}
                              disabled={finishing}
                              className="w-full sm:w-auto bg-brand-green text-white hover:bg-brand-green/90"
                            >
                              {finishing ? "Confirmando..." : "Confirmar conclusão"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : activity ? (
                  <div className="rounded-2xl border border-border bg-background/40 p-8 text-center">
                    <div className="text-lg font-semibold text-foreground mb-2">Sem itens nesta atividade</div>
                    <div className="text-muted-foreground">Esta atividade ainda não possui imagens ou vídeos.</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: confirmar etapa (antes de ir para o próximo item) */}
      <BrandedConfirmDialog
        open={stepConfirmOpen}
        onOpenChange={(o) => {
          setStepConfirmOpen(o);
          if (!o) setPendingStep(null);
        }}
        title="Você concluiu esta etapa?"
        description="Se você confirmar, vamos marcar esta etapa como concluída no seu progresso."
        cancelLabel="Ainda não"
        confirmLabel="Sim, concluí"
        onCancel={() => {
          const p = pendingStep;
          if (!p || !carouselApi) return;
          void persistProgress(p.isLast ? p.stepIdx : p.stepIdx + 1, completedSteps).finally(() => {
            if (!p.isLast) carouselApi.scrollNext();
          });
        }}
        onConfirm={() => {
          const p = pendingStep;
          if (!p || !carouselApi) return;
          playCorrect();
          const nextCompleted = Array.from(new Set([...completedSteps, p.stepIdx])).sort((a, b) => a - b);
          setCompletedSteps(nextCompleted);
          void persistProgress(p.isLast ? p.stepIdx : p.stepIdx + 1, nextCompleted).finally(() => {
            if (!p.isLast) carouselApi.scrollNext();
          });
        }}
        variant="success"
      />

      {/* Modal: confirmar conclusão da atividade inteira */}
      <BrandedConfirmDialog
        open={finishConfirmOpen}
        onOpenChange={setFinishConfirmOpen}
        title="Confirmar conclusão da atividade?"
        description="Ao confirmar, vamos marcar todas as etapas como concluídas e atualizar seu progresso."
        cancelLabel="Voltar"
        confirmLabel={finishing ? "Confirmando..." : "Confirmar"}
        onConfirm={() => {
          if (!activityId) return;
          if (!user || user.role !== "user") return;
          if (count <= 0) return;
          if (finishing) return;
          setFinishing(true);
          (async () => {
            try {
              const all = Array.from({ length: count }).map((_, i) => i);
              setCompletedSteps(all);
              await api.userUpdateActivityProgress(activityId, {
                current_step: Math.max(0, count - 1),
                completed_steps: all,
              });
              emitUserProgressChanged();
              toast({
                title: "Atividade concluída!",
                description: "Seu progresso foi atualizado.",
              });
              setFinishCongratsOpen(true);
            } catch {
              playWrong();
              toast({
                title: "Erro",
                description: "Não foi possível confirmar a conclusão agora. Tente novamente.",
                variant: "destructive",
              });
            } finally {
              setFinishing(false);
            }
          })();
        }}
        variant="success"
      />

      {/* Modal: parabéns (atividade concluída) */}
      <BrandedCongratsDialog
        open={finishCongratsOpen}
        onOpenChange={setFinishCongratsOpen}
        title="Atividade concluída!"
        description="Parabéns — seu progresso foi salvo com sucesso."
        primaryLabel="Voltar"
        onPrimary={() => navigate(-1)}
      />
    </div>
  );
};

export default ActivityView;
