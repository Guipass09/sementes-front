import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX, CircleDot } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const audioContextRef = useRef<AudioContext | null>(null);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="animate-spin h-16 w-16 border-4 border-amber-500 border-t-transparent rounded-full" />
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

  // Tamanho da roleta
  const wheelSize = "min(80vw, 520px)";

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Header compacto */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-amber-200/50 shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0 hover:bg-amber-100">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <img src={logoImage} alt="Sementes da Fala" className="h-8 rounded-lg hidden sm:block" />
            <span className="text-base sm:text-lg font-display font-bold text-amber-600 truncate">
              {game.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 text-white shadow-sm hidden sm:flex">
              <CircleDot className="h-3 w-3 mr-1" /> Roleta
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-8 w-8 hover:bg-amber-100"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <FullscreenToggle targetRef={containerRef} />
          </div>
        </div>
      </header>

      {/* Área principal - roleta centralizada */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Container da roleta com seta à ESQUERDA (igual ao print) */}
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
                      <rect x="-14" y="-14" width="28" height="28" rx="4" />
                    </clipPath>
                  </defs>
                  {/* Segmentos da roleta */}
                  {game.items.map((item, idx) => {
                    // Base para o layout bater com o print:
                    // centro da fatia 0 alinhado com o ponteiro na ESQUERDA.
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
                    const imgDistance = 70;
                    const imgX = 100 + imgDistance * Math.cos(midRad);
                    const imgY = 100 + imgDistance * Math.sin(midRad);
                    
                    // Posição do texto (entre centro e imagem)
                    const textDistance = 43;
                    const textX = 100 + textDistance * Math.cos(midRad);
                    const textY = 100 + textDistance * Math.sin(midRad);

                    // Rotação do conteúdo:
                    // quando a fatia está no ponteiro (180°), fica horizontal;
                    // as demais ficam diagonais, igual ao print.
                    const contentRotate = midAngle - 180;
                    
                    return (
                      <g key={idx}>
                        {/* Segmento colorido */}
                        <path
                          d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={color}
                          stroke="white"
                          strokeWidth="1"
                        />
                        
                        {/* Imagem - padrão do print */}
                        <g transform={`translate(${imgX}, ${imgY}) rotate(${contentRotate})`}>
                          <image
                            href={normalizeMediaUrl(item.image_url)}
                            x="-14"
                            y="-14"
                            width="28"
                            height="28"
                            clipPath="url(#wheelImageClip)"
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </g>
                        
                        {/* Texto - rotacionado para seguir o segmento */}
                        <text
                          x={textX}
                          y={textY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#1f2937"
                          fontSize="8"
                          fontWeight="bold"
                          transform={`rotate(${contentRotate}, ${textX}, ${textY})`}
                          style={{ textTransform: "uppercase" }}
                        >
                          {item.label}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Centro branco */}
                  <circle cx="100" cy="100" r="28" fill="white" stroke="#f59e0b" strokeWidth="3" />
                </svg>

                {/* Texto central (não gira) */}
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] flex items-center justify-center z-10"
                >
                  <p className="text-center text-[9px] sm:text-[11px] font-bold text-gray-700 leading-tight px-1">
                    {game.center_title || "Gire!"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seta indicadora à ESQUERDA */}
          <div className="absolute -left-3 sm:-left-5 z-20">
            <svg width="50" height="50" viewBox="0 0 50 50" className="drop-shadow-xl">
              <polygon 
                points="0,25 50,0 40,25 50,50"
                fill="url(#arrowGradLeft)"
                stroke="#374151"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="arrowGradLeft" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#6B7280" />
                  <stop offset="100%" stopColor="#374151" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Resultado */}
        {selectedIndex !== null && game.items[selectedIndex] && (
          <div className="mt-8 animate-bounce">
            <div className="bg-white rounded-3xl px-8 py-5 shadow-2xl border-4 border-amber-400">
              <div className="flex items-center gap-5">
                <img
                  src={normalizeMediaUrl(game.items[selectedIndex].image_url)}
                  alt={game.items[selectedIndex].label}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div>
                  <p className="text-sm text-gray-500 font-medium">Você tirou:</p>
                  <p className="text-3xl sm:text-4xl font-black text-amber-600 uppercase">
                    {game.items[selectedIndex].label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botão girar */}
        <Button
          onClick={spinWheel}
          disabled={spinning}
          size="lg"
          className={cn(
            "mt-8 px-12 sm:px-16 py-6 sm:py-7 text-xl sm:text-2xl font-black rounded-full shadow-xl transition-all",
            spinning
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 hover:scale-110 hover:shadow-2xl"
          )}
        >
          {spinning ? "🎰 Girando..." : "🎯 GIRAR!"}
        </Button>
      </div>

      {/* Footer com logo */}
      <footer className="py-3 flex justify-center">
        <img src={logoImage} alt="Sementes da Fala" className="h-10 rounded-lg opacity-60" />
      </footer>
    </div>
  );
}
