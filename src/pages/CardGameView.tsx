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
  const [congratsOpen, setCongratsOpen] = useState(false);

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
        controlAllowedRef.current = sessionRole === "admin" ? true : granted;
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

  const canInteract = useMemo(() => {
    if (!inSession) return true;
    if (sessionRole === "admin") return true;
    return !!controlAllowedRef.current;
  }, [inSession, sessionRole]);

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
    const seed = (Date.now() ^ sessionSeed) >>> 0;
    playCardShuffle();
    resetDeck(clamp(game.cards_count), seed);
    emitSessionEvent({ game: "cards", kind: "reset", cards_count: clamp(game.cards_count), seed });
  }, [game, canInteract, resetDeck, emitSessionEvent, sessionSeed]);

  const doDraw = useCallback(() => {
    if (!game) return;
    if (!canInteract) return;
    if (remaining.length === 0) return;

    const nextId = remaining[0]; // position
    const nextRemaining = remaining.slice(1);
    const nextOpened = [...opened, nextId];
    setRemaining(nextRemaining);
    setOpened(nextOpened);
    setFlippingId(nextId);

    playCardFlip();

    window.setTimeout(() => setFlippingId((cur) => (cur === nextId ? null : cur)), 520);

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
        "min-h-[100svh] bg-background",
        inSession ? "p-0" : "py-6"
      )}
      style={
        gameBgUrl
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.08), rgba(0,0,0,.18)), url(${gameBgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
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

        <div className={cn("mt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4")}>
          {/* Baralho */}
          <div className="bg-card/80 backdrop-blur rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="h-4 w-4 text-brand-brown" />
                Baralho
              </div>
              <div className="text-xs text-muted-foreground">{remaining.length} restantes</div>
            </div>

            <button
              type="button"
              onClick={doDraw}
              disabled={!canInteract || remaining.length === 0}
              className={cn(
                "mt-4 w-full aspect-[3/4] rounded-2xl border border-border overflow-hidden shadow-sm relative",
                "bg-gradient-to-br from-brand-green/20 via-background to-brand-brown/15",
                !canInteract ? "opacity-70 cursor-not-allowed" : "hover:shadow-md",
                remaining.length === 0 ? "opacity-60" : ""
              )}
              title={!canInteract ? "Aguardando controle" : remaining.length === 0 ? "Sem cartas" : "Virar carta"}
            >
              {/* efeito pilha */}
              <div className="absolute inset-0">
                {Array.from({ length: Math.min(6, remaining.length) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-2xl border border-border bg-background/40"
                    style={{ transform: `translate(${i * 2}px, ${i * 2}px)` }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={logoImage} alt="Logo" className="h-16 w-16 rounded-2xl object-cover shadow-md" />
              </div>
            </button>

            <div className="mt-4 text-xs text-muted-foreground">
              Clique no baralho para virar uma carta. As cartas abertas ficam empilhadas ao lado.
            </div>
          </div>

          {/* Cartas abertas */}
          <div className="bg-card/80 backdrop-blur rounded-2xl border border-border p-4 min-h-[360px]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Cartas abertas</div>
              <div className="text-xs text-muted-foreground">{opened.length} abertas</div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-stretch">
              {/* Pilha aberta */}
              <div className="flex-1 min-h-[280px] rounded-2xl border border-border bg-background/40 p-4 relative overflow-hidden">
                {opened.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Vire a primeira carta para começar.
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    {opened.slice(-8).map((cid, idx) => {
                      const imgUrl = cardsByPos.get(cid) ?? null;
                      const face = faceFor(cid, sessionSeed);
                      const isTop = cid === topOpened;
                      const isFlipping = flippingId === cid;
                      const dx = idx * 10;
                      const dy = idx * 6;
                      return (
                        <div
                          key={cid}
                          className={cn("absolute left-6 top-6 w-[200px] max-w-[70%] aspect-[3/4]", isTop ? "z-20" : "z-10")}
                          style={{ transform: `translate(${dx}px, ${dy}px)` }}
                        >
                          <div className={cn("cg-card", isFlipping ? "is-flipping" : "")}>
                            <div className="cg-card-inner">
                              {/* back */}
                              <div className="cg-card-face cg-card-back">
                                <img src={logoImage} alt="" className="h-12 w-12 rounded-2xl object-cover opacity-95" />
                                <div className="text-xs text-muted-foreground mt-2">Sementes da Fala</div>
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
                                {!imgUrl ? (
                                  <>
                                    <div className="text-4xl drop-shadow-sm">{face.stamp}</div>
                                    <div className="mt-2 text-sm font-semibold text-white/90">Carta</div>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 bg-black/5" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pilha fechada (efeito) */}
              <div className="w-full sm:w-[220px] rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-sm font-semibold text-foreground">Pilha fechada</div>
                <div className="text-xs text-muted-foreground">Efeito visual do baralho</div>
                <div className="mt-4 relative h-[220px]">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-2 top-2 w-[160px] aspect-[3/4] rounded-2xl border border-border bg-gradient-to-br from-brand-green/15 via-background to-brand-brown/10 shadow-sm"
                      style={{ transform: `translate(${i * 6}px, ${i * 4}px)` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img src={logoImage} alt="" className="h-10 w-10 rounded-2xl object-cover opacity-90" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button
                className="rounded-xl bg-brand-brown hover:bg-brand-brown/90"
                onClick={doDraw}
                disabled={!canInteract || remaining.length === 0}
                title={!canInteract ? "Aguardando controle" : remaining.length === 0 ? "Sem cartas" : "Virar carta"}
              >
                Virar carta
              </Button>
            </div>
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
          .cg-card.is-flipping .cg-card-inner { transform: rotateY(180deg); }
          .cg-card-face{
            position:absolute; inset:0;
            border-radius: 18px;
            border: 1px solid rgba(0,0,0,.08);
            backface-visibility: hidden;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            overflow:hidden;
          }
          .cg-card-back{
            background: radial-gradient(circle at 30% 20%, rgba(34,197,94,.18), transparent 60%),
                        radial-gradient(circle at 70% 80%, rgba(180,83,9,.16), transparent 60%),
                        rgba(255,255,255,.75);
          }
          .cg-card-front{
            transform: rotateY(180deg);
            color: white;
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

