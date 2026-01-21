import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ear, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import type { AuditoryGameRow } from "@/lib/laravel-api";
import { useAuth } from "@/auth/AuthContext";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { emitUserProgressChanged } from "@/lib/user-events";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";

type ItemState = {
  id: number;
  url: string;
  position: number;
  expected_side: "left" | "right";
  status: "idle" | "correct" | "wrong" | "done";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(arr: T[], seed: number) {
  const rnd = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AuditoryGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { toast } = useToast();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as "admin" | "user" | "";
  const sessionId = useMemo(() => {
    const n = Number(sessionParams.get("session_id"));
    return Number.isFinite(n) ? n : null;
  }, [sessionParams]);
  const initialSeed = (() => {
    const s = Number(sessionParams.get("session_seed"));
    return Number.isFinite(s) ? s : 0;
  })();
  const sessionSeedRef = useRef<number>(initialSeed);
  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const emitSessionEvent = useCallback(
    (event: any) => {
      if (!inSession) return;
      if (applyingRemoteRef.current) return;
      if (sessionRole === "user" && !controlAllowedRef.current) return;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
        }
      } catch {}
    },
    [inSession, sessionRole],
  );

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<AuditoryGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [items, setItems] = useState<ItemState[]>([]);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<null | { kind: "correct" | "wrong"; x: number; y: number }>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<null | { id: number; x: number; y: number }>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const autoPseudoFullscreen = inSession && sessionRole === "user";

  // Sessão ao vivo (usuário): abre automaticamente em pseudo fullscreen
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
  const feedbackTimerRef = useRef<number | null>(null);
  const pointerDragIdRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);

  const clearFeedbackSoon = useCallback(() => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 900);
  }, []);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) navigate("/entrar");
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      try {
        // Admin pode visualizar pelo endpoint admin (sem restrição de atribuição).
        const g =
          auth.user?.role === "admin"
            ? await api.adminGetAuditoryGame(gameId)
            : auth.user?.role === "professional"
              ? await api.professionalGetAuditoryGame(gameId)
              : await api.userGetAuditoryGame(gameId, inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(g);

        const build = (progress: any | null) => {
          const base = g.items.map((it) => ({
            id: it.id,
            url: it.url,
            position: it.position,
            expected_side: it.expected_side ?? "right",
            status: "idle" as const,
          }));

          if (inSession) {
            const seed = sessionSeedRef.current ?? 0;
            const ordered = shuffleSeeded(base, seed);
            return ordered.map((x) => ({ ...x, status: "idle" as const }));
          }

          const orderIds: number[] | null = Array.isArray(progress?.order)
            ? progress.order.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))
            : null;
          const doneIds: number[] = Array.isArray(progress?.doneIds)
            ? progress.doneIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))
            : [];

          let ordered = base;
          if (orderIds && orderIds.length === base.length) {
            const byId = new Map(base.map((x) => [x.id, x]));
            const mapped = orderIds.map((id) => byId.get(id)).filter(Boolean) as any[];
            if (mapped.length === base.length) ordered = mapped;
          } else {
            ordered = shuffle(base);
          }

          return ordered.map((x) => ({ ...x, status: doneIds.includes(x.id) ? ("done" as const) : ("idle" as const) }));
        };

        const key = auth.user?.role === "user" && auth.user?.id ? `aud-progress:${auth.user.id}:${g.id}` : null;
        const fromApi = (g as any).progress;
        const fromLocal = key ? (() => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } })() : null;
        const p = fromApi ?? fromLocal;
        setItems(build(p));
        setCelebrate(false);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        } else {
          toast({ title: "Erro ao carregar jogo", description: "Tente novamente.", variant: "destructive" });
        }
        setGame(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, auth.user?.role, navigate, toast]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const allDone = useMemo(() => items.every((it) => it.status === "done"), [items]);

  // Sessão ao vivo: envia/recebe estado para manter as mesmas cartas "done" e a mesma ordem
  useEffect(() => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    if (sessionRole === "user" && !controlAllowedRef.current) return;
    emitSessionEvent({
      game: "auditory",
      kind: "state",
      order: items.map((i) => i.id),
      doneIds: items.filter((i) => i.status === "done").map((i) => i.id),
    });
  }, [items, inSession, sessionRole, emitSessionEvent]);

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
      if (evt.game !== "auditory") return;

      if (evt.kind === "restart") {
        applyingRemoteRef.current = true;
        try {
          if (!game) return;
          setItems(
            shuffleSeeded(game.items, sessionSeedRef.current ?? 0).map((it) => ({
              id: it.id,
              url: it.url,
              position: it.position,
              expected_side: it.expected_side ?? "right",
              status: "idle" as const,
            })),
          );
          setFeedback(null);
          setActiveDragId(null);
          setPointerDrag(null);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
        return;
      }

      if (evt.kind === "state") {
        const orderIds: number[] = Array.isArray(evt.order) ? evt.order.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)) : [];
        const doneIds: number[] = Array.isArray(evt.doneIds) ? evt.doneIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)) : [];
        if (!orderIds.length) return;
        applyingRemoteRef.current = true;
        try {
          setItems((prev) => {
            const byId = new Map(prev.map((x) => [x.id, x]));
            // Se ainda não temos prev (ex.: loading), monta a partir do game quando possível
            const base: ItemState[] = (() => {
              if (byId.size) {
                return orderIds.map((id) => byId.get(id)).filter(Boolean) as ItemState[];
              }
              const gItems = game?.items || [];
              const byGameId = new Map(
                gItems.map((it) => [
                  it.id,
                  {
                    id: it.id,
                    url: it.url,
                    position: it.position,
                    expected_side: it.expected_side ?? "right",
                    status: "idle" as const,
                  },
                ]),
              );
              return orderIds.map((id) => byGameId.get(id)).filter(Boolean) as ItemState[];
            })();

            return base.map((x) => ({
              ...x,
              status: doneIds.includes(x.id) ? ("done" as const) : ("idle" as const),
            }));
          });
          setActiveDragId(null);
          setPointerDrag(null);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
      }

      if (evt.kind === "drop") {
        const itemId = Number(evt.itemId);
        const result = String(evt.result || "");
        const expected = (String(evt.expected || "") as any) === "left" ? "left" : "right";
        const nx = Number(evt.x);
        const ny = Number(evt.y);
        if (!Number.isFinite(itemId) || itemId <= 0) return;
        if (result !== "correct" && result !== "wrong") return;

        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect) return;

        const localX = clamp(Number.isFinite(nx) ? nx * rect.width : rect.width / 2, 0, rect.width);
        const localY = clamp(Number.isFinite(ny) ? ny * rect.height : rect.height / 2, 0, rect.height);
        const centerX = rect.width / 2;
        const deadZone = rect.width * 0.08;

        applyingRemoteRef.current = true;
        try {
          if (result === "correct") {
            playCorrect();
            const rightMinX = centerX + deadZone + rect.width * 0.06;
            const clampedX =
              expected === "right"
                ? Math.max(localX, rightMinX)
                : Math.min(localX, centerX - deadZone - rect.width * 0.06);
            const clampedY = clamp(localY, rect.height * 0.12, rect.height * 0.9);
            setFeedback({ kind: "correct", x: clampedX, y: clampedY });
            clearFeedbackSoon();
            setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "done" } : it)));
          } else {
            playWrong();
            setFeedback({ kind: "wrong", x: localX, y: localY });
            clearFeedbackSoon();
          }
          setActiveDragId(null);
          setPointerDrag(null);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole, game?.id, clearFeedbackSoon]);

  useEffect(() => {
    if (!allDone) return;
    setCelebrate(true);
    const t = window.setTimeout(() => setCelebrate(false), 2500);
    return () => window.clearTimeout(t);
  }, [allDone]);

  // Atualiza barras/contadores globais quando o usuário conclui o jogo
  useEffect(() => {
    if (!allDone) return;
    if (auth.user?.role !== "user") return;
    emitUserProgressChanged();
  }, [allDone, auth.user?.role]);

  // Persistência do progresso (localStorage + backend) para não perder no refresh
  useEffect(() => {
    if (inSession) return;
    if (!game || !auth.user || auth.user.role !== "user") return;
    const key = `aud-progress:${auth.user.id}:${game.id}`;
    const payload = {
      order: items.map((i) => i.id),
      doneIds: items.filter((i) => i.status === "done").map((i) => i.id),
      finished: allDone,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void api.userUpdateAuditoryGameProgress(game.id, {
        progress: payload,
        status: allDone ? "concluido" : undefined,
      }).catch(() => {
        // ignore
      });
    }, 450);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [items, allDone, game?.id, auth.user?.id, auth.user?.role]);

  const onDragStart = useCallback((itemId: number) => {
    if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;
    setActiveDragId(itemId);
    setFeedback(null);
  }, [inSession, sessionRole]);

  const onDrop = useCallback(
    (itemId: number, clientX: number, clientY: number) => {
      if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;
      if (!boardRef.current) return;

      const rect = boardRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const centerX = rect.width / 2;
      const deadZone = rect.width * 0.08; // “delimite o centro”

      const side =
        localX < centerX - deadZone ? "left" : localX > centerX + deadZone ? "right" : "center";

      if (side === "center") {
        setActiveDragId(null);
        return;
      }

      const item = items.find((x) => x.id === itemId);
      const expected = item?.expected_side ?? "right";
      const isCorrect = side === expected;
      const isWrong = side !== expected;

      if (isCorrect) {
        playCorrect();
        // Mantém o feedback no lado direito e perto do ponto de soltura,
        // evitando invadir a área esquerda.
        const rightMinX = centerX + deadZone + rect.width * 0.06;
        const clampedX =
          expected === "right"
            ? Math.max(localX, rightMinX)
            : Math.min(localX, centerX - deadZone - rect.width * 0.06);
        const clampedY = clamp(localY, rect.height * 0.12, rect.height * 0.9);
        setFeedback({ kind: "correct", x: clampedX, y: clampedY });
        clearFeedbackSoon();
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "done" } : it)));
        emitSessionEvent({
          game: "auditory",
          kind: "drop",
          itemId,
          result: "correct",
          expected,
          side,
          x: rect.width > 0 ? localX / rect.width : 0.5,
          y: rect.height > 0 ? localY / rect.height : 0.5,
        });
      } else if (isWrong) {
        playWrong();
        setFeedback({ kind: "wrong", x: localX, y: localY });
        clearFeedbackSoon();
        emitSessionEvent({
          game: "auditory",
          kind: "drop",
          itemId,
          result: "wrong",
          expected,
          side,
          x: rect.width > 0 ? localX / rect.width : 0.5,
          y: rect.height > 0 ? localY / rect.height : 0.5,
        });
      }

      setActiveDragId(null);
    },
    [clearFeedbackSoon, items, inSession, sessionRole, emitSessionEvent],
  );

  const endPointerDrag = useCallback(
    (clientX: number, clientY: number) => {
      const id = pointerDragIdRef.current;
      if (!id) return;
      setPointerDrag(null);
      pointerDragIdRef.current = null;
      const moved = pointerMovedRef.current;
      pointerMovedRef.current = false;
      pointerStartRef.current = null;
      // Se foi só um toque (sem arrastar), não confirma acerto/erro.
      if (!moved) {
        setActiveDragId(null);
        return;
      }
      onDrop(id, clientX, clientY);
    },
    [onDrop],
  );

  // Suporte para touch/iPad: simula drag via pointer events (HTML5 drag costuma falhar no iOS)
  useEffect(() => {
    if (!pointerDrag) return;

    const onMove = (e: PointerEvent) => {
      // Enquanto arrasta, não deixe o browser iniciar scroll/pull-to-refresh.
      // (No iOS/Android, isso pode cancelar o pointer e quebrar o jogo.)
      if (e.cancelable) e.preventDefault();
      if (!pointerMovedRef.current && pointerStartRef.current) {
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        if (Math.hypot(dx, dy) > 8) pointerMovedRef.current = true; // threshold anti-"tap"
      }
      setPointerDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    };
    const onUp = (e: PointerEvent) => {
      endPointerDrag(e.clientX, e.clientY);
    };
    const onCancel = () => {
      // Cancelou (ex: scroll, gesto do sistema): NÃO confirma acerto/erro.
      setPointerDrag(null);
      setActiveDragId(null);
      pointerDragIdRef.current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: false } as any);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [pointerDrag, endPointerDrag]);

  // Enquanto está arrastando no touch, bloqueia scroll/overscroll do body (evita pull-to-refresh)
  useEffect(() => {
    if (!pointerDrag) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = (document.body.style as any).overscrollBehavior;
    document.body.style.overflow = "hidden";
    (document.body.style as any).overscrollBehavior = "none";

    const preventTouchMove = (e: TouchEvent) => {
      if (!pointerDragIdRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      window.removeEventListener("touchmove", preventTouchMove as any);
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).overscrollBehavior = prevOverscroll;
    };
  }, [pointerDrag]);

  const restart = useCallback(() => {
    if (!game) return;
    if (inSession && sessionRole === "admin" && !applyingRemoteRef.current) {
      emitSessionEvent({ game: "auditory", kind: "restart" });
    }
    setItems(
      (inSession ? shuffleSeeded(game.items, sessionSeedRef.current ?? 0) : shuffle(game.items)).map((it) => ({
        id: it.id,
        url: it.url,
        position: it.position,
        expected_side: it.expected_side ?? "right",
        status: "idle",
      })),
    );
    setFeedback(null);
    setCelebrate(false);
  }, [game, inSession, sessionRole, emitSessionEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-56 mb-6" />
          <Skeleton className="h-[70vh] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Jogo não encontrado</h1>
          <p className="text-muted-foreground mb-4">Esse jogo não existe ou foi removido.</p>
          <Button onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Acesso negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para abrir este jogo.</p>
          <Button onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="min-h-[100svh] bg-transparent">
      {!inSession && (
      <div className="fs-hide-when-fullscreen sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
            <Button variant="secondary" onClick={restart} className="shrink-0 sm:hidden">
              Recomeçar
            </Button>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground">
              <Ear className="h-4 w-4" />
              Estimulação Auditiva
            </div>
            <div className="font-display font-bold text-foreground truncate">{game.title}</div>
          </div>

          <Button variant="secondary" onClick={restart} className="hidden sm:inline-flex">
            Recomeçar
          </Button>
        </div>
      </div>
      )}

      <div className={cn("container mx-auto px-4 py-6", inSession && "px-0 py-0")}>
        <div ref={fsRef} className="fs-target relative">
          {/* Botão pequeno no canto do conteúdo (estilo vídeo) */}
          <FullscreenToggle targetRef={fsRef} className="absolute bottom-3 right-3 z-30" mode={inSession ? "pseudo" : "auto"} />

          <div className={cn("mb-4 text-sm text-muted-foreground", inSession && "px-4 pt-4")}>
            Arraste a figura <span className="font-semibold text-foreground">para baixo</span> e solte à{" "}
            <span className="font-semibold text-foreground">direita</span> para confirmar. Solte à{" "}
            <span className="font-semibold text-foreground">esquerda</span> para marcar como errado.
          </div>

          {/* Top draggable items (sempre em uma fileira) */}
          <div className="mb-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pr-2 flex-nowrap snap-x snap-mandatory">
              {items.map((it) => {
                const disabled = it.status === "done";
                return (
                  <div
                    key={it.id}
                    className={cn("relative shrink-0 w-24 sm:w-28 md:w-32 lg:w-36 snap-start", disabled && "opacity-50")}
                  >
                    <img
                      src={normalizeMediaUrl(it.url)}
                      alt=""
                      draggable={!disabled}
                      onDragStart={(e) => {
                        if (disabled) return;
                        e.dataTransfer.setData("text/plain", String(it.id));
                        e.dataTransfer.effectAllowed = "move";
                        onDragStart(it.id);
                      }}
                      onPointerDown={(e) => {
                        if (disabled) return;
                        // só inicia em touch/pen (mouse pode usar drag nativo)
                        if (e.pointerType === "mouse") return;
                        e.preventDefault();
                        // Garante que o "soltar" chega mesmo se o dedo sair do elemento
                        try {
                          (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                        } catch {
                          // ignore
                        }
                        pointerDragIdRef.current = it.id;
                        pointerStartRef.current = { x: e.clientX, y: e.clientY };
                        pointerMovedRef.current = false;
                        setActiveDragId(it.id);
                        setFeedback(null);
                        setPointerDrag({ id: it.id, x: e.clientX, y: e.clientY });
                      }}
                      className={cn(
                        "w-full h-auto aspect-square object-cover rounded-2xl border border-border shadow-sm bg-card",
                        "touch-none select-none",
                        disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
                        activeDragId === it.id && "ring-2 ring-primary/40",
                      )}
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    {it.status === "done" && (
                      <div className="absolute inset-0 rounded-2xl bg-brand-green/15 border border-brand-green/30" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              Dica: arraste uma imagem para baixo e solte à{" "}
              <span className="font-semibold text-foreground">direita</span> (certo) ou{" "}
              <span className="font-semibold text-foreground">esquerda</span> (errado).
            </div>
          </div>

          {/* Board */}
          <div
            ref={boardRef}
            className="relative rounded-3xl border border-border overflow-hidden shadow-sm bg-muted/10"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("text/plain");
              const droppedId = Number(raw);
              if (!Number.isFinite(droppedId) || droppedId <= 0) return;
              onDrop(droppedId, e.clientX, e.clientY);
            }}
          >
            <img
              src={normalizeMediaUrl(game.background_url)}
              alt=""
              className="w-full h-[55vh] sm:h-[62vh] lg:h-[70vh] object-contain bg-black/5"
            />

          {/* Center line */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-white/65 mix-blend-overlay" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-background/70 border border-border">
            Linha central
          </div>

          {/* Ghost do drag (touch) - precisa estar DENTRO do fs-target para funcionar em fullscreen nativo */}
          {pointerDrag && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: pointerDrag.x - (fsRef.current?.getBoundingClientRect().left ?? 0),
                top: pointerDrag.y - (fsRef.current?.getBoundingClientRect().top ?? 0),
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-24 sm:w-28 md:w-32 lg:w-36 aspect-square rounded-2xl overflow-hidden border border-border shadow-xl bg-card">
                <img
                  src={normalizeMediaUrl(items.find((i) => i.id === pointerDrag.id)?.url ?? "/placeholder.svg")}
                  alt=""
                  className="w-full h-full object-cover opacity-95"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback?.kind === "wrong" && (
            <div
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none mg-aud-wrong")}
              style={{ left: feedback.x, top: feedback.y }}
            >
              <div className="max-w-[90vw] flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-600 text-white shadow-lg">
                <XCircle className="h-6 w-6" />
                <div className="font-semibold text-lg">ERRADO</div>
              </div>
            </div>
          )}

          {feedback?.kind === "correct" && (
            <div
              className="absolute -translate-x-1/2 -translate-y-[110%] pointer-events-none mg-aud-correct"
              style={{ left: feedback.x, top: feedback.y }}
            >
              <div className="max-w-[90vw] text-center px-6 sm:px-8 py-5 sm:py-6 rounded-3xl bg-brand-green text-white shadow-2xl border border-white/25">
                <div className="flex items-center justify-center gap-3">
                  <Sparkles className="h-8 w-8" />
                  <div className="font-display font-extrabold text-3xl sm:text-4xl tracking-wide">CERTO!</div>
                  <Sparkles className="h-8 w-8" />
                </div>
                <div className="mt-2 text-white/90 text-base sm:text-lg">Muito bem!</div>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="mg-aud-fireworks" aria-hidden="true" />
                  <span className="mg-aud-fireworks" aria-hidden="true" />
                  <span className="mg-aud-fireworks" aria-hidden="true" />
                </div>
              </div>
            </div>
          )}

          {/* Celebration overlay */}
          <BrandedCongratsDialog
            open={celebrate}
            onOpenChange={setCelebrate}
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
        </div>
      </div>
    </div>
  );
}


