import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, RotateCcw } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import type { WordSearchGameRow } from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type Role = "admin" | "user";

export default function WordSearchGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as Role | "";
  const sessionId = useMemo(() => {
    const n = Number(sessionParams.get("session_id"));
    return Number.isFinite(n) ? n : null;
  }, [sessionParams]);

  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<WordSearchGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [foundWords, setFoundWords] = useState<Set<number>>(new Set());
  const [foundImages, setFoundImages] = useState<Set<number>>(new Set());
  const [pendingWordId, setPendingWordId] = useState<number | null>(null); // palavra encontrada, aguardando imagem
  const [shakeImageId, setShakeImageId] = useState<number | null>(null);
  const [removedCells, setRemovedCells] = useState<Set<string>>(new Set()); // "row-col"
  const [lock, setLock] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const fsRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const autoPseudoFullscreen = inSession && sessionRole === "user";

  useEffect(() => {
    if (!authLoading && !user) navigate("/entrar");
  }, [authLoading, user, navigate]);

  // Sessão ao vivo (usuário): pseudo fullscreen automático
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

  useEffect(() => {
    if (!user) return;
    if (!gameId) {
      setNotFound(true);
      setForbidden(false);
      setGame(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      try {
        const g =
          user.role === "admin"
            ? await api.adminGetWordSearchGame(gameId)
            : await api.userGetWordSearchGame(gameId, inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(g);
        // Restaura progresso se existir
        if (g.progress) {
          const p = g.progress as any;
          if (p.found_words) setFoundWords(new Set(p.found_words));
          if (p.found_images) setFoundImages(new Set(p.found_images));
        }
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        }
        setGame(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, user, navigate, inSession, sessionId]);

  const emitSessionEvent = (event: any) => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
      }
    } catch {}
  };

  // Sessão: recebe controle e eventos
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

      applyingRemoteRef.current = true;
      try {
        if (evt.kind === "reset") {
          setFoundWords(new Set());
          setFoundImages(new Set());
          setPendingWordId(null);
          setShakeImageId(null);
          setRemovedCells(new Set());
          setLock(false);
          setCelebrate(false);
          return;
        }
        if (evt.kind === "word_found" && typeof evt.wordId === "number") {
          setFoundWords((prev) => new Set([...prev, evt.wordId]));
          setPendingWordId(evt.wordId);
          return;
        }
        if (evt.kind === "image_correct" && typeof evt.wordId === "number") {
          setFoundImages((prev) => {
            const next = new Set([...prev, evt.wordId]);
            // Verifica se todas palavras E imagens foram encontradas
            if (game && game.items) {
              const allWordsFound = game.items.every((it) => foundWords.has(it.id));
              const allImagesFound = game.items.every((it) => next.has(it.id));
              if (allWordsFound && allImagesFound) {
                setCelebrate(true);
              }
            }
            return next;
          });
          setPendingWordId(null);
          return;
        }
        if (evt.kind === "image_wrong" && typeof evt.imageId === "number") {
          setShakeImageId(evt.imageId);
          window.setTimeout(() => setShakeImageId(null), 650);
          return;
        }
        if (evt.kind === "cell_removed" && typeof evt.row === "number" && typeof evt.col === "number") {
          setRemovedCells((prev) => new Set([...prev, `${evt.row}-${evt.col}`]));
          return;
        }
      } finally {
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole, game, foundWords, foundImages]);

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(false), 2500);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  const gridData = game?.grid_data;
  const grid = gridData?.grid || [];
  const gridSize = gridData?.size || 10;

  // Retorna todas as posições de uma palavra
  const getWordPositions = (item: any): Array<{ r: number; c: number }> => {
    const positions: Array<{ r: number; c: number }> = [];
    const wordLen = item.word.length;
    if (item.direction === "horizontal") {
      for (let i = 0; i < wordLen; i++) {
        positions.push({ r: item.start_row, c: item.start_col + i });
      }
    } else {
      for (let i = 0; i < wordLen; i++) {
        positions.push({ r: item.start_row + i, c: item.start_col });
      }
    }
    return positions;
  };

  // Verifica se uma célula (row, col) faz parte de uma palavra encontrada
  const isCellInFoundWord = (row: number, col: number): boolean => {
    if (!game || !game.items) return false;
    for (const item of game.items) {
      if (!foundWords.has(item.id)) continue;
      const positions = getWordPositions(item);
      if (positions.some((p) => p.r === row && p.c === col)) {
        return true;
      }
    }
    return false;
  };

  // Encontra palavra que contém a célula (row, col) - apenas palavras não encontradas
  // Verifica também se a letra na célula corresponde à palavra (para evitar falsos positivos)
  const findWordAtCell = (row: number, col: number): { item: any; positions: Array<{ r: number; c: number }> } | null => {
    if (!game || !game.items || !grid || grid.length === 0) return null;
    const cellChar = grid[row]?.[col];
    if (!cellChar) return null; // célula vazia ou inválida
    
    for (const item of game.items) {
      if (foundWords.has(item.id)) continue;
      const positions = getWordPositions(item);
      // Verifica se a célula faz parte das posições da palavra
      const cellPosition = positions.findIndex((p) => p.r === row && p.c === col);
      if (cellPosition === -1) continue; // célula não faz parte desta palavra
      
      // CRÍTICO: Verifica se a letra na célula corresponde à letra esperada na palavra
      // Isso previne falsos positivos quando palavras compartilham células
      const expectedChar = item.word[cellPosition];
      if (expectedChar && expectedChar.toUpperCase() !== cellChar.toUpperCase()) {
        continue; // letra não corresponde - palavra diferente
      }
      
      return { item, positions };
    }
    return null;
  };

  const onCellClick = (row: number, col: number) => {
    if (lock) return;
    if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;
    if (pendingWordId !== null) return; // aguardando escolher imagem - não pode clicar em mais letras
    const key = `${row}-${col}`;
    
    // Primeiro verifica se já está em uma palavra encontrada - não faz nada
    if (isCellInFoundWord(row, col)) {
      return; // célula já faz parte de palavra encontrada
    }

    // Verifica se a célula faz parte de uma palavra válida (não encontrada ainda)
    const wordAtCell = findWordAtCell(row, col);
    if (wordAtCell) {
      // Palavra encontrada! Ao clicar em QUALQUER letra da palavra, TODAS as letras ficam verdes
      playCorrect();
      // Remove a célula de removedCells se estava lá (caso tenha sido marcada como errada antes)
      setRemovedCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      // Marca a palavra como encontrada - isso fará TODAS as letras ficarem verdes via isCellInFoundWord
      setFoundWords((prev) => new Set([...prev, wordAtCell.item.id]));
      setPendingWordId(wordAtCell.item.id); // agora precisa escolher a imagem correspondente
      if (inSession) {
        emitSessionEvent({ kind: "word_found", wordId: wordAtCell.item.id });
      }
    } else {
      // Letra errada - só remove se não estiver já removida
      if (!removedCells.has(key)) {
        playWrong();
        setRemovedCells((prev) => new Set([...prev, key]));
        if (inSession) {
          emitSessionEvent({ kind: "cell_removed", row, col });
        }
      }
    }
  };

  const onImageClick = (itemId: number) => {
    if (lock) return;
    if (inSession && sessionRole === "user" && !controlAllowedRef.current) return;
    if (pendingWordId === null) return; // nenhuma palavra pendente - só pode escolher imagem após acertar palavra
    if (foundImages.has(itemId)) return; // imagem já foi acertada

    if (pendingWordId === itemId) {
      // Imagem correta!
      playCorrect();
      setFoundImages((prev) => new Set([...prev, itemId]));
      setPendingWordId(null);
      
      // Verifica se todas palavras E imagens foram encontradas
      if (game && game.items) {
        const allWordsFound = game.items.every((it) => foundWords.has(it.id));
        const allImagesFound = game.items.every((it) => foundImages.has(it.id) || it.id === itemId);
        if (allWordsFound && allImagesFound) {
          setCelebrate(true);
        }
      }
      if (inSession) {
        emitSessionEvent({ kind: "image_correct", wordId: itemId });
      }
    } else {
      // Imagem errada - animação de erro e continua esperando
      playWrong();
      setShakeImageId(itemId);
      window.setTimeout(() => setShakeImageId(null), 650);
      if (inSession) {
        emitSessionEvent({ kind: "image_wrong", imageId: itemId });
      }
    }
  };

  const doReset = () => {
    setFoundWords(new Set());
    setFoundImages(new Set());
    setPendingWordId(null);
    setShakeImageId(null);
    setRemovedCells(new Set());
    setLock(false);
    setCelebrate(false);
    if (inSession && sessionRole === "admin") emitSessionEvent({ kind: "reset" });
  };

  return (
    <div className="min-h-[100svh] bg-transparent">
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
                  <span className="text-brand-green">Sementes</span> <span className="text-brand-brown">da Fala</span>
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="relative">
        <div className={cn("container mx-auto px-4 py-6 lg:py-8", inSession && "px-0 py-0")}>
          <div className="max-w-6xl mx-auto">
            <div ref={fsRef} className="fs-target rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
              <div ref={headerRef} className="px-6 sm:px-10 pt-7 sm:pt-9 pb-5 border-b border-border/60">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : game ? (
                  <div className="flex flex-col gap-2">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">{game.title}</h1>
                    <p className="fs-hide-in-fs text-muted-foreground leading-relaxed">{game.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(!inSession || sessionRole === "admin") && (
                        <Button variant="secondary" onClick={doReset}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reiniciar
                        </Button>
                      )}
                      <FullscreenToggle targetRef={fsRef} className="ml-auto" mode={inSession ? "pseudo" : "auto"} />
                    </div>
                  </div>
                ) : notFound ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Jogo não encontrado</h1>
                    <p className="text-muted-foreground">Esse jogo não existe (ou foi removido).</p>
                  </div>
                ) : forbidden ? (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Acesso negado</h1>
                    <p className="text-muted-foreground">Você não tem permissão para acessar este jogo.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h1 className="text-xl font-display font-bold text-foreground">Não foi possível carregar</h1>
                    <p className="text-muted-foreground">Tente novamente em alguns instantes.</p>
                  </div>
                )}
              </div>

              <div ref={bodyRef} className="p-2 sm:p-4 lg:p-6 flex-1 fs-fit">
                {loading ? (
                  <Skeleton className="h-[60vh] w-full rounded-2xl" />
                ) : game && grid.length > 0 ? (
                  <div className="relative w-full h-[55vh] sm:h-[62vh] lg:h-[70vh] rounded-xl sm:rounded-2xl overflow-hidden border border-border">
                    <img src={normalizeMediaUrl(game.background_url)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95" />
                    <div className="absolute inset-0 bg-black/20" />

                    {/* Grid e Imagens lado a lado */}
                    <div className="relative h-full flex flex-col lg:flex-row gap-3 p-3 sm:p-4">
                      {/* Grid de letras (menor, à esquerda) */}
                      <div className="flex-1 lg:flex-[2] flex items-center justify-center min-w-0">
                        <div
                          className="grid gap-0.5 sm:gap-1 backdrop-blur-sm p-2 sm:p-3 rounded-lg shadow-lg"
                          style={{
                            backgroundColor: game.grid_background_color ? `${game.grid_background_color}CC` : undefined,
                          }}
                          style={{
                            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                            maxWidth: "100%",
                            maxHeight: "100%",
                          }}
                        >
                          {grid.map((row, rIdx) =>
                            row.map((char, cIdx) => {
                              const key = `${rIdx}-${cIdx}`;
                              const isRemoved = removedCells.has(key);
                              const isInFoundWord = isCellInFoundWord(rIdx, cIdx); // TODAS as letras da palavra encontrada
                              const maxSize = Math.min(
                                Math.floor((window.innerWidth * 0.45) / gridSize),
                                Math.floor((window.innerHeight * 0.6) / gridSize),
                              );
                              // Aumentar mais o tamanho das letras para crianças
                              const cellSize = Math.max(28, Math.min(42, maxSize));

                              if (isRemoved) {
                                return <div key={key} className="w-full h-full aspect-square" style={{ width: cellSize, height: cellSize }} />;
                              }

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => onCellClick(rIdx, cIdx)}
                                  disabled={lock || pendingWordId !== null}
                                  className={cn(
                                    "w-full aspect-square rounded text-center font-bold transition-colors",
                                    isInFoundWord
                                      ? "bg-brand-green text-white shadow-md"
                                      : "hover:opacity-80 border",
                                  )}
                                  style={{
                                    width: cellSize,
                                    height: cellSize,
                                    fontSize: `${Math.max(16, cellSize * 0.55)}px`,
                                    backgroundColor: isInFoundWord ? undefined : game.grid_background_color || '#1a1a1a',
                                    color: isInFoundWord ? undefined : game.letter_color || '#FFFFFF',
                                    borderColor: isInFoundWord ? undefined : `${game.letter_color || '#FFFFFF'}40`,
                                  }}
                                >
                                  {char}
                                </button>
                              );
                            }),
                          )}
                        </div>
                      </div>

                      {/* Imagens (sempre visíveis, à direita) - integradas ao fundo */}
                      {game.items && (
                        <div className="lg:flex-1 flex-shrink-0 p-2 sm:p-3 overflow-y-auto max-h-full">
                          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-2.5 w-full content-start">
                            {game.items.map((item) => {
                              const isFound = foundImages.has(item.id);
                              const isShaking = shakeImageId === item.id;
                              const isEnabled = pendingWordId !== null && !isFound; // habilitado quando há palavra pendente e imagem não foi encontrada

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => onImageClick(item.id)}
                                  disabled={lock || !isEnabled}
                                  className={cn(
                                    "relative rounded-xl overflow-hidden border-2 transition-all aspect-square shadow-lg w-full",
                                    isFound
                                      ? "border-brand-green opacity-70 cursor-not-allowed"
                                      : isShaking
                                        ? "border-red-500 animate-[shake_0.35s_ease-in-out_0s_2] bg-red-100/90"
                                        : isEnabled
                                          ? "border-white/80 hover:border-brand-green/90 bg-white/95 cursor-pointer hover:scale-105"
                                          : "border-white/40 opacity-50 cursor-not-allowed bg-white/60",
                                  )}
                                >
                                  <img src={normalizeMediaUrl(item.image_url)} alt={item.word} className="w-full h-full object-contain" />
                                  {isFound && (
                                    <div className="absolute inset-0 bg-brand-green/40 flex items-center justify-center">
                                      <span className="text-3xl text-white drop-shadow-lg">✓</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progresso */}
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10 bg-black/40 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-white/90 text-xs sm:text-sm">
                      {foundWords.size}/{game.items?.length || 0} palavras
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

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
  );
}
