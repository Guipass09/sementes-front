import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const auth = useAuth();

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<SpinWheelGameRow | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
          : await api.userGetSpinWheelGame(Number(id));
        if (!cancelled) setGame(data);
      } catch {
        if (!cancelled) navigate("/paciente/jogos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, auth.user]);

  // Sound effects
  const playTickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
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

    const itemsCount = game.items.length;
    const segmentAngle = 360 / itemsCount;

    // Convenção do SVG/CSS: 0° = direita, 90° = baixo, 180° = esquerda, 270° = cima
    const pointerAngle = 180; // seta na esquerda

    // Base para distribuir segmentos: o centro do segmento 0 fica alinhado ao ponteiro (esquerda)
    // Isso garante que a palavra/imagem do ponteiro fique HORIZONTAL como no print.
    const baseStartAngle = 180 - segmentAngle / 2;

    // Escolhe um item aleatório
    const winnerIndex = Math.floor(Math.random() * itemsCount);

    // Centro do segmento vencedor no mesmo referencial do SVG
    const winnerCenterAngle = baseStartAngle + winnerIndex * segmentAngle + segmentAngle / 2;

    // Giro "divertido", mas garantindo alinhamento perfeito no fim
    const spins = 5 + Math.random() * 3; // 5-8 voltas completas
    const angleToPointer = pointerAngle - winnerCenterAngle;
    const targetRotation = rotation + spins * 360 + angleToPointer;

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
      const resolvedIndex = Math.floor(t / segmentAngle) % itemsCount;

      setSelectedIndex(resolvedIndex);
      playWinSound();
    }, 6500);
  }, [spinning, game, rotation, playTickSound, playWinSound, normalizeDeg]);

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

  const itemsCount = game.items.length;
  const segmentAngle = 360 / itemsCount;
  const defaultColors = [
    "#FFD54F", "#FF7043", "#4DD0E1", "#81C784", "#CE93D8", "#64B5F6",
    "#FFB74D", "#4DB6AC", "#FFF176", "#BA68C8", "#4FC3F7", "#AED581",
  ];

  const wheelSize = "min(78vw, 560px)";

  return (
    <div ref={containerRef} className="min-h-[100svh] bg-transparent">
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

      <main className="relative">
        <div className="container mx-auto px-4 py-8 lg:py-10">
          <div className="max-w-5xl mx-auto">
            <div
              ref={fsRef}
              className="fs-target fs-allow-scroll relative rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col"
            >
              <FullscreenToggle targetRef={fsRef} className="absolute top-3 right-3 z-30" />

              {/* Cabeçalho interno (padrão das atividades) */}
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
                      {game.items.length} item(ns)
                    </Badge>
                    {game.center_title ? (
                      <Badge variant="secondary" className="bg-muted/60">
                        Centro: {game.center_title}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Conteúdo (com fundo da atividade) */}
              <div className="relative px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
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
                  <div className="relative z-10 flex flex-col items-center justify-center py-8 sm:py-10">
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
                              {game.items.map((item, idx) => {
                                const baseStartAngle = 180 - segmentAngle / 2;
                                const startAngle = baseStartAngle + idx * segmentAngle;
                                const endAngle = startAngle + segmentAngle;
                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (endAngle * Math.PI) / 180;

                                const x1 = 100 + 95 * Math.cos(startRad);
                                const y1 = 100 + 95 * Math.sin(startRad);
                                const x2 = 100 + 95 * Math.cos(endRad);
                                const y2 = 100 + 95 * Math.sin(endRad);

                                const largeArc = segmentAngle > 180 ? 1 : 0;
                                const color = item.color || defaultColors[idx % defaultColors.length];

                                // Ângulo do meio do segmento para posicionar imagem e texto
                                const midAngle = startAngle + segmentAngle / 2;
                                const midRad = (midAngle * Math.PI) / 180;

                                // Posição da imagem (mais perto da borda)
                                const imgDistance = 76;
                                const imgX = 100 + imgDistance * Math.cos(midRad);
                                const imgY = 100 + imgDistance * Math.sin(midRad);

                                // Texto mais pra dentro para não invadir a imagem
                                const textDistance = 36;
                                const textX = 100 + textDistance * Math.cos(midRad);
                                const textY = 100 + textDistance * Math.sin(midRad);

                                // Quando a fatia está no ponteiro (180°), fica horizontal;
                                // as demais ficam diagonais, igual ao print.
                                const contentRotate = midAngle - 180;

                                const rawLabel = (item.label ?? "").trim().toUpperCase();
                                const label = rawLabel.length > 12 ? `${rawLabel.slice(0, 12)}…` : rawLabel;

                                return (
                                  <g key={idx}>
                                    <path
                                      d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                      fill={color}
                                      stroke="white"
                                      strokeWidth="1"
                                    />

                                    <g transform={`translate(${imgX}, ${imgY}) rotate(${contentRotate})`}>
                                      <image
                                        href={normalizeMediaUrl(item.image_url)}
                                        x="-16"
                                        y="-16"
                                        width="32"
                                        height="32"
                                        clipPath="url(#wheelImageClip)"
                                        preserveAspectRatio="xMidYMid slice"
                                      />
                                    </g>

                                    <text
                                      x={textX}
                                      y={textY}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      fill="#1f2937"
                                      fontSize="7"
                                      fontWeight="bold"
                                      transform={`rotate(${contentRotate}, ${textX}, ${textY})`}
                                      style={{ textTransform: "uppercase" }}
                                    >
                                      {label}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Centro branco */}
                              <circle cx="100" cy="100" r="28" fill="white" stroke="#f59e0b" strokeWidth="3" />
                            </svg>

                            {/* Texto central (não gira) */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] flex items-center justify-center z-10">
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
                    <div className="mt-6 sm:mt-8 w-full flex flex-col items-center gap-4">
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

                      <Button
                        onClick={spinWheel}
                        disabled={spinning}
                        size="lg"
                        className={cn(
                          "px-12 sm:px-16 py-6 sm:py-7 text-xl sm:text-2xl font-black rounded-full shadow-xl transition-all",
                          spinning
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 hover:scale-110 hover:shadow-2xl",
                        )}
                      >
                        {spinning ? "🎰 Girando..." : "🎯 GIRAR!"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Dica: fale uma frase/música usando a palavra sorteada.
                </div>
              </div>

            {/* Rodapé interno (padrão) */}
            <div className="px-6 sm:px-10 py-4 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
              <span>Sementes da Fala • Conteúdo para acompanhamento terapêutico</span>
              <span>Confidencial</span>
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}
