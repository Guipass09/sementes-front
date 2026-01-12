import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { SpinWheelGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { cn } from "@/lib/utils";
import logoSementes from "@/assets/logo-sementes-da-fala.jpg";
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
  const [elapsedTime, setElapsedTime] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.03);
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled]);

  const playWinSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Play a celebratory sequence
      [523, 659, 784, 1047].forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);

        oscillator.start(ctx.currentTime + i * 0.15);
        oscillator.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled]);

  // Spin the wheel - SLOWER animation (6 seconds)
  const spinWheel = useCallback(() => {
    if (spinning || !game) return;

    setSpinning(true);
    setSelectedIndex(null);

    const itemsCount = game.items.length;
    const segmentAngle = 360 / itemsCount;

    // Random winner
    const winnerIndex = Math.floor(Math.random() * itemsCount);

    // Calculate final rotation (multiple spins + land on winner)
    // The pointer is on the left (270deg), so we need to position the winner there
    const spins = 4 + Math.random() * 2; // 4-6 full rotations (slower)
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetRotation = rotation + spins * 360 + (270 - winnerAngle);

    setRotation(targetRotation);

    // Play tick sounds during spin (slower rate)
    let tickCount = 0;
    const maxTicks = 40;
    const tickInterval = setInterval(() => {
      tickCount++;
      playTickSound();
      if (tickCount >= maxTicks) {
        clearInterval(tickInterval);
      }
    }, 80 + tickCount * 4); // Slower ticks

    // Reveal winner after animation (6 seconds)
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

  // Default colors
  const defaultColors = [
    "#FFD700", "#FF6B6B", "#4ECDC4", "#96CEB4", "#DDA0DD", "#87CEEB",
    "#F4A460", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#82E0AA",
  ];

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 relative z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="bg-white/90 hover:bg-white shadow-md rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-white/90 px-4 py-2 rounded-xl shadow-md font-mono text-lg font-bold">
            {formatTime(elapsedTime)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="bg-white/90 hover:bg-white shadow-md rounded-xl"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <FullscreenToggle targetRef={containerRef} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 relative z-10">
        {/* Game area with optional background */}
        <div 
          className="relative w-full max-w-3xl mx-auto flex flex-col items-center justify-center rounded-3xl p-4 sm:p-8"
          style={{
            background: game.background_url 
              ? `url(${normalizeMediaUrl(game.background_url)}) center/cover`
              : "transparent",
          }}
        >
          {/* Wheel container */}
          <div className="relative flex items-center justify-center">
            {/* Pointer (left side) */}
            <div className="absolute -left-4 sm:-left-6 z-30">
              <div 
                className="w-0 h-0 border-t-[15px] border-t-transparent border-b-[15px] border-b-transparent border-l-[30px] border-l-white sm:border-t-[20px] sm:border-b-[20px] sm:border-l-[40px]"
                style={{ filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.3))" }} 
              />
            </div>

            {/* Outer ring */}
            <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px] rounded-full bg-white shadow-2xl p-2 sm:p-3">
              {/* Wheel */}
              <div
                className="w-full h-full rounded-full relative overflow-hidden"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                }}
              >
                {/* Segments using CSS conic gradient + positioned elements */}
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(${game.items.map((item, idx) => {
                      const color = item.color || defaultColors[idx % defaultColors.length];
                      const start = (idx / itemsCount) * 100;
                      const end = ((idx + 1) / itemsCount) * 100;
                      return `${color} ${start}% ${end}%`;
                    }).join(", ")})`,
                  }}
                />
                
                {/* Segment dividers */}
                {game.items.map((_, idx) => {
                  const angle = idx * segmentAngle;
                  return (
                    <div
                      key={`divider-${idx}`}
                      className="absolute top-1/2 left-1/2 h-1/2 w-[2px] bg-white origin-top"
                      style={{
                        transform: `rotate(${angle}deg) translateX(-50%)`,
                      }}
                    />
                  );
                })}

                {/* Items (image + label) */}
                {game.items.map((item, idx) => {
                  const angle = idx * segmentAngle + segmentAngle / 2 - 90;
                  const distance = 38; // % from center
                  
                  return (
                    <div
                      key={item.id}
                      className="absolute flex flex-col items-center gap-1"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: `
                          rotate(${angle}deg) 
                          translateY(-${distance}%) 
                          rotate(${-angle}deg)
                          translate(-50%, -50%)
                        `,
                      }}
                    >
                      {/* Image */}
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg overflow-hidden shadow-md bg-white">
                        <img
                          src={normalizeMediaUrl(item.image_url)}
                          alt={item.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      {/* Label */}
                      <span 
                        className="text-[10px] sm:text-xs font-bold text-gray-800 uppercase text-center max-w-[60px] sm:max-w-[80px] leading-tight bg-white/80 px-1 rounded"
                        style={{ textShadow: "0 0 2px white" }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Center circle with text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] h-[25%] rounded-full bg-white shadow-lg flex items-center justify-center p-2 sm:p-4 z-10">
                <p className="text-center text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 leading-tight">
                  {game.center_title || "Gire a roleta!"}
                </p>
              </div>
            </div>
          </div>

          {/* Spin button */}
          <Button
            onClick={spinWheel}
            disabled={spinning}
            className={cn(
              "mt-6 sm:mt-8 px-8 sm:px-12 py-4 sm:py-6 text-lg sm:text-xl font-bold rounded-full shadow-lg transition-all",
              spinning
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-105"
            )}
          >
            {spinning ? "Girando..." : "Girar"}
          </Button>

          {/* Winner display */}
          {selectedIndex !== null && game.items[selectedIndex] && (
            <div className="mt-4 sm:mt-6 animate-bounce">
              <div className="bg-white/95 backdrop-blur rounded-2xl px-6 sm:px-8 py-4 sm:py-6 shadow-2xl border-4 border-amber-400">
                <div className="flex items-center gap-3 sm:gap-4">
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
      </div>

      {/* Footer with logo */}
      <div className="p-4 flex justify-center relative z-10">
        <img
          src={logoSementes}
          alt="Sementes da Fala"
          className="h-10 sm:h-12 rounded-lg shadow-md"
        />
      </div>
    </div>
  );
}
