import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { SpinWheelGameRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { cn } from "@/lib/utils";
import logoSementes from "@/assets/logo-sementes-da-fala.jpg";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Fullscreen handler
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
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
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);

        oscillator.start(ctx.currentTime + i * 0.1);
        oscillator.stop(ctx.currentTime + i * 0.1 + 0.2);
      });
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled]);

  // Spin the wheel
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
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetRotation = rotation + spins * 360 + (270 - winnerAngle);

    setRotation(targetRotation);

    // Play tick sounds during spin
    let tickCount = 0;
    const maxTicks = 60;
    const tickInterval = setInterval(() => {
      tickCount++;
      playTickSound();
      if (tickCount >= maxTicks) {
        clearInterval(tickInterval);
      }
    }, 50 + tickCount * 2); // Gradually slow down ticks

    // Reveal winner after animation
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setSelectedIndex(winnerIndex);
      playWinSound();
    }, 4000);
  }, [spinning, game, rotation, playTickSound, playWinSound]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="animate-spin h-12 w-12 border-4 border-brand-orange border-t-transparent rounded-full" />
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

  // Default colors if not provided
  const defaultColors = [
    "#FFD700", "#FF6B6B", "#4ECDC4", "#96CEB4", "#DDA0DD", "#87CEEB",
    "#F4A460", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#82E0AA",
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{
        background: game.background_url
          ? `url(${normalizeMediaUrl(game.background_url)}) center/cover`
          : "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FCD34D 100%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="bg-white/80 hover:bg-white shadow-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-white/80 px-4 py-2 rounded-full shadow-md font-mono text-lg font-bold">
            {formatTime(elapsedTime)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="bg-white/80 hover:bg-white shadow-md"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="bg-white/80 hover:bg-white shadow-md"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Pointer (left side) */}
        <div className="absolute left-[calc(50%-220px)] sm:left-[calc(50%-260px)] md:left-[calc(50%-300px)] z-20">
          <div className="w-0 h-0 border-t-[20px] border-t-transparent border-b-[20px] border-b-transparent border-l-[40px] border-l-white drop-shadow-lg" 
               style={{ filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.3))" }} />
        </div>

        {/* Wheel container */}
        <div className="relative w-[400px] h-[400px] sm:w-[480px] sm:h-[480px] md:w-[560px] md:h-[560px]">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full bg-white shadow-2xl p-3">
            {/* Wheel */}
            <div
              className="w-full h-full rounded-full relative overflow-hidden transition-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? "4s" : "0s",
                transitionTimingFunction: "cubic-bezier(0.17, 0.67, 0.12, 0.99)",
              }}
            >
              {/* SVG wheel segments */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {game.items.map((item, idx) => {
                  const startAngle = idx * segmentAngle - 90;
                  const endAngle = startAngle + segmentAngle;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;

                  const x1 = 50 + 50 * Math.cos(startRad);
                  const y1 = 50 + 50 * Math.sin(startRad);
                  const x2 = 50 + 50 * Math.cos(endRad);
                  const y2 = 50 + 50 * Math.sin(endRad);

                  const largeArc = segmentAngle > 180 ? 1 : 0;
                  const pathD = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  const color = item.color || defaultColors[idx % defaultColors.length];

                  // Position for image and text (middle of segment)
                  const midAngle = startAngle + segmentAngle / 2;
                  const midRad = (midAngle * Math.PI) / 180;
                  const imgDist = 32; // Distance from center for image
                  const textDist = 38; // Distance from center for text
                  const imgX = 50 + imgDist * Math.cos(midRad);
                  const imgY = 50 + imgDist * Math.sin(midRad);

                  return (
                    <g key={idx}>
                      <path d={pathD} fill={color} stroke="white" strokeWidth="0.5" />
                      {/* Image */}
                      <image
                        href={normalizeMediaUrl(item.image_url)}
                        x={imgX - 8}
                        y={imgY - 8}
                        width="16"
                        height="16"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`inset(0 round 2)`}
                        transform={`rotate(${midAngle + 90}, ${imgX}, ${imgY})`}
                      />
                      {/* Text along the segment */}
                      <text
                        x={50 + textDist * Math.cos(midRad)}
                        y={50 + textDist * Math.sin(midRad)}
                        fill="#333"
                        fontSize="3.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${midAngle + 90}, ${50 + textDist * Math.cos(midRad)}, ${50 + textDist * Math.sin(midRad)})`}
                        style={{ textTransform: "uppercase" }}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center circle with text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-white shadow-lg flex items-center justify-center p-4">
              <p className="text-center text-xs sm:text-sm font-semibold text-gray-700 leading-tight">
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
            "mt-8 px-12 py-6 text-xl font-bold rounded-full shadow-lg transition-all",
            spinning
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-105"
          )}
        >
          {spinning ? "Girando..." : "Girar"}
        </Button>

        {/* Winner display */}
        {selectedIndex !== null && game.items[selectedIndex] && (
          <div className="mt-6 animate-bounce">
            <div className="bg-white/95 backdrop-blur rounded-2xl px-8 py-6 shadow-2xl border-4 border-amber-400">
              <div className="flex items-center gap-4">
                <img
                  src={normalizeMediaUrl(game.items[selectedIndex].image_url)}
                  alt={game.items[selectedIndex].label}
                  className="w-20 h-20 rounded-xl object-cover shadow-md"
                />
                <div>
                  <p className="text-sm text-muted-foreground">Você tirou:</p>
                  <p className="text-3xl font-bold text-amber-600 uppercase">
                    {game.items[selectedIndex].label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with logo */}
      <div className="p-4 flex justify-center">
        <img
          src={logoSementes}
          alt="Sementes da Fala"
          className="h-12 rounded-lg shadow-md"
        />
      </div>
    </div>
  );
}
