import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Play, Pause, RotateCcw, Check, X, Image as ImageIcon, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { GuessImageGameRow, GuessImageGameItemRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { isApiError } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

// Grid size for revealing tiles
const GRID_COLS = 8;
const GRID_ROWS = 6;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;
const REVEAL_INTERVAL = 200; // ms between revealing each tile

type GameState = "idle" | "revealing" | "paused" | "choosing" | "correct" | "wrong" | "completed";

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function GuessImageGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GuessImageGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Game state
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [tileOrder, setTileOrder] = useState<number[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = auth.user?.role === "admin" || auth.user?.role === "professional";

  // Fetch game data
  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const sid = sessionId ? Number(sessionId) : undefined;
        const g = await api.userGetGuessImageGame(gameId, { session_id: sid });
        if (cancelled) return;
        setGame(g);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e) && e.status === 404) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, sessionId]);

  // Current session item
  const currentItem = useMemo(() => {
    if (!game?.items?.length) return null;
    const sorted = [...game.items].sort((a, b) => a.position - b.position);
    return sorted[currentSessionIndex] ?? null;
  }, [game, currentSessionIndex]);

  // Initialize tile order when session changes
  useEffect(() => {
    const allTiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);
    setTileOrder(shuffleArray(allTiles));
    setRevealedTiles(new Set());
    setRevealIndex(0);
    setGameState("idle");
  }, [currentSessionIndex, game]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Start revealing tiles
  const startRevealing = useCallback(() => {
    setGameState("revealing");
    
    intervalRef.current = setInterval(() => {
      setRevealIndex((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_TILES) {
          // All tiles revealed - auto pause
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setGameState("choosing");
          return prev;
        }
        return next;
      });
    }, REVEAL_INTERVAL);
  }, []);

  // Update revealed tiles when revealIndex changes
  useEffect(() => {
    const newRevealed = new Set(tileOrder.slice(0, revealIndex));
    setRevealedTiles(newRevealed);
  }, [revealIndex, tileOrder]);

  // Pause revealing
  const pauseRevealing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameState("choosing");
  }, []);

  // Reset current session
  const resetSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const allTiles = Array.from({ length: TOTAL_TILES }, (_, i) => i);
    setTileOrder(shuffleArray(allTiles));
    setRevealedTiles(new Set());
    setRevealIndex(0);
    setGameState("idle");
  }, []);

  // Handle option selection
  const handleOptionSelect = useCallback((isCorrect: boolean) => {
    if (isCorrect) {
      setGameState("correct");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      
      // Move to next session after delay
      setTimeout(() => {
        if (game && currentSessionIndex < game.items.length - 1) {
          setCurrentSessionIndex((prev) => prev + 1);
        } else {
          // Game completed
          setGameState("completed");
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.5 },
          });
        }
      }, 1500);
    } else {
      setGameState("wrong");
      toast({
        title: "Ops! Tente novamente",
        description: "Essa não é a resposta correta.",
        variant: "destructive",
      });
      
      // Allow retry after delay
      setTimeout(() => {
        setGameState("choosing");
      }, 1500);
    }
  }, [game, currentSessionIndex, toast]);

  // Render tile grid overlay
  const renderTileGrid = () => {
    const tiles = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const index = row * GRID_COLS + col;
        const isRevealed = revealedTiles.has(index);
        tiles.push(
          <div
            key={index}
            className={cn(
              "absolute transition-all duration-300",
              isRevealed ? "opacity-0" : "opacity-100"
            )}
            style={{
              left: `${(col / GRID_COLS) * 100}%`,
              top: `${(row / GRID_ROWS) * 100}%`,
              width: `${100 / GRID_COLS}%`,
              height: `${100 / GRID_ROWS}%`,
              backdropFilter: isRevealed ? "none" : "blur(20px)",
              backgroundColor: isRevealed ? "transparent" : "rgba(0,0,0,0.3)",
            }}
          />
        );
      }
    }
    return tiles;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-10 w-32 mb-6" />
            <Skeleton className="aspect-video w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <div className="container mx-auto px-4 text-center">
          <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Jogo não encontrado</h1>
          <p className="text-muted-foreground mb-4">Este jogo não existe ou você não tem acesso.</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === "completed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="h-24 w-24 mx-auto text-yellow-500 mb-6 animate-bounce" />
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">Parabéns!</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Você completou todas as {game.sessions_count} sessões!
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => {
              setCurrentSessionIndex(0);
              resetSession();
            }} className="bg-brand-pink hover:bg-brand-pink/90">
              <RotateCcw className="h-4 w-4 mr-2" />
              Jogar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-4 lg:py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="text-center">
            <h1 className="text-lg lg:text-2xl font-display font-bold text-foreground">{game.title}</h1>
            <p className="text-sm text-muted-foreground">
              Sessão {currentSessionIndex + 1} de {game.sessions_count}
            </p>
          </div>
          <div className="w-20" /> {/* Spacer */}
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-pink transition-all duration-500"
              style={{ width: `${((currentSessionIndex) / game.sessions_count) * 100}%` }}
            />
          </div>
        </div>

        {/* Main game area */}
        <div className="max-w-4xl mx-auto">
          {currentItem ? (
            <div className="space-y-6">
              {/* Main image with tile overlay */}
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black">
                <img
                  src={normalizeMediaUrl(currentItem.main_url)}
                  alt="Imagem principal"
                  className="w-full h-full object-contain"
                />
                {/* Tile grid overlay */}
                <div className="absolute inset-0">
                  {renderTileGrid()}
                </div>

                {/* Correct feedback overlay */}
                {gameState === "correct" && (
                  <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                    <div className="bg-green-500 text-white rounded-full p-6 animate-pulse">
                      <Check className="h-16 w-16" />
                    </div>
                  </div>
                )}

                {/* Wrong feedback overlay */}
                {gameState === "wrong" && (
                  <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                    <div className="bg-red-500 text-white rounded-full p-6 animate-shake">
                      <X className="h-16 w-16" />
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                {gameState === "idle" && (
                  <Button
                    size="lg"
                    onClick={startRevealing}
                    className="bg-brand-pink hover:bg-brand-pink/90 text-lg px-8 py-6"
                  >
                    <Play className="h-6 w-6 mr-2" />
                    Iniciar
                  </Button>
                )}

                {gameState === "revealing" && (
                  <Button
                    size="lg"
                    onClick={pauseRevealing}
                    variant="destructive"
                    className="text-lg px-8 py-6"
                  >
                    <Pause className="h-6 w-6 mr-2" />
                    Pare!
                  </Button>
                )}

                {(gameState === "choosing" || gameState === "wrong") && (
                  <Button
                    size="lg"
                    onClick={resetSession}
                    variant="outline"
                    className="text-lg px-8 py-6"
                  >
                    <RotateCcw className="h-6 w-6 mr-2" />
                    Reiniciar
                  </Button>
                )}
              </div>

              {/* Options - show when paused or choosing */}
              {(gameState === "choosing" || gameState === "wrong") && (
                <div className="mt-6">
                  <p className="text-center text-lg font-semibold mb-4">Qual é a imagem correta?</p>
                  <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {/* Randomize option order */}
                    {[
                      { url: currentItem.correct_url, isCorrect: true },
                      { url: currentItem.wrong_url, isCorrect: false },
                    ]
                      .sort(() => Math.random() - 0.5)
                      .map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOptionSelect(option.isCorrect)}
                          disabled={gameState === "wrong"}
                          className={cn(
                            "relative aspect-square rounded-2xl overflow-hidden border-4 transition-all duration-200",
                            "hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-brand-pink/50",
                            gameState === "wrong" ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                            "border-transparent hover:border-brand-pink"
                          )}
                        >
                          <img
                            src={normalizeMediaUrl(option.url)}
                            alt={`Opção ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Correct state - show next button */}
              {gameState === "correct" && currentSessionIndex < game.items.length - 1 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 mb-4">Correto!</p>
                  <Button
                    size="lg"
                    onClick={() => setCurrentSessionIndex((prev) => prev + 1)}
                    className="bg-green-500 hover:bg-green-600 text-lg px-8 py-6"
                  >
                    Próxima sessão
                    <ChevronRight className="h-6 w-6 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma sessão disponível.</p>
            </div>
          )}
        </div>

        {/* Description */}
        {game.description && (
          <div className="max-w-4xl mx-auto mt-8 p-4 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground">{game.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
