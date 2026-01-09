import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Grid3X3, Shuffle, RotateCcw, Sparkles, Trophy } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import type { MemoryGameRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { emitUserProgressChanged } from "@/lib/user-events";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong } from "@/lib/sfx";

type DeckCard = {
  instanceId: string;
  pairKey: number;
  imageUrl: string;
  flipped: boolean;
  matched: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcCols(totalCards: number, isSmall: boolean): number {
  // Mantém grid bonito e jogável até 30 cartas.
  if (isSmall) {
    if (totalCards <= 8) return 3;
    if (totalCards <= 12) return 4;
    if (totalCards <= 20) return 4;
    return 5;
  }
  if (totalCards <= 8) return 4;
  if (totalCards <= 12) return 4;
  if (totalCards <= 16) return 4;
  if (totalCards <= 20) return 5;
  if (totalCards <= 24) return 6;
  return 6;
}

function bestGridCols(params: { totalCards: number; w: number; h: number; gap: number; minCols: number; maxCols: number }) {
  const { totalCards, w, h, gap, minCols, maxCols } = params;
  let best = { cols: Math.max(minCols, 1), card: 0 };
  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.ceil(totalCards / cols);
    if (rows <= 0) continue;
    const cardW = (w - gap * (cols - 1)) / cols;
    const cardH = (h - gap * (rows - 1)) / rows;
    const card = Math.floor(Math.min(cardW, cardH));
    if (card > best.card) best = { cols, card };
  }
  return best;
}

export default function MemoryGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<MemoryGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [firstPick, setFirstPick] = useState<string | null>(null);
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);
  const [shuffleAnim, setShuffleAnim] = useState(false);
  const [winAnim, setWinAnim] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const deckRef = useRef<DeckCard[]>([]);
  const firstPickRef = useRef<string | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [fsActive, setFsActive] = useState(false);
  const [fsLayout, setFsLayout] = useState<null | { cols: number; card: number; gap: number }>(null);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const matchedCount = useMemo(() => deck.filter((c) => c.matched).length / 2, [deck]);
  const totalPairs = game?.pairs_count ?? 0;
  const finished = totalPairs > 0 && matchedCount === totalPairs;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/entrar");
    }
  }, [authLoading, user, navigate]);

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
        const g = user.role === "admin" ? await api.adminGetMemoryGame(gameId) : await api.userGetMemoryGame(gameId);
        if (cancelled) return;
        setGame(g);
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
  }, [gameId, user, navigate]);

  const makeFreshDeck = (g: MemoryGameRow): DeckCard[] => {
    // O backend já envia as cartas duplicadas (2 cartas por par),
    // então NÃO devemos duplicar aqui novamente.
    const base = [...(g.cards ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const deckCards: DeckCard[] = base.map((c, idx) => ({
      // ID estável (sem Math.random) para permitir restaurar progresso após refresh.
      instanceId: `${c.pair_key}-${c.id}-${idx}`,
      pairKey: c.pair_key,
      imageUrl: c.url,
      flipped: false,
      matched: false,
    }));
    return shuffle(deckCards);
  };

  const resetGame = () => {
    if (!game) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLock(false);
    setFirstPick(null);
    setMoves(0);
    setWinAnim(false);
    setDeck(makeFreshDeck(game));
  };

  const doShuffle = () => {
    // Embaralha (posições + números, porque número é o índice no deck)
    setShuffleAnim(true);
    resetGame();
    window.setTimeout(() => setShuffleAnim(false), 520);
  };

  useEffect(() => {
    if (!game) return;
    // Se houver progresso salvo, restaura; senão inicia novo.
    const restore = () => {
      const g = game;
      const total = (g.pairs_count ?? 0) * 2;
      const key = user?.role === "user" && user?.id ? `mg-progress:${user.id}:${g.id}` : null;

      const fromApi = (g as any).progress;
      const fromLocal = key ? (() => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } })() : null;
      const p = fromApi ?? fromLocal;

      if (p && Array.isArray(p.deck) && p.deck.length === total) {
        const nextDeck: DeckCard[] = p.deck
          .map((c: any) => ({
            instanceId: String(c.instanceId),
            pairKey: Number(c.pairKey),
            imageUrl: String(c.imageUrl),
            flipped: !!c.flipped,
            matched: !!c.matched,
          }))
          .filter((c: DeckCard) => c.instanceId && Number.isFinite(c.pairKey) && c.imageUrl);
        if (nextDeck.length === total) {
          setDeck(nextDeck);
          setFirstPick(typeof p.firstPick === "string" ? p.firstPick : null);
          setMoves(Number.isFinite(p.moves) ? Number(p.moves) : 0);
          setWinAnim(!!p.finished);
          setLock(false);
          return;
        }
      }

      // fallback: novo jogo
      setDeck(makeFreshDeck(g));
      setFirstPick(null);
      setMoves(0);
      setWinAnim(false);
      setLock(false);
    };

    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    firstPickRef.current = firstPick;
  }, [firstPick]);

  const onCardClick = (instanceId: string) => {
    if (lock) return;

    // Primeiro clique
    if (!firstPickRef.current) {
      setDeck((prev) => {
        const idx = prev.findIndex((c) => c.instanceId === instanceId);
        if (idx < 0) return prev;
        const c = prev[idx];
        if (c.matched || c.flipped) return prev;
        const copy = [...prev];
        copy[idx] = { ...c, flipped: true };
        return copy;
      });
      setFirstPick(instanceId);
      return;
    }

    // Segundo clique
    const firstId = firstPickRef.current;
    if (!firstId) return;
    if (firstId === instanceId) return;

    const snapshot = deckRef.current;
    const firstCard = snapshot.find((c) => c.instanceId === firstId);
    const secondCard = snapshot.find((c) => c.instanceId === instanceId);
    if (!firstCard || !secondCard) return;
    if (firstCard.matched || secondCard.matched) return;

    setMoves((m) => m + 1);
    setLock(true);

    const isMatch = firstCard.pairKey === secondCard.pairKey;
    if (isMatch) playCorrect();
    else playWrong();

    setDeck((prev) => {
      const aIdx = prev.findIndex((c) => c.instanceId === firstId);
      const bIdx = prev.findIndex((c) => c.instanceId === instanceId);
      if (aIdx < 0 || bIdx < 0) return prev;
      const a = prev[aIdx];
      const b = prev[bIdx];
      if (a.matched || b.matched) return prev;

      const next = [...prev];
      next[bIdx] = { ...b, flipped: true };

      if (isMatch) {
        return next.map((c) => (c.pairKey === a.pairKey ? { ...c, matched: true, flipped: true } : c));
      }
      return next;
    });

    if (isMatch) {
      // libera imediatamente
      setFirstPick(null);
      setLock(false);
      return;
    }

    // Não match: agenda virar as duas
    timeoutRef.current = window.setTimeout(() => {
      setDeck((p) =>
        p.map((c) =>
          c.instanceId === firstId || c.instanceId === instanceId ? { ...c, flipped: false } : c,
        ),
      );
      setFirstPick(null);
      setLock(false);
      timeoutRef.current = null;
    }, 750);
  };

  const totalCards = deck.length || (game?.pairs_count ? game.pairs_count * 2 : 0);
  const [viewportW, setViewportW] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isSmall = viewportW < 640; // mobile
  const isTablet = viewportW >= 640 && viewportW < 1024;
  const cols = useMemo(() => {
    // Ajuste fino: em telas menores, reduz colunas para manter cartas grandes e clicáveis.
    const base = calcCols(totalCards, isSmall);
    if (isSmall) return Math.min(base, 4);
    if (isTablet) return Math.min(base, 5);
    return base;
  }, [totalCards, isSmall, isTablet]);

  // Detecta se o container do jogo está em fullscreen (nativo ou pseudo)
  useEffect(() => {
    const el = fsRef.current;
    if (!el) return;

    const update = () => {
      const doc: any = document;
      const nativeEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
      const active = nativeEl === el || el.classList.contains("is-pseudo-fullscreen");
      setFsActive(active);
    };

    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange" as any, update);

    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });

    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange" as any, update);
      mo.disconnect();
    };
  }, []);

  // Recalcula layout no fullscreen para caber tudo sem scroll
  useEffect(() => {
    if (!fsActive) {
      setFsLayout(null);
      return;
    }
    const el = fsRef.current;
    const header = headerRef.current;
    const body = bodyRef.current;
    if (!el || !header || !body) return;

    const compute = () => {
      const headerH = header.getBoundingClientRect().height;
      const totalH = el.getBoundingClientRect().height;
      const totalW = el.getBoundingClientRect().width;

      // altura disponível para o grid (corpo)
      const availableH = Math.max(200, totalH - headerH - 16);
      const availableW = Math.max(280, totalW - 16);
      const gap = totalW < 520 ? 6 : 10;
      const minCols = 3;
      const maxCols = 8;
      const best = bestGridCols({ totalCards: Math.max(1, totalCards), w: availableW, h: availableH, gap, minCols, maxCols });
      setFsLayout({ cols: best.cols, card: Math.max(42, best.card), gap });
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    ro.observe(header);
    ro.observe(body);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [fsActive, totalCards]);

  useEffect(() => {
    if (!finished) return;
    setWinAnim(true);
  }, [finished]);

  // Atualiza barras/contadores globais quando o usuário conclui o jogo
  useEffect(() => {
    if (!finished) return;
    if (user?.role !== "user") return;
    emitUserProgressChanged();
  }, [finished, user?.role]);

  // Persistência do progresso (localStorage + backend) para não perder em refresh
  useEffect(() => {
    if (!game || !user || user.role !== "user") return;
    const key = `mg-progress:${user.id}:${game.id}`;
    const payload = {
      deck,
      firstPick,
      moves,
      finished,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void api.userUpdateMemoryGameProgress(game.id, {
        progress: payload,
        status: finished ? "concluido" : undefined,
      }).catch(() => {
        // ignore (não travar UX)
      });
    }, 450);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [deck, firstPick, moves, finished, game?.id, user?.id, user?.role]);

  return (
    <div className="min-h-[100svh] bg-transparent">

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

          {!loading && game && (
            <div className="text-sm text-muted-foreground whitespace-nowrap inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-brand-green" />
                {matchedCount}/{totalPairs} pares
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Tentativas: {moves}</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative">
        <div className="container mx-auto px-4 py-6 lg:py-8">
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
                      <div className="fs-hide-in-fs text-sm px-3 py-1.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                        {game.pairs_count} pares • {game.pairs_count * 2} cartas
                      </div>
                      <Button variant="secondary" onClick={doShuffle}>
                        <Shuffle className="h-4 w-4 mr-2" />
                        Embaralhar
                      </Button>
                      <Button variant="secondary" onClick={resetGame}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reiniciar
                      </Button>
                      {/* Botão pequeno, no header do conteúdo (não cobre o grid) */}
                      <FullscreenToggle targetRef={fsRef} className="ml-auto" />
                      {finished && (
                        <div className="text-sm px-3 py-1.5 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 inline-flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          Concluído!
                        </div>
                      )}
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

              <div ref={bodyRef} className={cn("mg-fs-body p-3 sm:p-6 lg:p-10 flex-1 fs-fit")}>
                {loading ? (
                  <Skeleton className="h-[60vh] w-full rounded-2xl" />
                ) : game ? (
                  <div
                    className={cn("grid", shuffleAnim && "mg-shuffle")}
                    style={{
                      gridTemplateColumns: `repeat(${fsActive && fsLayout ? fsLayout.cols : cols}, minmax(0, 1fr))`,
                      gap: `${fsActive && fsLayout ? fsLayout.gap : isSmall ? 12 : 16}px`,
                    }}
                  >
                    {deck.map((c, idx) => {
                      const show = c.flipped || c.matched;
                      return (
                        <button
                          key={c.instanceId}
                          type="button"
                          onClick={() => onCardClick(c.instanceId)}
                          disabled={lock || c.matched}
                          className={cn(
                            "relative aspect-square rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            "transition-transform active:scale-[0.99]",
                            c.matched ? "opacity-95" : "",
                            shuffleAnim && "mg-shuffle-card",
                          )}
                          style={{
                            perspective: 1000,
                            ...(fsActive && fsLayout ? ({ height: `${fsLayout.card}px` } as any) : null),
                            ...(shuffleAnim ? ({ animationDelay: `${Math.min(idx, 18) * 18}ms` } as any) : null),
                          }}
                          aria-label="Carta"
                        >
                          <div
                            className={cn(
                              "absolute inset-0 rounded-2xl transition-transform duration-500",
                              "shadow-sm border border-border",
                            )}
                            style={{
                              transformStyle: "preserve-3d",
                              transform: show ? "rotateY(180deg)" : "rotateY(0deg)",
                            }}
                          >
                            {/* Back */}
                            <div
                              className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
                              style={{
                                backfaceVisibility: "hidden",
                                background:
                                  "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(59,130,246,0.18), rgba(250,204,21,0.14))",
                              }}
                            >
                              <div className="absolute inset-0 opacity-[0.22]" style={{
                                backgroundImage:
                                  "radial-gradient(circle at 1px 1px, rgba(34,197,94,0.28) 1px, transparent 0)",
                                backgroundSize: "18px 18px",
                              }} />
                              {/* Número no verso: reflete a posição atual no tabuleiro (embaralha junto) */}
                              <div className="relative flex flex-col items-center justify-center">
                                <div className="text-3xl sm:text-4xl font-display font-black text-foreground/80 drop-shadow-sm">
                                  {idx + 1}
                                </div>
                                <img
                                  src={logoImage}
                                  alt=""
                                  className="mt-2 w-10 h-10 rounded-xl object-contain bg-white/70 p-1"
                                />
                              </div>
                            </div>

                            {/* Front */}
                            <div
                              className="absolute inset-0 rounded-2xl overflow-hidden bg-white flex items-center justify-center"
                              style={{
                                backfaceVisibility: "hidden",
                                transform: "rotateY(180deg)",
                              }}
                            >
                              <img
                                src={normalizeMediaUrl(c.imageUrl)}
                                alt=""
                                className="w-full h-full object-cover"
                                draggable={false}
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              {c.matched && (
                                <div className="absolute inset-0 bg-brand-green/15" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Comemoração ao finalizar */}
      <BrandedCongratsDialog
        open={winAnim}
        onOpenChange={setWinAnim}
        title="Parabéns!"
        description="Você encontrou todos os pares."
        primaryLabel="Jogar novamente"
        secondaryLabel="Fechar"
        onPrimary={() => resetGame()}
        onSecondary={() => {}}
      >
        <div className="flex items-center justify-start gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          Tentativas: <span className="font-semibold text-foreground">{moves}</span>
        </div>
      </BrandedCongratsDialog>
    </div>
  );
}


