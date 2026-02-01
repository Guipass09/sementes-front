import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, RotateCcw, Play, Pause, Check, X } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { GuessImageGameRow } from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type Role = "admin" | "user";

// Grid size for revealing tiles - more tiles = smaller pieces = harder to guess
const GRID_COLS = 12;
const GRID_ROWS = 10;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;
const REVEAL_INTERVAL = 350; // ms between revealing each tile (slower = more suspense)

type GameState = "idle" | "revealing" | "choosing" | "correct" | "wrong";

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function GuessImageGameView() {
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
  const [game, setGame] = useState<GuessImageGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // Game state
  const [idx, setIdx] = useState(0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [tileOrder, setTileOrder] = useState<number[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [lock, setLock] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [optionOrder, setOptionOrder] = useState<boolean[]>([true, false]); // true = correct first
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch game data
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
            ? await api.adminGetGuessImageGame(gameId)
            : user.role === "professional"
              ? await api.professionalGetGuessImageGame(gameId)
              : await api.userGetGuessImageGame(gameId, inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(g);
        setIdx(0);
        resetTiles();
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

  const current = useMemo(() => {
    if (!game?.items?.length) return null;
    const sorted = [...game.items].sort((a, b) => a.position - b.position);
    return sorted[idx] ?? null;
  }, [game, idx]);

  const finished = !!game && idx >= (game.items?.length ?? 0);

  const resetTiles = useCallback(() => {
    const allTiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);
    setTileOrder(shuffleArray(allTiles));
    setRevealedTiles(new Set());
    setRevealIndex(0);
    setGameState("idle");
    // Randomize option order
    setOptionOrder(Math.random() > 0.5 ? [true, false] : [false, true]);
  }, []);

  // Reset when session changes
  useEffect(() => {
    resetTiles();
  }, [idx, resetTiles]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const emitSessionEvent = (event: any) => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
      }
    } catch {}
  };

  // Start revealing tiles
  const startRevealing = useCallback(() => {
    setGameState("revealing");
    if (inSession) emitSessionEvent({ kind: "start", index: idx });
    
    intervalRef.current = setInterval(() => {
      setRevealIndex((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_TILES) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setGameState("choosing");
          return prev;
        }
        return next;
      });
    }, REVEAL_INTERVAL);
  }, [inSession, idx]);

  // Update revealed tiles when revealIndex changes
  useEffect(() => {
    const newRevealed = new Set(tileOrder.slice(0, revealIndex));
    setRevealedTiles(newRevealed);
  }, [revealIndex, tileOrder]);

  // Pause revealing
  const pauseRevealing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameState("choosing");
    if (inSession) emitSessionEvent({ kind: "pause", index: idx });
  }, [inSession, idx]);

  // Reset current session
  const doReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIdx(0);
    resetTiles();
    setLock(false);
    setCelebrate(false);
    if (inSession && sessionRole === "admin") emitSessionEvent({ kind: "reset" });
  }, [inSession, sessionRole, resetTiles]);

  // Handle option selection
  const pick = useCallback((isCorrect: boolean) => {
    if (!game || !current) return;
    if (lock) return;
    if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;

    if (isCorrect) playCorrect();
    else playWrong();

    if (inSession) emitSessionEvent({ kind: "answer", index: idx, correct: isCorrect });

    if (isCorrect) {
      setGameState("correct");
      setLock(true);
      const nextIdx = idx + 1;
      const isLastItem = nextIdx >= (game.items?.length ?? 0);
      window.setTimeout(() => {
        if (isLastItem) {
          setCelebrate(true);
          setIdx(nextIdx);
        } else {
          setIdx(nextIdx);
        }
        setLock(false);
      }, 1000);
    } else {
      setGameState("wrong");
      window.setTimeout(() => {
        setGameState("choosing");
      }, 1000);
    }
  }, [game, current, lock, inSession, sessionRole, idx]);

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
        if (evt.kind === "congrats_close") {
          setCelebrate(false);
          return;
        }
        if (evt.kind === "reset") {
          doReset();
          return;
        }
        if (evt.kind === "start" && typeof evt.index === "number") {
          setIdx(evt.index);
          startRevealing();
          return;
        }
        if (evt.kind === "pause") {
          pauseRevealing();
          return;
        }
        if (evt.kind === "answer" && typeof evt.correct === "boolean") {
          pick(evt.correct);
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
  }, [inSession, sessionRole, doReset, startRevealing, pauseRevealing, pick]);

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(false), 2500);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  // Render tile grid overlay
  const renderTileGrid = () => {
    const tiles = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col;
        const isRevealed = revealedTiles.has(index);
        tiles.push(
          <div
            key={index}
            className={cn(
              "absolute transition-all duration-500",
              isRevealed ? "opacity-0 scale-0" : "opacity-100 scale-100"
            )}
            style={{
              left: `${(col / GRID_COLS) * 100}%`,
              top: `${(row / GRID_ROWS) * 100}%`,
              width: `${100 / GRID_COLS}%`,
              height: `${100 / GRID_ROWS}%`,
              backdropFilter: isRevealed ? "none" : "blur(30px)",
              backgroundColor: isRevealed ? "transparent" : "rgba(120,120,120,0.85)",
            }}
          />
        );
      }
    }
    return tiles;
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
                    <div className="mt-1 text-sm text-muted-foreground">
                      Sessão {Math.min(idx + 1, game.items?.length ?? 0)} de {game.items?.length ?? 0}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(!inSession || sessionRole === "admin") && (
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

              <div ref={bodyRef} className="p-2 sm:p-4 lg:p-6 flex-1 fs-fit flex flex-col items-center gap-4">
                {loading ? (
                  <Skeleton className="h-[60vh] w-full rounded-2xl" />
                ) : game && current && !finished ? (
                  <>
                    {/* Main image with tile overlay */}
                    <div className="relative w-full h-[40vh] sm:h-[45vh] lg:h-[50vh] rounded-xl sm:rounded-2xl overflow-hidden border border-border bg-muted/30">
                      <img
                        src={normalizeMediaUrl(current.main_url)}
                        alt="Imagem principal"
                        className="w-full h-full object-cover"
                      />
                      {/* Tile grid overlay */}
                      <div className="absolute inset-0">
                        {renderTileGrid()}
                      </div>

                      {/* Correct feedback overlay */}
                      {gameState === "correct" && (
                        <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                          <div className="bg-green-500 text-white rounded-full p-4 sm:p-6">
                            <Check className="h-10 w-10 sm:h-16 sm:w-16" />
                          </div>
                        </div>
                      )}

                      {/* Wrong feedback overlay */}
                      {gameState === "wrong" && (
                        <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                          <div className="bg-red-500 text-white rounded-full p-4 sm:p-6 animate-[shake_0.35s_ease-in-out_0s_2]">
                            <X className="h-10 w-10 sm:h-16 sm:w-16" />
                          </div>
                        </div>
                      )}

                      {/* Progress indicator */}
                      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between text-white/90 text-xs sm:text-sm bg-black/40 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                        <div className="inline-flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                          <span className="font-semibold">Acerte a Imagem</span>
                        </div>
                        <div className="tabular-nums shrink-0 ml-2">
                          {idx + 1}/{game.items?.length ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center gap-3">
                      {gameState === "idle" && (!inSession || sessionRole === "admin") && (
                        <Button
                          size="lg"
                          onClick={startRevealing}
                          className="bg-pink-500 hover:bg-pink-600 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
                        >
                          <Play className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                          Iniciar
                        </Button>
                      )}

                      {gameState === "revealing" && (!inSession || sessionRole === "admin") && (
                        <Button
                          size="lg"
                          onClick={pauseRevealing}
                          variant="destructive"
                          className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
                        >
                          <Pause className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                          Pare!
                        </Button>
                      )}
                    </div>

                    {/* Options - show when paused or choosing */}
                    {(gameState === "choosing" || gameState === "wrong" || gameState === "correct") && (
                      <div className="w-full">
                        <p className="text-center text-sm sm:text-base font-semibold mb-3">Qual é a imagem correta?</p>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
                          {optionOrder.map((isCorrect, i) => (
                            <button
                              key={i}
                              onClick={() => pick(isCorrect)}
                              disabled={lock || gameState === "wrong" || gameState === "correct"}
                              className={cn(
                                "relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden border-4 transition-all duration-200",
                                "hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-pink-500/50",
                                lock || gameState === "wrong" || gameState === "correct" ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
                                "border-transparent hover:border-pink-500",
                                gameState === "correct" && isCorrect && "border-green-500 ring-2 ring-green-500",
                                gameState === "wrong" && !isCorrect && "border-red-500 ring-2 ring-red-500"
                              )}
                            >
                              <img
                                src={normalizeMediaUrl(isCorrect ? current.correct_url : current.wrong_url)}
                                alt={`Opção ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Celebration modal */}
      <BrandedCongratsDialog
        open={celebrate}
        onOpenChange={(open) => {
          setCelebrate(open);
          if (!open && inSession && sessionRole === "admin" && !applyingRemoteRef.current) {
            emitSessionEvent({ game: "guess_image", kind: "congrats_close" });
          }
        }}
        title="Parabéns!"
        description="Você concluiu o jogo."
        primaryLabel="Fechar"
      >
        <div className="relative h-10">
          <div className="mg-aud-celebrate pointer-events-none">
            <span className="mg-aud-confetti" />
            <span className="mg-aud-confetti" />
            <span className="mg-aud-confetti" />
          </div>
        </div>
      </BrandedCongratsDialog>
    </div>
  );
}
