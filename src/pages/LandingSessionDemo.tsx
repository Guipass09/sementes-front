import { useEffect, useReducer } from "react";
import { Check, RotateCcw, Trophy } from "lucide-react";
import { shuffle } from "@/lib/shuffle";

const figures = [
  { name: "Sol", symbol: "☀️", color: "#fff0bd" },
  { name: "Bola", symbol: "⚽", color: "#dceeff" },
  { name: "Sapo", symbol: "🐸", color: "#e1f2d8" },
];
type Game = { deck: number[]; open: number[]; matched: number[]; moves: number };
type Action = { type: "flip"; index: number } | { type: "resolve" } | { type: "restart"; game: Game };
const newGame = (): Game => ({ deck: shuffle([0, 0, 1, 1, 2, 2]), open: [], matched: [], moves: 0 });

function reducer(state: Game, action: Action): Game {
  if (action.type === "restart") return action.game;
  if (action.type === "resolve") return { ...state, open: [] };
  const index = action.index;
  if (state.open.length === 2 || state.open.includes(index) || state.matched.includes(state.deck[index])) return state;
  if (state.open.length === 0) return { ...state, open: [index] };
  const matched = state.deck[state.open[0]] === state.deck[index];
  return { ...state, moves: state.moves + 1, open: matched ? [] : [...state.open, index], matched: matched ? [...state.matched, state.deck[index]] : state.matched };
}

export default function LandingSessionDemo({ image, onInteract }: { image: string; onInteract: () => void }) {
  const [game, dispatch] = useReducer(reducer, undefined, newGame);
  useEffect(() => {
    if (game.open.length !== 2) return;
    const timer = setTimeout(() => dispatch({ type: "resolve" }), 900);
    return () => clearTimeout(timer);
  }, [game.open]);
  const complete = game.matched.length === figures.length;

  return (
    <div className="lp-session-demo" onPointerDownCapture={onInteract} onFocusCapture={onInteract}>
      <img className="lp-session-demo__backdrop" src={image} alt="Demonstração de transmissão com paciente e profissional nas janelas de vídeo" draggable={false} />
      <section className="lp-session-demo__game" aria-label="Jogo da memória demonstrativo">
        <header className="lp-session-demo__heading">
          <h4>Memória dos sons</h4>
          <button type="button" onClick={() => dispatch({ type: "restart", game: newGame() })} aria-label="Reiniciar jogo da memória" title="Reiniciar jogo da memória"><RotateCcw size={18} /></button>
        </header>
        <div className="lp-session-demo__board">
          {game.deck.map((pair, index) => {
            const found = game.matched.includes(pair);
            const revealed = found || game.open.includes(index);
            const figure = figures[pair];
            return (
              <button key={index} type="button" className="lp-memory-card" data-revealed={revealed} data-matched={found}
                aria-label={`Carta ${index + 1}, ${revealed ? `${figure.name}${found ? ', par encontrado' : ''}` : 'fechada'}`}
                disabled={found || game.open.includes(index) || game.open.length === 2} onClick={() => dispatch({ type: "flip", index })}>
                <span className="lp-memory-card__turn">
                  <span className="lp-memory-card__back" aria-hidden="true"><img src="/landing/sementes-logo-transparent.png" alt="" /><span>{index + 1}</span></span>
                  <span className="lp-memory-card__front" style={{ background: figure.color }} aria-hidden="true"><span>{figure.symbol}</span><strong>{figure.name}</strong>{found && <Check size={16} />}</span>
                </span>
              </button>
            );
          })}
        </div>
        <footer className="lp-session-demo__status" role="status" aria-live="polite">
          <span>{complete && <Trophy size={15} />}{complete ? "Todos os pares!" : `${game.matched.length} de 3 pares`}</span>
          <span>{game.moves} {game.moves === 1 ? "jogada" : "jogadas"}</span>
        </footer>
      </section>
    </div>
  );
}
