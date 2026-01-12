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

  // Spin the wheel
  const spinWheel = useCallback(() => {
    if (spinning || !game) return;
    setSpinning(true);
    setSelectedIndex(null);

    const itemsCount = game.items.length;
    const segmentAngle = 360 / itemsCount;
    const winnerIndex = Math.floor(Math.random() * itemsCount);
    const spins = 4 + Math.random() * 2;
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetRotation = rotation + spins * 360 + (270 - winnerAngle);

    setRotation(targetRotation);

    let tickCount = 0;
    const maxTicks = 35;
    const tickInterval = setInterval(() => {
      tickCount++;
      playTickSound();
      if (tickCount >= maxTicks) clearInterval(tickInterval);
    }, 100 + tickCount * 5);

    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setSelectedIndex(winnerIndex);
      playWinSound();
    }, 6000);
  }, [spinning, game, rotation, playTickSound, playWinSound]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full" />
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
    "#FFD700", "#FF6B6B", "#4ECDC4", "#96CEB4", "#DDA0DD", "#87CEEB",
    "#F4A460", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#82E0AA",
  ];

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-background">
      {/* Header - igual às atividades */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <img src={logoImage} alt="Sementes da Fala" className="h-8 sm:h-10 rounded-lg hidden sm:block" />
            <span className="text-lg sm:text-xl font-display font-bold text-brand-green truncate">
              Sementes <span className="text-foreground">da Fala</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-9 w-9"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            <FullscreenToggle targetRef={containerRef} />
          </div>
        </div>
      </header>

      {/* Info do jogo - igual às atividades */}
      <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 border-b border-border/40 bg-gradient-to-b from-muted/30 to-transparent">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
          {game.title}
        </h1>
        {game.center_title && (
          <p className="text-muted-foreground mt-2 leading-relaxed">{game.center_title}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Badge className="bg-amber-500 text-white shadow-sm">
            <span className="inline-flex items-center gap-1">
              <CircleDot className="h-3.5 w-3.5" /> Roleta
            </span>
          </Badge>
          <Badge variant="outline" className="bg-background/60">
            {itemsCount} itens
          </Badge>
        </div>
      </div>

      {/* Área do jogo - com imagem de fundo */}
      <div className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div 
          className="relative rounded-3xl border border-border bg-gradient-to-b from-background to-muted/30 shadow-sm overflow-hidden"
          style={{
            minHeight: "60vh",
          }}
        >
          {/* Imagem de fundo do jogo */}
          {game.background_url && (
            <img
              src={normalizeMediaUrl(game.background_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Overlay para legibilidade */}
          <div className="absolute inset-0 bg-white/60" />

          {/* Conteúdo centralizado */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] p-4">
            {/* Container da roleta com seta */}
            <div className="relative flex items-center">
              {/* Seta indicadora (esquerda) */}
              <div className="absolute -left-6 sm:-left-8 z-20">
                <div 
                  className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[24px] border-l-gray-700 sm:border-t-[16px] sm:border-b-[16px] sm:border-l-[32px]"
                  style={{ filter: "drop-shadow(2px 0 3px rgba(0,0,0,0.2))" }} 
                />
              </div>

              {/* Roleta */}
              <div className="w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] md:w-[450px] md:h-[450px] rounded-full bg-white shadow-2xl p-2 sm:p-3">
                <div
                  className="w-full h-full rounded-full relative overflow-hidden"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                  }}
                >
                  {/* SVG com segmentos, imagens e textos */}
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {game.items.map((item, idx) => {
                      const startAngle = idx * segmentAngle - 90;
                      const endAngle = startAngle + segmentAngle;
                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;
                      
                      const x1 = 100 + 100 * Math.cos(startRad);
                      const y1 = 100 + 100 * Math.sin(startRad);
                      const x2 = 100 + 100 * Math.cos(endRad);
                      const y2 = 100 + 100 * Math.sin(endRad);
                      
                      const largeArc = segmentAngle > 180 ? 1 : 0;
                      const pathD = `M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      const color = item.color || defaultColors[idx % defaultColors.length];
                      
                      // Posição no meio do segmento
                      const midAngle = startAngle + segmentAngle / 2;
                      const midRad = (midAngle * Math.PI) / 180;
                      
                      // Imagem perto da borda (distância 75 do centro)
                      const imgDist = 75;
                      const imgX = 100 + imgDist * Math.cos(midRad);
                      const imgY = 100 + imgDist * Math.sin(midRad);
                      
                      // Texto mais para dentro (distância 50 do centro)
                      const textDist = 50;
                      const textX = 100 + textDist * Math.cos(midRad);
                      const textY = 100 + textDist * Math.sin(midRad);
                      
                      return (
                        <g key={idx}>
                          {/* Segmento colorido */}
                          <path d={pathD} fill={color} stroke="white" strokeWidth="1" />
                          
                          {/* Imagem - perto da borda */}
                          <foreignObject
                            x={imgX - 15}
                            y={imgY - 15}
                            width="30"
                            height="30"
                            transform={`rotate(${midAngle + 90}, ${imgX}, ${imgY})`}
                          >
                            <div className="w-full h-full rounded bg-white shadow-sm overflow-hidden">
                              <img
                                src={normalizeMediaUrl(item.image_url)}
                                alt={item.label}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            </div>
                          </foreignObject>
                          
                          {/* Texto - em direção ao centro */}
                          <text
                            x={textX}
                            y={textY}
                            fill="#222"
                            fontSize="8"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                            style={{ textTransform: "uppercase", fontFamily: "system-ui, sans-serif" }}
                          >
                            {item.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Centro da roleta */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] h-[28%] rounded-full bg-white shadow-lg flex items-center justify-center p-2 sm:p-3">
                    <p className="text-center text-[9px] sm:text-xs font-semibold text-gray-700 leading-tight">
                      {game.center_title || "Gire a roleta!"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resultado */}
            {selectedIndex !== null && game.items[selectedIndex] && (
              <div className="mt-6 animate-bounce">
                <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border-4 border-amber-400">
                  <div className="flex items-center gap-4">
                    <img
                      src={normalizeMediaUrl(game.items[selectedIndex].image_url)}
                      alt={game.items[selectedIndex].label}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-md"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Você tirou:</p>
                      <p className="text-2xl sm:text-3xl font-bold text-amber-600 uppercase">
                        {game.items[selectedIndex].label}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instrução */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Instrução</p>
            <p className="text-sm sm:text-base font-medium text-foreground">
              {game.center_title || "Gire a roleta e veja o resultado!"}
            </p>
          </div>
        </div>
      </div>

      {/* Footer - igual às atividades */}
      <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t border-border/60 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={spinWheel}
            disabled={spinning}
            size="lg"
            className={cn(
              "px-8 sm:px-12 py-3 text-lg font-bold rounded-full shadow-lg transition-all min-w-[160px]",
              spinning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-105"
            )}
          >
            {spinning ? "Girando..." : "Girar"}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Clique no botão para girar a roleta
        </p>
      </footer>
    </div>
  );
}
