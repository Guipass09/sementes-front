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
    // Pointer is at 180deg (left), winner segment center should align there
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetRotation = rotation + spins * 360 + (180 - winnerAngle);

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
      {/* Header */}
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

      {/* Info do jogo */}
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

      {/* Área do jogo */}
      <div className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div 
          className="relative rounded-3xl border border-border shadow-sm overflow-hidden"
          style={{ minHeight: "55vh" }}
        >
          {/* Fundo do jogo */}
          {game.background_url ? (
            <img
              src={normalizeMediaUrl(game.background_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100" />
          )}

          {/* Conteúdo */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[55vh] p-4">
            {/* Roleta com seta */}
            <div className="relative flex items-center">
              {/* Seta (esquerda, apontando para direita) */}
              <div className="absolute -left-8 sm:-left-10 z-20 flex items-center">
                <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-lg">
                  <polygon points="0,20 40,5 40,35" fill="#374151" />
                </svg>
              </div>

              {/* Container da roleta */}
              <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px] rounded-full bg-white shadow-2xl p-3 sm:p-4">
                {/* Roleta que gira */}
                <div
                  className="w-full h-full rounded-full relative"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                  }}
                >
                  {/* Segmentos */}
                  {game.items.map((item, idx) => {
                    const color = item.color || defaultColors[idx % defaultColors.length];
                    const startAngle = idx * segmentAngle;
                    
                    return (
                      <div
                        key={idx}
                        className="absolute inset-0"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segmentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segmentAngle - 90) * Math.PI / 180)}%)`,
                          backgroundColor: color,
                        }}
                      />
                    );
                  })}
                  
                  {/* Linhas divisórias */}
                  {game.items.map((_, idx) => (
                    <div
                      key={`line-${idx}`}
                      className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-white origin-bottom"
                      style={{
                        transform: `rotate(${idx * segmentAngle}deg) translateX(-50%)`,
                      }}
                    />
                  ))}

                  {/* Imagens e textos - CONTRA-ROTACIONAM para ficarem horizontais */}
                  {game.items.map((item, idx) => {
                    const midAngle = idx * segmentAngle + segmentAngle / 2;
                    const distance = 38; // % do centro
                    const rad = (midAngle - 90) * Math.PI / 180;
                    const x = 50 + distance * Math.cos(rad);
                    const y = 50 + distance * Math.sin(rad);
                    
                    return (
                      <div
                        key={`item-${idx}`}
                        className="absolute flex items-center gap-1"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                          transition: spinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                        }}
                      >
                        {/* Imagem */}
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-md overflow-hidden bg-white shadow-md flex-shrink-0">
                          <img
                            src={normalizeMediaUrl(item.image_url)}
                            alt={item.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        {/* Texto */}
                        <span className="text-sm sm:text-base font-bold text-gray-800 uppercase whitespace-nowrap">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Centro fixo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26%] h-[26%] rounded-full bg-white shadow-lg flex items-center justify-center p-2 sm:p-3 z-10">
                  <p className="text-center text-[9px] sm:text-xs font-semibold text-gray-700 leading-tight">
                    {game.center_title || "Gire a roleta!"}
                  </p>
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
                        e.currentTarget.style.display = 'none';
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

      {/* Footer */}
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
