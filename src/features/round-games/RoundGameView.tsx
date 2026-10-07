import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import BrandedCongratsDialog from "@/components/BrandedCongratsDialog";
import FullscreenToggle from "@/components/FullscreenToggle";
import { useSessionContentStatus } from "@/hooks/use-session-content-status";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { playCorrect, playWrong, unlockSfx } from "@/lib/sfx";
import { completeRoundGame, getRoundGame, type RoundGameKind, type RoundGameRow } from "@/lib/laravel-api";
import { initialRoundState, reduceRoundGame, roundGameInfo, roundSolved, shuffledChoices, type RoundAction } from "./round-game";
import logo from "@/assets/logo-sementes-da-fala.jpg";
import "./round-games.css";

export function RoundGameBoard({ game, session = false, sessionRole = "", storyPreview = false, seed = 1, onComplete }: {
  game: RoundGameRow; session?: boolean; sessionRole?: string; storyPreview?: boolean; seed?: number; onComplete?: () => void;
}) {
  const [state, setState] = useState(initialRoundState);
  const stateRef = useRef(state);
  const [allowed, setAllowed] = useState(!session || sessionRole === "admin" || storyPreview);
  const fullscreen = useRef<HTMLDivElement>(null);
  const current = game.rounds[state.round];
  const solved = current && roundSolved(current, game.kind, state.selected);
  const choices = useMemo(() => current ? shuffledChoices(current, seed + state.round * 137 + state.attempt * 997) : [], [current, seed, state.round, state.attempt]);

  const dispatch = useCallback((action: RoundAction, remote = false) => {
    if (!remote && !allowed) return;
    const previous = stateRef.current;
    const next = reduceRoundGame(previous, action, game.rounds, game.kind);
    if (next === previous) return;
    if (action.kind === "choose") {
      if (next.selected.length > previous.selected.length) playCorrect(); else playWrong();
    }
    stateRef.current = next;
    setState(next);
    if (!remote && session && window.parent !== window) window.parent.postMessage({ type: "SESSION_GAME_EVENT", event: action }, window.location.origin);
  }, [allowed, game.rounds, game.kind, session]);

  useEffect(() => {
    if (!session) return;
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data;
      if (data?.type === "SESSION_UNLOCK_SFX") void unlockSfx();
      if (data?.type === "SESSION_CONTROL") setAllowed(sessionRole === "admin" || storyPreview || data.granted === true);
      if (data?.type !== "SESSION_GAME_EVENT") return;
      const action = data.event;
      if (!action || !["choose", "next", "retry", "restart", "congrats_close"].includes(action.kind)) return;
      if (["choose", "next", "retry"].includes(action.kind) && !Number.isInteger(action.round)) return;
      dispatch(action, true);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [session, sessionRole, storyPreview, dispatch]);

  useEffect(() => { if (state.completed) onComplete?.(); }, [state.completed, onComplete]);
  useEffect(() => {
    if (!session || sessionRole !== "user") return;
    const el = fullscreen.current;
    el?.classList.add("is-pseudo-fullscreen");
    document.documentElement.classList.add("fs-lock", "fs-mode");
    return () => { el?.classList.remove("is-pseudo-fullscreen"); document.documentElement.classList.remove("fs-lock", "fs-mode"); };
  }, [session, sessionRole]);

  return <div ref={fullscreen} className={`round-board ${session ? "round-board--live" : ""}`} style={{ backgroundColor: game.background_color, backgroundImage: game.background_url ? `url("${normalizeMediaUrl(game.background_url)}")` : undefined }}>
    <div className="round-board__top">
      <span className="round-board__counter">Rodada {state.round + 1} de {game.rounds.length}</span>
      <div className="flex gap-2 items-center">
        {!allowed && <span className="text-xs text-muted-foreground">Aguarde sua vez</span>}
        <Button variant="outline" size="icon" title="Recomeçar jogo" aria-label="Recomeçar jogo" disabled={!allowed} onClick={() => dispatch({ kind: "restart" })}><RotateCcw size={18} /></Button>
        {sessionRole !== "user" && <FullscreenToggle targetRef={fullscreen} mode={session ? "pseudo" : "auto"} />}
      </div>
    </div>
    {state.completed ? <div className="round-board__finished"><Trophy size={48} className="text-amber-500" /><h2>Jogo concluído!</h2><Button disabled={!allowed} onClick={() => dispatch({ kind: "restart" })}><RotateCcw size={18} className="mr-2" />Jogar novamente</Button></div> : current && <section key={`${current.id}-${state.attempt}`} className="round-board__round">
      <h2>{current.prompt}</h2>
      <div className="round-board__grid">
        {choices.map((choice) => {
          const selected = state.selected.includes(choice.id);
          const wrong = state.mistake === choice.id;
          return <button key={choice.id} type="button" className={`round-choice ${selected ? "round-choice--correct" : ""} ${wrong ? "round-choice--wrong" : ""}`} aria-label={choice.label || `Figura ${current.choices.indexOf(choice) + 1}`} aria-pressed={selected} disabled={!allowed || selected || solved} onClick={() => { void unlockSfx(); dispatch({ kind: "choose", round: state.round, choice: choice.id }); }}>
            <span className="round-choice__image"><img src={normalizeMediaUrl(choice.url || "")} alt={choice.label} draggable={false} /></span>
            <span className="round-choice__label">{game.kind === "sequence" && <b>{selected ? state.selected.indexOf(choice.id) + 1 : "?"}</b>}{choice.label}{selected && <Check size={20} aria-hidden="true" />}</span>
          </button>;
        })}
      </div>
      <div className="round-board__feedback" role="status" aria-live="polite">{solved ? "Muito bem! Você completou esta rodada." : state.mistake ? "Vamos tentar outra figura?" : game.kind === "sequence" ? "Primeiro... depois... e no final?" : ""}</div>
      <div className="round-board__controls">
        <Button variant="outline" size="icon" title="Refazer rodada" aria-label="Refazer rodada" disabled={!allowed} onClick={() => dispatch({ kind: "retry", round: state.round })}><RotateCcw size={18} /></Button>
        <Button disabled={!allowed || !solved} onClick={() => dispatch({ kind: "next", round: state.round })}>{state.round === game.rounds.length - 1 ? "Concluir jogo" : "Próxima rodada"}<ArrowRight size={18} className="ml-2" /></Button>
      </div>
    </section>}
    <div className="round-board__progress" role="progressbar" aria-label="Rodadas concluídas" aria-valuemin={0} aria-valuemax={game.rounds.length} aria-valuenow={state.completed ? game.rounds.length : state.round}><span style={{ width: `${(state.completed ? 1 : state.round / game.rounds.length) * 100}%` }} /></div>
    <BrandedCongratsDialog open={state.celebration} onOpenChange={(open) => { if (!open) dispatch({ kind: "congrats_close" }); }} title="Jogo concluído!" description="Parabéns! Você completou todas as rodadas." primaryLabel="Jogar novamente" onPrimary={() => dispatch({ kind: "restart" })} secondaryLabel="Fechar" />
  </div>;
}

export default function RoundGameView({ kind }: { kind: RoundGameKind }) {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const session = params.get("session") === "1";
  const [game, setGame] = useState<RoundGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [progressError, setProgressError] = useState(false);
  const localSeed = useRef(Math.floor(Math.random() * 100000));
  useSessionContentStatus(loading, !!game);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/entrar"); return; }
    let active = true;
    setLoading(true); setGame(null); setError("");
    getRoundGame(Number(id), { session_id: session ? Number(params.get("session_id")) : undefined, story_id: Number(params.get("story_id")) || undefined })
      .then(g => { if (active) { if (g.kind !== kind) setError("Jogo não encontrado."); else setGame(g); } })
      .catch(() => { if (active) setError("Não foi possível abrir este jogo. Confira seu acesso e tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user, id, kind, session, params, navigate, retry]);
  const completed = useCallback(() => {
    if (!session && user?.role === "user" && !params.get("story_id")) {
      setProgressError(false);
      void completeRoundGame(Number(id)).catch(() => setProgressError(true));
    }
  }, [session, user?.role, params, id]);
  return <div className={`round-game-page ${session ? "round-game-page--live" : ""}`}>
    {!session && <header className="round-game-header"><Button size="icon" variant="ghost" aria-label="Voltar aos jogos" title="Voltar aos jogos" onClick={() => navigate(user?.role === "admin" ? "/admin/jogos" : user?.role === "professional" ? "/profissional/jogos" : "/paciente/jogos")}><ArrowLeft size={20} /></Button><img src={logo} alt="Sementes da Fala" /><div><span>{roundGameInfo[kind].title}</span><h1>{game?.title || "Jogo"}</h1></div></header>}
    <main className="round-game-main">
      {loading ? <div role="status" className="p-8">Carregando jogo...</div> : error ? <div role="alert" className="p-8 space-y-4"><p>{error}</p><Button onClick={() => setRetry(n => n + 1)}>Tentar novamente</Button></div> : game && <RoundGameBoard key={`${id}-${params.get("session_content_id") || "local"}-${retry}`} game={game} session={session} sessionRole={params.get("session_role") || ""} storyPreview={params.get("story_preview") === "1" && !params.has("session_id")} seed={params.has("session_seed") ? Number(params.get("session_seed")) : localSeed.current} onComplete={completed} />}
      {progressError && <p role="alert" className="p-3 text-sm">O jogo foi concluído, mas não foi possível registrar a conclusão. <button className="underline" onClick={completed}>Tentar novamente</button></p>}
    </main>
  </div>;
}
