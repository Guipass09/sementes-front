import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Layers, Shuffle } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { CardGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { cn } from "@/lib/utils";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCardFlip, playCardShuffle, playFanfare } from "@/lib/sfx";

type CardFace = {
  id: number;
  hue: number;
  stamp: string;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function faceFor(cardId: number, seed: number): CardFace {
  const rnd = mulberry32((seed ^ (cardId * 2654435761)) >>> 0);
  const hue = Math.floor(rnd() * 360);
  const stamps = ["🌱", "⭐", "🎵", "🧩", "📘", "🎯", "🖍️", "🎈", "🌼", "🍀", "🦋", "🐝", "🧠", "🎲", "🪁"];
  const stamp = stamps[cardId % stamps.length];
  return { id: cardId, hue, stamp };
}

export default function CardGameView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as "admin" | "user" | "";
  const sessionId = useMemo(() => {
    const n = Number(sessionParams.get("session_id"));
    return Number.isFinite(n) ? n : null;
  }, [sessionParams]);
  const sessionSeed = useMemo(() => {
    const n = Number(sessionParams.get("session_seed"));
    return Number.isFinite(n) ? (n >>> 0) : 123456789;
  }, [sessionParams]);
  const [controlAllowed, setControlAllowed] = useState<boolean>(sessionRole === "admin");
  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);
  const autoPseudoFullscreen = inSession && sessionRole === "user";
  const fsRef = useRef<HTMLDivElement | null>(null);

  const emitSessionEvent = useCallback(
    (event: any) => {
      if (!inSession) return;
      if (applyingRemoteRef.current) return;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
        }
      } catch {}
    },
    [inSession]
  );

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<CardGameRow | null>(null);

  // Estado do baralho
  const [remaining, setRemaining] = useState<number[]>([]); // posições (0..n-1)
  const [opened, setOpened] = useState<number[]>([]); // posições (0..n-1)
  const [flippingId, setFlippingId] = useState<number | null>(null);
  const [flipStartedId, setFlipStartedId] = useState<number | null>(null);
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [shuffleAnim, setShuffleAnim] = useState<null | { seed: number; count: number }>(null);

  const openedRef = useRef<number[]>([]);
  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);

  const gameBgUrl = game?.background_url ? normalizeMediaUrl(game.background_url) : null;

  // Sessão ao vivo (usuário): pseudo fullscreen
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

  const resetDeck = useCallback(
    (count: number, seed: number) => {
      const base = Array.from({ length: count }, (_, i) => i);
      const rnd = mulberry32(seed);
      const ord = shuffle(base, rnd);
      setRemaining(ord);
      setOpened([]);
      setFlippingId(null);
      setCongratsOpen(false);
    },
    []
  );

  // Load game
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const isAdmin = auth.user?.role === "admin";
        const data = isAdmin
          ? await api.adminGetCardGame(Number(id))
          : await api.userGetCardGame(Number(id), inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(data);
        resetDeck(Math.max(1, Math.min(15, Number(data.cards_count) || 10)), sessionSeed);
      } catch {
        if (!cancelled) {
          if (inSession) setGame(null);
          else navigate("/paciente/jogos");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, auth.user, inSession, sessionId, navigate, resetDeck, sessionSeed]);

  // Sessão: recebe controle + eventos
  useEffect(() => {
    if (!inSession) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data: any = ev.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "SESSION_CONTROL") {
        const granted = !!data.granted;
        const allowed = sessionRole === "admin" ? true : granted;
        controlAllowedRef.current = allowed;
        setControlAllowed(allowed);
        return;
      }

      if (data.type !== "SESSION_GAME_EVENT") return;
      const evt = data.event;
      if (!evt || typeof evt !== "object") return;
      if (evt.game !== "cards") return;

      applyingRemoteRef.current = true;
      try {
        if (evt.kind === "reset") {
          const count = Number(evt.cards_count);
          const seed = Number(evt.seed);
          if (!Number.isFinite(count) || !Number.isFinite(seed)) return;
          resetDeck(clamp(count), seed >>> 0);
          return;
        }

        if (evt.kind === "shuffle") {
          const count = Number(evt.cards_count);
          const seed = Number(evt.seed);
          if (!Number.isFinite(count) || !Number.isFinite(seed)) return;
          // anima e depois reseta
          playCardShuffle();
          setCongratsOpen(false);
          setShuffleAnim({ seed: seed >>> 0, count: clamp(count) });
          return;
        }

        if (evt.kind === "state") {
          const rem = Array.isArray(evt.remaining) ? evt.remaining.map((x: any) => Number(x)).filter(Number.isFinite) : null;
          const op = Array.isArray(evt.opened) ? evt.opened.map((x: any) => Number(x)).filter(Number.isFinite) : null;
          if (!rem || !op) return;
          setRemaining(rem);
          setOpened(op);
          setFlippingId(Number.isFinite(Number(evt.flippingId)) ? Number(evt.flippingId) : null);
          setCongratsOpen(!!evt.congrats);
          return;
        }
      } finally {
        window.setTimeout(() => (applyingRemoteRef.current = false), 0);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, resetDeck, sessionRole]);

  // Execução do shuffle animado: espera animação e então reseta o deck
  useEffect(() => {
    if (!shuffleAnim) return;
    const currentOpened = openedRef.current;
    // duração baseada no tamanho da pilha (max 15)
    const totalMs = 850 + Math.min(600, currentOpened.length * 35);
    const t = window.setTimeout(() => {
      resetDeck(shuffleAnim.count, shuffleAnim.seed);
      setShuffleAnim(null);
    }, totalMs);
    return () => window.clearTimeout(t);
  }, [shuffleAnim, resetDeck]);

  // Sempre que tiver uma carta "flippingId", dispara a fase 2 do flip (para ficar aberta)
  useEffect(() => {
    if (flippingId === null) {
      setFlipStartedId(null);
      return;
    }
    setFlipStartedId(null);
    const t = window.setTimeout(() => setFlipStartedId(flippingId), 40);
    const t2 = window.setTimeout(() => {
      setFlippingId(null);
      setFlipStartedId(null);
    }, 900);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [flippingId]);

  const canInteract = useMemo(() => {
    if (!inSession) return true;
    if (sessionRole === "admin") return true;
    return !!controlAllowed;
  }, [inSession, sessionRole, controlAllowed]);

  const clamp = (n: number) => Math.max(1, Math.min(15, Math.floor(n)));

  const broadcastState = useCallback(
    (next: { remaining: number[]; opened: number[]; flippingId: number | null; congrats: boolean }) => {
      if (!inSession) return;
      emitSessionEvent({
        game: "cards",
        kind: "state",
        remaining: next.remaining,
        opened: next.opened,
        flippingId: next.flippingId,
        congrats: next.congrats,
      });
    },
    [emitSessionEvent, inSession]
  );

  const doShuffle = useCallback(() => {
    if (!game) return;
    if (!canInteract) return;
    if (shuffleAnim) return;
    const seed = (Date.now() ^ sessionSeed) >>> 0;
    playCardShuffle();
    // dispara animação local e sincroniza; ao final, reseta.
    setCongratsOpen(false);
    setShuffleAnim({ seed, count: clamp(game.cards_count) });
    emitSessionEvent({ game: "cards", kind: "shuffle", cards_count: clamp(game.cards_count), seed });
  }, [game, canInteract, resetDeck, emitSessionEvent, sessionSeed, shuffleAnim]);

  const doDraw = useCallback(() => {
    if (!game) return;
    if (!canInteract) return;
    if (shuffleAnim) return;
    if (remaining.length === 0) return;

    const nextId = remaining[0]; // position
    const nextRemaining = remaining.slice(1);
    const nextOpened = [...opened, nextId];
    setRemaining(nextRemaining);
    setOpened(nextOpened);
    setFlippingId(nextId);

    playCardFlip();

    const done = nextRemaining.length === 0;
    if (done) {
      window.setTimeout(() => {
        setCongratsOpen(true);
        playFanfare();
      }, 650);
    }

    broadcastState({ remaining: nextRemaining, opened: nextOpened, flippingId: nextId, congrats: done });
  }, [game, canInteract, remaining, opened, broadcastState]);

  useEffect(() => {
    if (!game) return;
    if (inSession) return;
    // persistência leve do progresso (fora da sessão): opcional
    if (auth.user?.role !== "user") return;
    void api.userUpdateCardGameProgress(game.id, {
      status: remaining.length === 0 ? "concluido" : "disponivel",
      progress: { remaining, opened },
    }).catch(() => {});
  }, [game?.id, remaining.length]);

  const topOpened = opened.length ? opened[opened.length - 1] : null;

  const cardsByPos = useMemo(() => {
    const arr = Array.isArray(game?.cards) ? game!.cards! : [];
    const map = new Map<number, string | null>();
    for (const c of arr) map.set(Number(c.position), c.url ? normalizeMediaUrl(c.url) : null);
    return map;
  }, [game?.id, game?.cards]);

  if (loading) {
    return (
      <div className="min-h-[100svh] py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-6 w-80 mt-3" />
          <Skeleton className="h-[520px] w-full rounded-2xl mt-6" />
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-[100svh] py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          Jogo não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={fsRef as any}
      className={cn(
        "min-h-[100svh] bg-transparent",
        inSession ? "p-0" : "py-6"
      )}
    >
      <div className={cn("container mx-auto px-4", inSession ? "py-3" : "py-4")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!inSession ? (
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <img src={logoImage} alt="Sementes da Fala" className="h-8 w-8 rounded-lg object-cover" />
                <span>Jogo das Cartas</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl bg-background/80 backdrop-blur"
              onClick={doShuffle}
              disabled={!canInteract}
              title={!canInteract ? "Aguardando controle" : "Embaralhar"}
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Embaralhar
            </Button>
            {!inSession ? <FullscreenToggle /> : null}
          </div>
        </div>

        {/* Tabuleiro grande (igual estilo do auditivo): fundo + baralho + carta aberta */}
        <div
          className={cn(
            "mt-4 relative w-full h-[55vh] sm:h-[62vh] lg:h-[70vh] rounded-2xl overflow-hidden bg-black/5",
            shuffleAnim ? "cg-shuffling" : ""
          )}
        >
          {gameBgUrl ? (
            <img
              src={gameBgUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : null}
          {/* leve vinheta para destacar cartas */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/15" />

          {/* Baralho (esquerda) */}
          <button
            type="button"
            onClick={doDraw}
            disabled={!canInteract || remaining.length === 0 || !!shuffleAnim}
            className={cn(
              "absolute left-[4%] top-1/2 -translate-y-1/2",
              "w-[42%] max-w-[520px] aspect-[4/3]",
              "cg-deck",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40",
              !canInteract ? "opacity-75 cursor-not-allowed" : "hover:brightness-[1.02]"
            )}
            title={!canInteract ? "Aguardando controle" : remaining.length === 0 ? "Sem cartas" : "Virar carta"}
          >
            <div className="relative w-full h-full cg-deck-inner">
              {/* pilha */}
              {Array.from({ length: Math.min(10, Math.max(2, remaining.length)) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-[26px] bg-white/80 shadow-[0_12px_30px_rgba(0,0,0,.20)]"
                  style={{
                    transform: `translate(${i * 2.2}px, ${i * 1.6}px) rotate(${(i - 4) * 0.15}deg)`,
                  }}
                >
                  <div className="absolute inset-[10px] rounded-[20px] border-[10px] border-[#D6B15C]/90" />
                  <div className="absolute inset-[22px] rounded-[14px] border border-[#D6B15C]/70 bg-[#D6B15C]/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={logoImage} alt="" className="h-24 w-24 rounded-3xl object-cover opacity-95" />
                  </div>
                </div>
              ))}
            </div>
          </button>

          {/* Cartas abertas (direita) */}
          <div className="cg-open-stack absolute right-[4%] top-1/2 -translate-y-1/2 w-[48%] max-w-[620px] aspect-[4/3]">
            <div className="relative w-full h-full">
              {opened.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="px-4 py-2 rounded-xl bg-background/70 border border-border text-sm text-muted-foreground">
                    Clique no baralho para abrir as cartas.
                  </div>
                </div>
              ) : (
                opened.map((pos, idx) => {
                  const imgUrl = cardsByPos.get(pos) ?? null;
                  const face = faceFor(pos, sessionSeed);
                  const isTop = idx === opened.length - 1;
                      const isNew = flippingId === pos;
                      const isFlipStarted = flipStartedId === pos;
                  const dx = Math.min(180, idx * 10);
                  const dy = Math.min(120, idx * 7);
                  return (
                    <div
                      key={`${pos}-${idx}`}
                      className={cn(
                        "cg-open-card absolute left-0 top-0 w-[92%] h-[92%]",
                        isTop ? "z-30" : "z-10"
                      )}
                      style={{
                        transform: `translate(${dx}px, ${dy}px) rotate(${(idx - 2) * 0.2}deg)`,
                        // delay escalonado para animação de retorno
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ["--d" as any]: `${Math.min(520, idx * 35)}ms`,
                      }}
                    >
                      <div className={cn("cg-card", "is-faceup", isNew ? "is-new" : "", isFlipStarted ? "cg-flipped" : "")}>
                        <div className="cg-card-inner">
                          {/* back */}
                          <div className="cg-card-face cg-card-back">
                            <div className="cg-frame" />
                            <div className="cg-frame-inner" />
                            <img src={logoImage} alt="" className="h-24 w-24 rounded-3xl object-cover opacity-95" />
                          </div>
                          {/* front */}
                          <div
                            className="cg-card-face cg-card-front"
                            style={{
                              background: imgUrl
                                ? `linear-gradient(to bottom, rgba(0,0,0,.10), rgba(0,0,0,.18)), url(${imgUrl})`
                                : `linear-gradient(135deg, hsl(${face.hue} 85% 62%), hsl(${(face.hue + 40) % 360} 85% 48%))`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            <div className="cg-frame" />
                            <div className="cg-frame-inner" />
                            {!imgUrl ? <div className="text-4xl drop-shadow-sm">{face.stamp}</div> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* indicador de restantes (discreto) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-background/70 border border-border">
            {opened.length}/{game.cards_count} abertas • {remaining.length} restantes
          </div>
        </div>

        {/* CSS do flip (local do componente) */}
        <style>{`
          .cg-card { perspective: 1000px; width: 100%; height: 100%; }
          .cg-card-inner {
            position: relative;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            transition: transform 520ms cubic-bezier(.2,.8,.2,1);
          }
          .cg-card.is-faceup .cg-card-inner { transform: rotateY(180deg); }
          /* animação: nasce fechado e vira */
          .cg-card.is-faceup.is-new .cg-card-inner { transform: rotateY(0deg); }
          .cg-card.is-faceup.is-new.cg-flipped .cg-card-inner { transform: rotateY(180deg); }
          .cg-card-face{
            position:absolute; inset:0;
            border-radius: 22px;
            border: 0;
            backface-visibility: hidden;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            overflow:hidden;
          }
          .cg-card-back{
            background: rgba(255,255,255,.85);
          }
          .cg-card-front{
            transform: rotateY(180deg);
            color: white;
          }
          .cg-frame{
            position:absolute; inset:10px;
            border-radius: 18px;
            border: 10px solid rgba(214,177,92,.92);
            pointer-events:none;
          }
          .cg-frame-inner{
            position:absolute; inset:24px;
            border-radius: 12px;
            border: 1px solid rgba(214,177,92,.75);
            background: rgba(214,177,92,.10);
            pointer-events:none;
          }

          /* Embaralhar: cartas voltam para o baralho + baralho "shake" */
          .cg-shuffling .cg-open-card{
            animation: cg-return-to-deck 540ms cubic-bezier(.2,.8,.2,1) forwards;
            animation-delay: var(--d, 0ms);
          }
          .cg-shuffling .cg-deck{
            animation: cg-deck-shuffle 680ms ease-in-out both;
          }
          @keyframes cg-return-to-deck {
            0% { opacity: 1; transform: translate(var(--x, 0px), var(--y, 0px)) scale(1) rotate(0deg); }
            40% { opacity: 0.95; }
            100% { opacity: 0; transform: translate(-220px, 40px) scale(0.55) rotate(-6deg); filter: blur(0.4px); }
          }
          .cg-shuffling .cg-deck-inner{
            animation: cg-deck-shuffle 680ms ease-in-out both;
          }
          @keyframes cg-deck-shuffle {
            0% { transform: rotate(0deg) translateX(0px); }
            15% { transform: rotate(-1.2deg) translateX(-6px); }
            30% { transform: rotate(1.4deg) translateX(7px); }
            45% { transform: rotate(-1.0deg) translateX(-5px); }
            60% { transform: rotate(1.0deg) translateX(5px); }
            100% { transform: rotate(0deg) translateX(0px); }
          }

          /* Mobile dentro da transmissão: layout vertical (baralho em cima, cartas embaixo) */
          @media (max-width: 640px) {
            .cg-deck{
              left: 50% !important;
              top: 32% !important;
              width: 78% !important;
              max-width: none !important;
              transform: translate(-50%, -50%) !important;
            }
            .cg-open-stack{
              left: 50% !important;
              right: auto !important;
              top: 74% !important;
              width: 88% !important;
              max-width: none !important;
              transform: translate(-50%, -50%) !important;
            }
          }
        `}</style>
      </div>

      <Dialog open={congratsOpen} onOpenChange={setCongratsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parabéns!</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Você virou todas as cartas do baralho. Quer embaralhar e jogar novamente?
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setCongratsOpen(false)}>
              Fechar
            </Button>
            <Button className="bg-brand-brown hover:bg-brand-brown/90" onClick={doShuffle}>
              Embaralhar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

