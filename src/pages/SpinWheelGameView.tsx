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
        {/* Container da roleta com seta */}
        <div className="relative flex items-center justify-center">
          {/* Seta indicadora (esquerda) */}
          <div className="absolute -left-2 sm:-left-4 z-20">
            <svg width="50" height="60" viewBox="0 0 50 60" className="drop-shadow-xl">
              <polygon 
                points="0,30 50,5 50,55" 
                fill="url(#arrowGradient)"
                stroke="#374151"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6B7280" />
                  <stop offset="100%" stopColor="#374151" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Roleta */}
          <div 
            className="rounded-full bg-gradient-to-br from-white to-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-2 sm:p-3"
            style={{
              width: "min(85vw, 550px)",
              height: "min(85vw, 550px)",
            }}
          >
            {/* Anel externo decorativo */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-1">
              <div className="w-full h-full rounded-full bg-white p-1">
                {/* Roleta que gira */}
                <div
                  className="w-full h-full rounded-full relative overflow-hidden shadow-inner"
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
                      className="absolute top-0 left-1/2 w-[1px] h-1/2 bg-white/50 origin-bottom"
                      style={{
                        transform: `rotate(${idx * segmentAngle}deg) translateX(-50%)`,
                      }}
                    />
                  ))}

                  {/* Imagens e textos */}
                  {game.items.map((item, idx) => {
                    const midAngle = idx * segmentAngle + segmentAngle / 2;
                    const distance = 36;
                    const rad = (midAngle - 90) * Math.PI / 180;
                    const x = 50 + distance * Math.cos(rad);
                    const y = 50 + distance * Math.sin(rad);
                    
                    return (
                      <div
                        key={`item-${idx}`}
                        className="absolute flex items-center gap-2"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                          transition: spinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                        }}
                      >
                        {/* Imagem maior, sem borda branca */}
                        <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-lg overflow-hidden shadow-lg flex-shrink-0">
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
                        <span className="text-base sm:text-xl font-black text-gray-800 uppercase whitespace-nowrap drop-shadow-sm">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Centro com texto */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] h-[28%] rounded-full bg-gradient-to-br from-white to-gray-50 shadow-xl flex items-center justify-center p-3 sm:p-4 z-10 border-4 border-amber-400">
                  <p className="text-center text-[11px] sm:text-sm font-bold text-gray-700 leading-tight">
                    {game.center_title || "Gire a roleta!"}
                  </p>
                </div>
              </div>
            </div>
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
