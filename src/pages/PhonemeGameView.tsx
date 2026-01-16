import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, Volume2, RotateCcw } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { PhonemeGameRow } from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";

type Role = "admin" | "user";

function speakWord(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = 1;
    s.speak(u);
  } catch {
    // ignore
  }
}

export default function PhonemeGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as Role | "";
  const sessionId = useMemo(() => {
    const n = Number(sessionParams.get("session_id"));
    return Number.isFinite(n) ? n : null;
  }, [sessionParams]);

  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<PhonemeGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [idx, setIdx] = useState(0);
  const [shakeSide, setShakeSide] = useState<null | "left" | "right">(null);
  const [flashSide, setFlashSide] = useState<null | "left" | "right">(null);
  const [lock, setLock] = useState(false);

  const fsRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const autoPseudoFullscreen = inSession && sessionRole === "user";

  useEffect(() => {
    if (!authLoading && !user) navigate("/entrar");
  }, [authLoading, user, navigate]);

  // Sessão ao vivo (usuário): pseudo fullscreen automático
  useEffect(() => {
    if (!autoPseudoFullscreen) return;
    const el = fsRef.current;
    if (!el) return;
    el.classList.add("is-pseudo-fullscreen");
    document.documentElement.classList.add("fs-lock");
    document.documentElement.classList.add("fs-mode");
    return () => {
      el.classList.remove("is-pseudo-fullscreen");
      document.documentElement.classList.remove("fs-lock");
      document.documentElement.classList.remove("fs-mode");
    };
  }, [autoPseudoFullscreen]);

  useEffect(() => {
    if (!user) return;
    if (!gameId) {
      setNotFound(true);
      setForbidden(false);
      setGame(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      try {
        const g =
          user.role === "admin"
            ? await api.adminGetPhonemeGame(gameId)
            : await api.userGetPhonemeGame(gameId, inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(g);
        setIdx(0);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        }
        setGame(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, user, navigate, inSession, sessionId]);

  const emitSessionEvent = (event: any) => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
      }
    } catch {}
  };

  // Sessão: recebe controle e eventos
  useEffect(() => {
    if (!inSession) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data: any = ev.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "SESSION_UNLOCK_SFX") {
        void unlockSfx();
        return;
      }
      if (data.type === "SESSION_CONTROL") {
        const granted = !!data.granted;
        controlAllowedRef.current = sessionRole === "admin" ? true : granted;
        return;
      }
      if (data.type !== "SESSION_GAME_EVENT") return;
      const evt = data.event;
      if (!evt || typeof evt !== "object") return;

      applyingRemoteRef.current = true;
      try {
        if (evt.kind === "reset") {
          setIdx(0);
          setShakeSide(null);
          setFlashSide(null);
          setLock(false);
          return;
        }
        if (evt.kind === "speak" && typeof evt.index === "number") {
          const g = game;
          const i = evt.index;
          if (!g || !g.items?.[i]) return;
          speakWord(g.items[i].word);
          return;
        }
        if (evt.kind === "answer" && typeof evt.index === "number" && (evt.side === "left" || evt.side === "right")) {
          const g = game;
          if (!g) return;
          const i = evt.index;
          const it = g.items?.[i];
          if (!it) return;
          const correct = it.correct_side === evt.side;
          setFlashSide(evt.side);
          setShakeSide(correct ? null : evt.side);
          if (correct) {
            setLock(true);
            window.setTimeout(() => {
              setFlashSide(null);
              setShakeSide(null);
              setIdx((prev) => Math.min(prev + 1, (g.items?.length ?? 1) - 1));
              setLock(false);
            }, 650);
          } else {
            window.setTimeout(() => {
              setFlashSide(null);
              setShakeSide(null);
            }, 650);
          }
          return;
        }
      } finally {
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole, game]);

  const current = game?.items?.[idx] ?? null;
  const finished = !!game && idx >= (game.items?.length ?? 0) - 1 && false;

  const doReset = () => {
    setIdx(0);
    setShakeSide(null);
    setFlashSide(null);
    setLock(false);
    if (inSession && sessionRole === "admin") emitSessionEvent({ kind: "reset" });
  };

  const doSpeak = () => {
    if (!current?.word) return;
    speakWord(current.word);
    if (inSession) emitSessionEvent({ kind: "speak", index: idx });
  };

  const pick = (side: "left" | "right") => {
    if (!game || !current) return;
    if (lock) return;
    if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;

    const correct = current.correct_side === side;
    if (correct) playCorrect();
    else playWrong();

    setFlashSide(side);
    setShakeSide(correct ? null : side);

    if (inSession) emitSessionEvent({ kind: "answer", index: idx, side });

    if (correct) {
      setLock(true);
      window.setTimeout(() => {
        setFlashSide(null);
        setShakeSide(null);
        setIdx((p) => Math.min(p + 1, (game.items?.length ?? 1) - 1));
        setLock(false);
      }, 650);
    } else {
      window.setTimeout(() => {
        setFlashSide(null);
        setShakeSide(null);
      }, 650);
    }
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
                  <span className="text-brand-green">Sementes</span> <span className="text-brand-brown">da Fala</span>
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="relative">
        <div className={cn("container mx-auto px-4 py-6 lg:py-8", inSession && "px-0 py-0")}>
          <div className="max-w-6xl mx-auto">
            <div ref={fsRef} className="fs-target rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
              <div ref={headerRef} className="px-6 sm:px-10 pt-7 sm:pt-9 pb-5 border-b border-border/60">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : game ? (
                  <div className="flex flex-col gap-2">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">{game.title}</h1>
                    <p className="fs-hide-in-fs text-muted-foreground leading-relaxed">{game.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {( !inSession || sessionRole === "admin") && (
                        <Button variant="secondary" onClick={doReset}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reiniciar
                        </Button>
                      )}
                      <FullscreenToggle targetRef={fsRef} className="ml-auto" mode={inSession ? "pseudo" : "auto"} />
                    </div>
                  </div>
                ) : notFound ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Jogo não encontrado</h1>
                    <p className="text-muted-foreground">Esse jogo não existe (ou foi removido).</p>
                  </div>
                ) : forbidden ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Acesso negado</h1>
                    <p className="text-muted-foreground">Você não tem permissão para acessar este jogo.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Não foi possível carregar</h1>
                    <p className="text-muted-foreground">Tente novamente em alguns instantes.</p>
                  </div>
                )}
              </div>

              <div ref={bodyRef} className="p-3 sm:p-6 lg:p-10 flex-1 fs-fit">
                {loading ? (
                  <Skeleton className="h-[60vh] w-full rounded-2xl" />
                ) : game && current ? (
                  <div className="relative w-full h-full min-h-[50vh] rounded-2xl overflow-hidden border border-border bg-black">
                    <img src={current ? game.background_url : ""} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95" />
                    <div className="absolute inset-0 bg-black/25" />

                    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-center">
                      <Button type="button" onClick={doSpeak} className="rounded-full bg-white/90 text-foreground hover:bg-white">
                        <Volume2 className="h-4 w-4 mr-2" />
                        Ouvir palavra
                      </Button>
                    </div>

                    <div className="absolute inset-0 pt-16 pb-4 px-4 flex items-center justify-center">
                      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => pick("left")}
                          disabled={lock}
                          className={cn(
                            "relative rounded-2xl overflow-hidden border bg-black/30 aspect-[4/3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            flashSide === "left" ? "ring-4 ring-brand-green" : "",
                            shakeSide === "left" ? "animate-[shake_0.35s_ease-in-out_0s_2]" : "",
                          )}
                        >
                          <img src={current.left_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {flashSide === "left" && (
                            <div className={cn("absolute inset-0", current.correct_side === "left" ? "bg-brand-green/30" : "bg-red-500/30")} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => pick("right")}
                          disabled={lock}
                          className={cn(
                            "relative rounded-2xl overflow-hidden border bg-black/30 aspect-[4/3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            flashSide === "right" ? "ring-4 ring-brand-green" : "",
                            shakeSide === "right" ? "animate-[shake_0.35s_ease-in-out_0s_2]" : "",
                          )}
                        >
                          <img src={current.right_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {flashSide === "right" && (
                            <div className={cn("absolute inset-0", current.correct_side === "right" ? "bg-brand-green/30" : "bg-red-500/30")} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-white/90 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4" />
                        <span className="font-semibold">{current.word}</span>
                      </div>
                      <div className="tabular-nums">
                        {idx + 1}/{game.items.length}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

