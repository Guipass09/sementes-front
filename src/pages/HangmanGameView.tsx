import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, Type, XCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { isApiError } from "@/lib/laravel-api";
import type { HangmanGameRow } from "@/lib/laravel-api";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { emitUserProgressChanged } from "@/lib/user-events";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import FullscreenToggle from "@/components/FullscreenToggle";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function normalizeWordClient(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

export default function HangmanGameView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { toast } = useToast();

  const sessionParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inSession = sessionParams.get("session") === "1";
  const sessionRole = (sessionParams.get("session_role") || "").toLowerCase() as "admin" | "user" | "";
  const sessionId = useMemo(() => {
    const n = Number(sessionParams.get("session_id"));
    return Number.isFinite(n) ? n : null;
  }, [sessionParams]);
  const controlAllowedRef = useRef<boolean>(sessionRole === "admin");
  const applyingRemoteRef = useRef(false);

  const emitSessionEvent = useCallback(
    (event: any) => {
      if (!inSession) return;
      if (applyingRemoteRef.current) return;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "SESSION_GAME_EVENT", event }, window.location.origin);
        }
      } catch {}
    },
    [inSession],
  );

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<HangmanGameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [guessed, setGuessed] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [flashPositions, setFlashPositions] = useState<number[]>([]);
  const [wrongPulse, setWrongPulse] = useState<null | { letter: string; t: number }>(null);
  const [hitPulse, setHitPulse] = useState<null | { letter: string; t: number }>(null);
  const [showWinOverlay, setShowWinOverlay] = useState(false);

  const persistTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const wrongTimerRef = useRef<number | null>(null);
  const hitTimerRef = useRef<number | null>(null);
  const winTimerRef = useRef<number | null>(null);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const autoPseudoFullscreen = inSession && sessionRole === "user";

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

  // Sessão ao vivo: recebe controle + estado do outro lado
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
      if (evt.game !== "hangman") return;
      if (evt.kind !== "state") return;

      const st = evt.state || {};
      applyingRemoteRef.current = true;
      try {
        if (Array.isArray(st.guessed)) setGuessed(st.guessed.map((x: any) => String(x).toUpperCase()).filter((x: string) => /^[A-Z]$/.test(x)));
        if (Array.isArray(st.wrong)) setWrong(st.wrong.map((x: any) => String(x).toUpperCase()).filter((x: string) => /^[A-Z]$/.test(x)));
        if (Number.isFinite(Number(st.selectedImage))) setSelectedImage(Math.max(0, Number(st.selectedImage)));
      } finally {
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inSession, sessionRole]);

  // Emite snapshot do estado (admin sempre; user só quando controle está liberado)
  useEffect(() => {
    if (!inSession) return;
    if (applyingRemoteRef.current) return;
    if (sessionRole === "user" && !controlAllowedRef.current) return;
    emitSessionEvent({ game: "hangman", kind: "state", state: { guessed, wrong, selectedImage } });
  }, [inSession, sessionRole, guessed, wrong, selectedImage, emitSessionEvent]);

  const gameId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) navigate("/entrar");
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
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
          auth.user?.role === "admin"
            ? await api.adminGetHangmanGame(gameId)
            : auth.user?.role === "professional"
              ? await api.professionalGetHangmanGame(gameId)
              : await api.userGetHangmanGame(gameId, inSession ? { session_id: sessionId } : undefined);
        if (cancelled) return;
        setGame(g);

        // Restaura progresso (user) - prioriza API, depois localStorage
        if (auth.user?.role === "user" && auth.user?.id) {
          const key = `hang-progress:${auth.user.id}:${g.id}`;
          const fromApi = (g as any).progress ?? null;
          const fromLocal = (() => {
            try {
              return JSON.parse(localStorage.getItem(key) || "null");
            } catch {
              return null;
            }
          })();
          const p = fromApi ?? fromLocal;
          const guessedArr = Array.isArray(p?.guessed) ? p.guessed.map((x: any) => String(x).toUpperCase()) : [];
          const wrongArr = Array.isArray(p?.wrong) ? p.wrong.map((x: any) => String(x).toUpperCase()) : [];
          const imgIdx = Number.isFinite(Number(p?.selectedImage)) ? Number(p.selectedImage) : 0;
          setGuessed(Array.from(new Set(guessedArr.filter((x: string) => /^[A-Z]$/.test(x)))));
          setWrong(Array.from(new Set(wrongArr.filter((x: string) => /^[A-Z]$/.test(x)))));
          setSelectedImage(Math.max(0, imgIdx));
        } else {
          setGuessed([]);
          setWrong([]);
          setSelectedImage(0);
        }

        setCelebrate(false);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e)) {
          if (e.status === 404) setNotFound(true);
          else if (e.status === 403) setForbidden(true);
          else if (e.status === 401) navigate("/entrar");
        } else {
          toast({ title: "Erro ao carregar jogo", description: "Tente novamente.", variant: "destructive" });
        }
        setGame(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, auth.user?.role, auth.user?.id, navigate, toast]);

  const secret = useMemo(() => normalizeWordClient(game?.secret_word ?? ""), [game?.secret_word]);

  const revealed = useMemo(() => {
    if (!secret) return [];
    const set = new Set(guessed);
    return secret.split("").map((ch) => (set.has(ch) ? ch : "_"));
  }, [secret, guessed]);

  const allDone = useMemo(() => {
    if (!secret) return false;
    const unique = new Set(secret.split(""));
    for (const ch of unique) {
      if (!guessed.includes(ch)) return false;
    }
    return true;
  }, [secret, guessed]);

  // Atualiza barras/contadores globais quando o usuário conclui o jogo
  useEffect(() => {
    if (!allDone) return;
    if (auth.user?.role !== "user") return;
    emitUserProgressChanged();
  }, [allDone, auth.user?.role]);

  useEffect(() => {
    if (!allDone) return;
    setCelebrate(true);
    const t = window.setTimeout(() => setCelebrate(false), 2200);
    return () => window.clearTimeout(t);
  }, [allDone]);

  // Fogos em tela cheia por ~4s
  useEffect(() => {
    if (!allDone) return;
    setShowWinOverlay(true);
    if (winTimerRef.current) window.clearTimeout(winTimerRef.current);
    winTimerRef.current = window.setTimeout(() => setShowWinOverlay(false), 4000);
    return () => {
      if (winTimerRef.current) window.clearTimeout(winTimerRef.current);
      winTimerRef.current = null;
    };
  }, [allDone]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current);
      if (hitTimerRef.current) window.clearTimeout(hitTimerRef.current);
      if (winTimerRef.current) window.clearTimeout(winTimerRef.current);
    };
  }, []);

  const fireworks = useMemo(() => {
    if (!showWinOverlay) return [];
    const count = 26;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.round(6 + Math.random() * 88)}%`,
      top: `${Math.round(10 + Math.random() * 80)}%`,
      delay: `${Math.round(Math.random() * 700)}ms`,
    }));
  }, [showWinOverlay]);

  // Persistência do progresso (localStorage + backend) para não perder no refresh
  useEffect(() => {
    if (!game || !auth.user || auth.user.role !== "user") return;
    const key = `hang-progress:${auth.user.id}:${game.id}`;
    const payload = {
      guessed,
      wrong,
      selectedImage,
      finished: allDone,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void api
        .userUpdateHangmanGameProgress(game.id, {
          progress: payload,
          status: allDone ? "concluido" : undefined,
        })
        .catch(() => {
          // ignore
        });
    }, 450);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [guessed, wrong, selectedImage, allDone, game?.id, auth.user?.id, auth.user?.role]);

  const restart = useCallback(() => {
    setGuessed([]);
    setWrong([]);
    setSelectedImage(0);
    setCelebrate(false);
    toast({ title: "Recomeçou!", description: "Vamos tentar novamente." });
  }, [toast]);

  const chooseLetter = useCallback(
    (letter: string) => {
      if (!secret) return;
      if (guessed.includes(letter) || wrong.includes(letter)) return;

      if (secret.includes(letter)) {
        playCorrect();
        // animação nas posições recém-reveladas
        const positions = secret
          .split("")
          .map((ch, idx) => (ch === letter ? idx : -1))
          .filter((x) => x >= 0);
        setFlashPositions(positions);
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlashPositions([]), 520);
        setHitPulse({ letter, t: Date.now() });
        if (hitTimerRef.current) window.clearTimeout(hitTimerRef.current);
        hitTimerRef.current = window.setTimeout(() => setHitPulse(null), 900);
        setGuessed((prev) => [...prev, letter]);
      } else {
        playWrong();
        setWrong((prev) => [...prev, letter]);
        setWrongPulse({ letter, t: Date.now() });
        if (wrongTimerRef.current) window.clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = window.setTimeout(() => setWrongPulse(null), 700);
        toast({ title: "Ops!", description: `A letra "${letter}" não aparece na palavra.`, variant: "destructive" });
      }
    },
    [guessed, wrong, secret, toast],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-56 mb-6" />
          <Skeleton className="h-[70vh] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Jogo não encontrado</h1>
          <p className="text-muted-foreground mb-4">Esse jogo não existe ou foi removido.</p>
          <Button onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Acesso negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para abrir este jogo.</p>
          <Button onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const images = game.support_images ?? [];
  const safeSelected = images.length > 0 ? Math.min(selectedImage, images.length - 1) : 0;
  const mainImageUrl = images[safeSelected]?.url ? normalizeMediaUrl(images[safeSelected]!.url) : null;

  return (
    <div className="min-h-[100svh] bg-transparent">
      {!inSession && (
      <div className="fs-hide-when-fullscreen sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button variant="secondary" onClick={restart} className="shrink-0 sm:hidden">
              <RotateCcw className="h-4 w-4 mr-2" />
              Recomeçar
            </Button>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground">
              <Type className="h-4 w-4" />
              Jogo da Forca
            </div>
            <div className="font-display font-bold text-foreground truncate">{game.title}</div>
          </div>

          <Button variant="secondary" onClick={restart} className="hidden sm:inline-flex">
            <RotateCcw className="h-4 w-4 mr-2" />
            Recomeçar
          </Button>
        </div>
      </div>
      )}

      <div className={cn("container mx-auto px-4 py-6", inSession && "px-0 py-0")}>
        <div ref={fsRef} className="fs-target relative">
          {/* Botão pequeno no canto do conteúdo (em sessão: pseudo-only) */}
          <FullscreenToggle targetRef={fsRef} className="absolute top-3 right-3 z-30" mode={inSession ? "pseudo" : "auto"} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: imagem + palavra */}
          <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border overflow-hidden bg-muted/10">
                <div className="w-full h-[42vh] sm:h-[48vh] lg:h-[52vh] bg-black/5 flex items-center justify-center">
                  {mainImageUrl ? (
                    <img
                      src={mainImageUrl}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                      <div className="text-sm">Sem imagem de apoio</div>
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="p-3 border-t border-border bg-background/50">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.map((im, idx) => {
                        const url = normalizeMediaUrl(im.url);
                        const active = idx === safeSelected;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedImage(idx)}
                            className={cn(
                              "shrink-0 w-16 h-12 rounded-xl overflow-hidden border bg-muted/20",
                              active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
                            )}
                          >
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Dica visual: escolha uma imagem para ver melhor (opcional).
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">{game.description}</div>

                <div className="grid gap-2 justify-center sm:justify-start [grid-template-columns:repeat(auto-fit,minmax(2.25rem,2.75rem))] sm:[grid-template-columns:repeat(auto-fit,minmax(2.5rem,3rem))]">
                  {revealed.length > 0 ? (
                    revealed.map((ch, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "w-11 h-12 sm:w-12 sm:h-14 rounded-xl border border-border bg-background flex items-center justify-center font-display font-bold text-lg",
                          ch !== "_" ? "text-foreground" : "text-muted-foreground",
                          ch !== "_" && flashPositions.includes(idx) && "hg-letter-pop border-brand-green/35 bg-brand-green/10",
                        )}
                      >
                        {ch}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Palavra inválida.</div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    Erros: <span className="font-semibold text-foreground">{wrong.length}</span>
                  </div>
                  {wrong.length > 0 && (
                    <div className="text-xs px-2 py-1 rounded-full bg-red-600/10 text-red-700 border border-red-600/20 inline-flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {wrong.join(" • ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: teclado */}
          <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-foreground">Teclado</div>
              <div className="text-sm text-muted-foreground">
                {guessed.length + wrong.length} / 26 escolhidas
              </div>
            </div>

            {hitPulse && (
              <div className="mb-3 rounded-2xl border border-brand-green/25 bg-brand-green/10 px-4 py-3 text-sm text-brand-green flex items-center justify-between gap-3 hg-hit-badge">
                <div className="inline-flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4" />
                  CERTO! <span className="text-foreground">“{hitPulse.letter}”</span>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-xs text-muted-foreground">Muito bem!</div>
              </div>
            )}

            {wrongPulse && (
              <div className="mb-3 rounded-2xl border border-red-600/25 bg-red-600/10 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Letra <span className="font-semibold">“{wrongPulse.letter}”</span> não aparece na palavra.
              </div>
            )}

            <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
              {LETTERS.map((l) => {
                const isGuessed = guessed.includes(l);
                const isWrong = wrong.includes(l);
                const justHit = hitPulse?.letter === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => chooseLetter(l)}
                    disabled={isGuessed || isWrong || allDone}
                    className={cn(
                      "h-10 rounded-xl border font-semibold transition-all",
                      isGuessed && "bg-brand-green/15 border-brand-green/30 text-brand-green",
                      isWrong && "bg-red-600/10 border-red-600/25 text-red-700",
                      !isGuessed && !isWrong && "bg-background border-border hover:bg-muted/40",
                      (isGuessed || isWrong || allDone) && "opacity-80",
                      justHit && "hg-key-hit",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            {allDone && (
              <div className="mt-4 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-center">
                <div className="font-display font-extrabold text-xl text-brand-green inline-flex items-center gap-2 justify-center">
                  <Sparkles className="h-5 w-5" />
                  Parabéns!
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="text-sm text-muted-foreground mt-1">Você completou a palavra.</div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <BrandedCongratsDialog
        open={showWinOverlay}
        onOpenChange={setShowWinOverlay}
        title="Parabéns!"
        description="Você completou a palavra."
        primaryLabel="Fechar"
      >
        <div className="rounded-2xl border border-brand-green/20 bg-gradient-to-b from-brand-green/10 via-background/40 to-background/80 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Palavra</div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {(secret || (game?.secret_word ?? "")).toString().trim().toUpperCase().split("").map((ch, idx) => (
              <span
                key={`${ch}-${idx}`}
                className="min-w-9 h-10 px-3 rounded-xl bg-white/70 border border-border shadow-sm grid place-items-center font-display font-extrabold text-lg text-brand-green"
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="mg-aud-fireworks" aria-hidden="true" />
            <span className="mg-aud-fireworks" aria-hidden="true" />
            <span className="mg-aud-fireworks" aria-hidden="true" />
          </div>
        </div>
      </BrandedCongratsDialog>
    </div>
  );
}


