import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX, CircleDot } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { SpinWheelGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { cn } from "@/lib/utils";
import FullscreenToggle from "@/components/FullscreenToggle";

export default function SpinWheelGameView() {
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
  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const emitSessionEvent = useCallback((event: any) => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
      }
    } catch {}
  }, [inSession]);

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<SpinWheelGameRow | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Índices (do array original game.items) que ainda estão na roleta (a roleta “diminui” a cada giro)
  const [activeOrder, setActiveOrder] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const autoPseudoFullscreen = inSession && sessionRole === "user";
  const compactForUser = inSession && sessionRole === "user";

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);

  const ensureAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    } catch {
      // ignore
    }
  }, []);

  // Sessão ao vivo: recebe controle + eventos do outro lado
  useEffect(() => {
    if (!inSession) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data: any = ev.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "SESSION_UNLOCK_SFX") {
        void ensureAudio();
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
      if (evt.game !== "spin_wheel") return;

      if (evt.kind === "restart") {
        applyingRemoteRef.current = true;
        try {
          if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
          spinTimeoutRef.current = null;
          setRotation(0);
          setSpinning(false);
          setSelectedIndex(null);
          setActiveOrder(Array.isArray(evt.order) ? evt.order.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)) : []);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }
        return;
      }

      if (evt.kind === "spin") {
        const targetRotation = Number(evt.targetRotation);
        const finalIndex = Number(evt.finalIndex);
        const order = Array.isArray(evt.order) ? evt.order.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)) : null;
        if (!Number.isFinite(targetRotation) || !Number.isFinite(finalIndex)) return;

        applyingRemoteRef.current = true;
        try {
          if (order) setActiveOrder(order);
          setSpinning(true);
          setSelectedIndex(null);
          setRotation(targetRotation);
        } finally {
          window.setTimeout(() => (applyingRemoteRef.current = false), 0);
        }

        // Sons também no usuário durante transmissão (espelha o admin).
        // OBS: pode depender de o navegador liberar áudio para este iframe.
        try {
          let tickCount = 0;
          const maxTicks = 40;
          const tickInterval = window.setInterval(() => {
            tickCount++;
            playTickSound();
            if (tickCount >= maxTicks) window.clearInterval(tickInterval);
          }, 80 + tickCount * 8);
          window.setTimeout(() => window.clearInterval(tickInterval), 6500);
        } catch {}

        if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
        spinTimeoutRef.current = window.setTimeout(() => {
          setSpinning(false);
          setSelectedIndex(finalIndex);
          setActiveOrder((prev) => prev.filter((x) => x !== finalIndex));
          playWinSound();
        }, 6500);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  // Importante: não usar hooks (useMemo) após retornos condicionais (loading/notFound),
  // senão quebra a ordem dos hooks e gera "Minified React error #310" em produção.
  const gameBgUrl = game?.background_url ? normalizeMediaUrl(game.background_url) : null;

  const normalizeDeg = useCallback((deg: number) => {
    const v = deg % 360;
    return v < 0 ? v + 360 : v;
  }, []);

  // Load game data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const isAdmin = auth.user?.role === "admin";
        const data = isAdmin
          ? await api.adminGetSpinWheelGame(Number(id))
          : await api.userGetSpinWheelGame(Number(id), inSession ? { session_id: sessionId } : undefined);
        if (!cancelled) {
          setGame(data);
          setActiveOrder(Array.from({ length: data.items.length }, (_, i) => i));
          setRotation(0);
          setSpinning(false);
          setSelectedIndex(null);
        }
      } catch {
        if (!cancelled) {
          // Dentro da sessão ao vivo, não deve navegar para a dashboard (fica confuso no iframe).
          // Apenas mostra "não encontrado".
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
  }, [id, auth.user]);

  // Reset do jogo ao trocar de roleta
  useEffect(() => {
    if (!game) return;
    setRotation(0);
    setSpinning(false);
    setSelectedIndex(null);
    setActiveOrder(Array.from({ length: game.items.length }, (_, i) => i));
  }, [game?.id]);

  // Sound effects
  const playTickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(600, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.03);
    } catch {}
  }, [soundEnabled]);

  const playWinSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      [523, 659, 784, 1047].forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.25);
        oscillator.start(ctx.currentTime + i * 0.15);
        oscillator.stop(ctx.currentTime + i * 0.15 + 0.25);
      });
    } catch {}
  }, [soundEnabled]);

  // Spin - padrão do print:
  // - seta na ESQUERDA apontando para a roleta
  // - ao parar, o item vencedor fica CENTRALIZADO na direção da seta
  const spinWheel = useCallback(() => {
    if (spinning || !game) return;
    setSpinning(true);
    setSelectedIndex(null);

    const order = activeOrder.slice();
    if (order.length === 0) {
      setSpinning(false);
      return;
    }

    const itemsCount = order.length;
    const segmentAngle = 360 / itemsCount;

    // Convenção do SVG/CSS: 0° = direita, 90° = baixo, 180° = esquerda, 270° = cima
    const pointerAngle = 180; // seta na esquerda

    // Base para distribuir segmentos: o centro do segmento 0 fica alinhado ao ponteiro (esquerda)
    // Isso garante que a palavra/imagem do ponteiro fique HORIZONTAL como no print.
    const baseStartAngle = 180 - segmentAngle / 2;

    // Escolhe uma POSIÇÃO aleatória dentro da roleta atual (que já está reduzida)
    const winnerPos = Math.floor(Math.random() * itemsCount);
    const winnerIndex = order[winnerPos];

    // Centro do segmento vencedor no mesmo referencial do SVG
    const winnerCenterAngle = baseStartAngle + winnerPos * segmentAngle + segmentAngle / 2;

    // Giro "divertido", mas garantindo alinhamento perfeito no fim
    const spins = 5 + Math.random() * 3; // 5-8 voltas completas
    const angleToPointer = pointerAngle - winnerCenterAngle;
    const targetRotation = rotation + spins * 360 + angleToPointer;

    // Já dá pra resolver o vencedor imediatamente (sem depender do timeout)
    const finalRotation = normalizeDeg(targetRotation);
    const t = normalizeDeg(pointerAngle - finalRotation - baseStartAngle);
    const resolvedPos = Math.floor(t / segmentAngle) % itemsCount;
    const finalIndex = order[resolvedPos] ?? winnerIndex;

    if (inSession && sessionRole === "admin" && !applyingRemoteRef.current) {
      emitSessionEvent({ game: "spin_wheel", kind: "spin", order, targetRotation, finalIndex });
    }

    setRotation(targetRotation);

    // Sons de tick durante o giro
    let tickCount = 0;
    const maxTicks = 40;
    const tickInterval = setInterval(() => {
      tickCount++;
      playTickSound();
      if (tickCount >= maxTicks) clearInterval(tickInterval);
    }, 80 + tickCount * 8);

    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);

      // Segurança: índice real apontado pelo ponteiro a partir do ângulo final.
      // Assim o resultado SEMPRE condiz com a seta (mesmo com arredondamentos).
      const finalRotation = normalizeDeg(targetRotation);
      const t = normalizeDeg(pointerAngle - finalRotation - baseStartAngle);
      const resolvedPos = Math.floor(t / segmentAngle) % itemsCount;
      const finalIndex = order[resolvedPos] ?? winnerIndex;
      setSelectedIndex(finalIndex);

      // Remove a opção escolhida e “diminui” a roleta
      setActiveOrder((prev) => prev.filter((x) => x !== finalIndex));
      playWinSound();
    }, 6500);
  }, [spinning, game, rotation, playTickSound, playWinSound, normalizeDeg, activeOrder]);

  const handleRestart = useCallback(() => {
    setRotation(0);
    setSpinning(false);
    setSelectedIndex(null);
    if (game) setActiveOrder(Array.from({ length: game.items.length }, (_, i) => i));
    if (inSession && sessionRole === "admin" && !applyingRemoteRef.current && game) {
      emitSessionEvent({
        game: "spin_wheel",
        kind: "restart",
        order: Array.from({ length: game.items.length }, (_, i) => i),
      });
    }
  }, [game, inSession, sessionRole, emitSessionEvent]);

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-transparent">
        <header className="fs-hide-when-fullscreen sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 lg:py-10">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
              <div className="px-6 sm:px-10 pt-7 sm:pt-10 pb-6 border-b border-border/60 space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
              </div>
              <div className="px-6 sm:px-10 py-8">
                <Skeleton className="h-[52vh] w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Jogo não encontrado</p>
      </div>
    );
  }

  const totalCount = game.items.length;
  const remainingCount = activeOrder.length;
  const renderCount = remainingCount > 0 ? remainingCount : 1;
  const segmentAngle = 360 / renderCount;
  const finished = remainingCount <= 0;
  const defaultColors = [
    "#FFD54F", "#FF7043", "#4DD0E1", "#81C784", "#CE93D8", "#64B5F6",
    "#FFB74D", "#4DB6AC", "#FFF176", "#BA68C8", "#4FC3F7", "#AED581",
  ];

  const wheelSize = compactForUser ? "min(68svh, 78vw, 520px)" : "min(78vw, 560px)";

  return (
    <div ref={containerRef} className="min-h-[100svh] bg-transparent">
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
            <div className="flex items-center gap-2">
              <Badge className="bg-brand-orange text-white shadow-sm hidden sm:flex">
                <CircleDot className="h-3 w-3 mr-1" /> Roleta Musical
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="h-9 w-9">
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className="relative">
        <div className={cn("container mx-auto px-4 py-8 lg:py-10", inSession && "px-0 py-0")}>
          <div className="max-w-5xl mx-auto">
            <div
              ref={fsRef}
              className={cn(
                "fs-target relative rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col",
                // No modo sessão, queremos evitar scroll dentro do iframe.
                compactForUser ? "fs-no-scroll" : "fs-allow-scroll",
              )}
            >
              <FullscreenToggle targetRef={fsRef} className="absolute top-3 right-3 z-30" mode={inSession ? "pseudo" : "auto"} />

              {/* Cabeçalho interno (padrão das atividades) */}
              {!compactForUser ? (
                <div className="px-6 sm:px-10 pt-7 sm:pt-10 pb-6 border-b border-border/60">
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">{game.title}</h1>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                      Clique em <span className="font-semibold text-foreground">GIRAR</span> e faça uma frase/música com a palavra sorteada.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge className="bg-brand-orange/90 text-white shadow-sm">Jogo</Badge>
                    <Badge variant="outline" className="bg-background/60">
                      {totalCount} item(ns)
                    </Badge>
                    <Badge variant="secondary" className="bg-muted/60">
                      Restantes: {remainingCount}
                    </Badge>
                    {game.center_title ? (
                      <Badge variant="secondary" className="bg-muted/60">
                        Centro: {game.center_title}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                </div>
              ) : null}

              {/* Conteúdo (com fundo da atividade) */}
              <div className={cn("relative px-4 sm:px-6 lg:px-10 py-6 sm:py-8", compactForUser && "px-2 sm:px-3 lg:px-3 py-3 sm:py-4")}>
                <div className="relative rounded-3xl border border-border bg-muted/20 overflow-hidden">
                  {/* Fundo específico do jogo (não interfere no fundo global do gameplay) */}
                  <div
                    className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                    style={
                      gameBgUrl
                        ? { backgroundImage: `url(${gameBgUrl})`, opacity: 0.9 }
                        : { opacity: 0 }
                    }
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/40 to-background/55"
                    aria-hidden="true"
                  />

                  {/* Área da roleta centralizada */}
                  <div className={cn("relative z-10 flex flex-col items-center justify-center py-8 sm:py-10", compactForUser && "py-4 sm:py-5")}>
                    <div className="relative flex items-center justify-center">
                      {/* Roleta principal */}
                      <div
                        className="relative rounded-full bg-gradient-to-br from-gray-100 to-white shadow-2xl p-2 sm:p-3"
                        style={{ width: wheelSize, height: wheelSize }}
                      >
                        {/* Anel decorativo externo */}
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
                          <div className="w-full h-full rounded-full bg-white p-1">
                            {/* A roleta que gira */}
                            <svg
                              viewBox="0 0 200 200"
                              className="w-full h-full"
                              style={{
                                transform: `rotate(${rotation}deg)`,
                                transition: spinning ? "transform 6.5s cubic-bezier(0.15, 0.6, 0.2, 1)" : "none",
                              }}
                            >
                              <defs>
                                <clipPath id="wheelImageClip" clipPathUnits="userSpaceOnUse">
                                  <rect x="-16" y="-16" width="32" height="32" rx="4" />
                                </clipPath>
                              </defs>

                              {/* Segmentos da roleta */}
                              {activeOrder.map((originalIndex, pos) => {
                                const item = game.items[originalIndex];
                                const baseStartAngle = 180 - segmentAngle / 2;
                                const startAngle = baseStartAngle + pos * segmentAngle;
                                const endAngle = startAngle + segmentAngle;
                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (endAngle * Math.PI) / 180;

                                const x1 = 100 + 95 * Math.cos(startRad);
                                const y1 = 100 + 95 * Math.sin(startRad);
                                const x2 = 100 + 95 * Math.cos(endRad);
                                const y2 = 100 + 95 * Math.sin(endRad);

                                const largeArc = segmentAngle > 180 ? 1 : 0;
                                const color = item?.color || defaultColors[pos % defaultColors.length];
                                const segmentFill = color;
                                const segmentStroke = "white";
                                const contentOpacity = 1;

                                // Ângulo do meio do segmento para posicionar imagem e texto
                                const midAngle = startAngle + segmentAngle / 2;
                                const midRad = (midAngle * Math.PI) / 180;

                                const rawLabel = (item?.label ?? "").replace(/\s+/g, " ").trim().toUpperCase();

                                // Quebra em até 3 linhas, SEM truncar (mantém 100% do texto).
                                // - Se tiver espaços: quebra por palavras (greedy).
                                // - Se não tiver: quebra em blocos iguais.
                                const wrapLines = (s: string): string[] => {
                                  if (!s) return [""];

                                  const len = s.length;
                                  const targetLines = len <= 12 ? 1 : len <= 22 ? 2 : 3;
                                  const maxPerLine = targetLines === 1 ? 12 : targetLines === 2 ? 11 : 9;

                                  if (!s.includes(" ")) {
                                    const chunk = Math.ceil(len / targetLines);
                                    const parts: string[] = [];
                                    for (let i = 0; i < len; i += chunk) parts.push(s.slice(i, i + chunk));
                                    return parts.slice(0, 3);
                                  }

                                  const words = s.split(" ").filter(Boolean);
                                  const lines: string[] = [];
                                  let current = "";
                                  for (const w of words) {
                                    // palavra muito grande: quebra no meio
                                    const pieces: string[] = [];
                                    if (w.length > maxPerLine) {
                                      for (let i = 0; i < w.length; i += maxPerLine) pieces.push(w.slice(i, i + maxPerLine));
                                    } else {
                                      pieces.push(w);
                                    }

                                    for (const p of pieces) {
                                      const next = current ? `${current} ${p}` : p;
                                      if (next.length <= maxPerLine || !current) {
                                        current = next;
                                      } else {
                                        lines.push(current);
                                        current = p;
                                      }
                                    }
                                  }
                                  if (current) lines.push(current);

                                  // Se estourou 3 linhas, refaz como “sem espaço” para garantir tudo visível.
                                  if (lines.length > 3) {
                                    const compact = s.replace(/ /g, "");
                                    const chunk = Math.ceil(compact.length / 3);
                                    return [compact.slice(0, chunk), compact.slice(chunk, chunk * 2), compact.slice(chunk * 2)].filter(Boolean);
                                  }

                                  return lines;
                                };

                                const lines = wrapLines(rawLabel);
                                const longest = Math.max(1, ...lines.map((x) => x.length));
                                // Fonte adaptativa por comprimento da maior linha (sem “apertar” demais as letras)
                                const fontSize = Math.max(5.2, Math.min(7.4, 8.4 - longest * 0.22));
                                // Campo máximo de texto (em unidades SVG) usado APENAS para comprimir nomes longos.
                                // Se for grande demais, o texto “invade” a imagem; então mantemos menor.
                                const maxTextLen = 40;
                                const lineStep = fontSize * 1.05;
                                const startDy = -(lineStep * (lines.length - 1)) / 2;

                                // “Zona segura” para o texto:
                                // Queremos garantir que NUNCA encoste nem no círculo branco do meio,
                                // nem na imagem do segmento — independentemente do tamanho do nome.
                                const centerCircleR = 24; // precisa bater com o <circle r="24" ... />
                                const centerSafePad = 14; // folga extra para não encostar no branco/stroke
                                const imageHalf = 16; // imagem 32x32 => metade
                                const imageTextGap = 12; // espaço mínimo entre texto e imagem

                                const imgDistance = 78; // posição radial da imagem (fixa)
                                const safeMin = centerCircleR + centerSafePad;
                                const safeMax = imgDistance - imageHalf - imageTextGap;

                                // Coloca o texto no MEIO da faixa segura (distante dos dois lados)
                                const textDistance = (safeMin + Math.max(safeMin + 1, safeMax)) / 2;

                                const imgX = 100 + imgDistance * Math.cos(midRad);
                                const imgY = 100 + imgDistance * Math.sin(midRad);
                                const textX = 100 + textDistance * Math.cos(midRad);
                                const textY = 100 + textDistance * Math.sin(midRad);

                                // Quando a fatia está no ponteiro (180°), fica horizontal;
                                // as demais ficam diagonais, igual ao print.
                                const contentRotate = midAngle - 180;

                                return (
                                  <g key={originalIndex}>
                                    <path
                                      d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                      fill={segmentFill}
                                      stroke={segmentStroke}
                                      strokeWidth="1"
                                    />

                                    <g transform={`translate(${imgX}, ${imgY}) rotate(${contentRotate})`}>
                                      <image
                                        href={item?.image_url ? normalizeMediaUrl(item.image_url) : ""}
                                        x="-16"
                                        y="-16"
                                        width="32"
                                        height="32"
                                        clipPath="url(#wheelImageClip)"
                                        preserveAspectRatio="xMidYMid slice"
                                        opacity={contentOpacity}
                                      />
                                    </g>

                                    <text
                                      x={textX}
                                      y={textY}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      fill="#1f2937"
                                      fontSize={fontSize}
                                      fontWeight="bold"
                                      transform={`rotate(${contentRotate}, ${textX}, ${textY})`}
                                      style={{ textTransform: "uppercase" }}
                                      opacity={contentOpacity}
                                    >
                                      {lines.map((ln, i) => {
                                        const shouldCompress = ln.length >= 10; // só comprime quando realmente precisa
                                        return (
                                        <tspan
                                          key={i}
                                          x={textX}
                                          dy={i === 0 ? startDy : lineStep}
                                          textLength={shouldCompress ? maxTextLen : undefined}
                                          lengthAdjust={shouldCompress ? "spacingAndGlyphs" : undefined}
                                        >
                                          {ln}
                                        </tspan>
                                        );
                                      })}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Centro branco (menor para não cortar texto) */}
                              <circle cx="100" cy="100" r="24" fill="white" stroke="#f59e0b" strokeWidth="3" />
                            </svg>

                            {/* Texto central (não gira) */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] h-[20%] flex items-center justify-center z-10">
                              <p className="text-center text-[9px] sm:text-[11px] font-bold text-gray-700 leading-tight px-1">
                                {game.center_title || "Gire!"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Seta indicadora à ESQUERDA (apontando para a roleta) */}
                      <div className="absolute -left-4 sm:-left-6 z-20">
                        <svg width="50" height="50" viewBox="0 0 50 50" className="drop-shadow-xl">
                          <polygon
                            points="50,25 0,0 10,25 0,50"
                            fill="url(#arrowGradToWheel)"
                            stroke="#374151"
                            strokeWidth="2"
                          />
                          <defs>
                            <linearGradient id="arrowGradToWheel" x1="0%" y1="50%" x2="100%" y2="50%">
                              <stop offset="0%" stopColor="#374151" />
                              <stop offset="100%" stopColor="#6B7280" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    </div>

                    {/* Resultado + CTA */}
                    <div className={cn("mt-6 sm:mt-8 w-full flex flex-col items-center gap-4", compactForUser && "mt-3 sm:mt-4")}>
                      {selectedIndex !== null && game.items[selectedIndex] ? (
                        <div className="w-full max-w-xl">
                          <div className="bg-background/90 backdrop-blur-sm rounded-2xl border border-border shadow-sm px-5 py-4">
                            <div className="flex items-center gap-4">
                              <img
                                src={normalizeMediaUrl(game.items[selectedIndex].image_url)}
                                alt={game.items[selectedIndex].label}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="min-w-0">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Palavra sorteada</div>
                                <div className="text-2xl sm:text-3xl font-black text-brand-orange uppercase truncate">
                                  {game.items[selectedIndex].label}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {(!inSession || sessionRole === "admin") && (
                        <>
                          <Button
                            onClick={spinWheel}
                            disabled={spinning || finished}
                            size="lg"
                            className={cn(
                              "px-12 sm:px-16 py-6 sm:py-7 text-xl sm:text-2xl font-black rounded-full shadow-xl transition-all",
                              spinning
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 hover:scale-110 hover:shadow-2xl",
                            )}
                          >
                            {finished ? "✅ Finalizado" : spinning ? "🎰 Girando..." : "🎯 GIRAR!"}
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleRestart}
                            disabled={spinning || remainingCount === totalCount}
                            className="w-full max-w-xs"
                          >
                            Reiniciar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {!compactForUser ? (
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    {finished
                      ? "Todas as opções já foram sorteadas. Clique em Reiniciar para começar de novo."
                      : "Dica: fale uma frase/música usando a palavra sorteada."}
                  </div>
                ) : null}
              </div>

            {/* Rodapé interno (padrão) */}
            {!compactForUser ? (
              <div className="px-6 sm:px-10 py-4 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                <span>Sementes da Fala • Conteúdo para acompanhamento terapêutico</span>
                <span>Confidencial</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}
