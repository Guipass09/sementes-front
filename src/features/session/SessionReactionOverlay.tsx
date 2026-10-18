import { useEffect, useState, type CSSProperties } from "react";
import {
  REACTION_DURATION_MS,
  MAX_ACTIVE_REACTIONS,
  reactionParticles,
  type SessionReaction,
} from "./session-reactions";
import "./session-reactions.css";

const labels = {
  confetti: "Confetes",
  applause: "Palmas",
  hearts: "Corações",
  happy: "Carinhas felizes",
  message: "Mensagem",
};
const symbols = {
  applause: "👏",
  hearts: "❤️",
  happy: "😄",
  confetti: "",
  message: "",
};

export function SessionReactionOverlay({
  reactions,
  onFinished,
}: {
  reactions: readonly SessionReaction[];
  onFinished: (id: string) => void;
}) {
  const visible = reactions.slice(-MAX_ACTIVE_REACTIONS);
  const latest = visible[visible.length - 1];
  if (!latest) return null;
  return (
    <div className="session-reactions">
      <span className="sr-only" role="status">
        {latest.type === "message" ? latest.text : labels[latest.type]}
      </span>
      {visible.map((reaction) => (
        <Reaction
          key={reaction.id}
          reaction={reaction}
          onFinished={onFinished}
        />
      ))}
    </div>
  );
}

function Reaction({
  reaction,
  onFinished,
}: {
  reaction: SessionReaction;
  onFinished: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onFinished(reaction.id);
    }, REACTION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [reaction.id, onFinished]);
  if (!visible) return null;
  return (
    <div className="session-reaction" data-reaction={reaction.type}>
      <div className="session-reaction-particles" aria-hidden="true">
        {reactionParticles(reaction).map((particle, index) => (
          <div
            key={index}
            className="session-reaction-particle"
            style={
              {
                left: `${particle.left}%`,
                "--reaction-top": `${particle.top}%`,
                "--reaction-delay": `${particle.delay}s`,
                "--reaction-duration": `${particle.duration}s`,
                "--reaction-size": `${particle.size}px`,
                "--reaction-turn": `${particle.rotation}deg`,
                "--reaction-drift": `${particle.drift}px`,
                "--reaction-color": particle.color,
              } as CSSProperties
            }
          >
            <span className="session-reaction-symbol">
              {reaction.type === "message"
                ? reaction.text
                : symbols[reaction.type]}
            </span>
          </div>
        ))}
      </div>
      <div className="session-reaction-still" aria-hidden="true">
        {reaction.type === "message"
          ? reaction.text
          : `${symbols[reaction.type] || "🎉"} ${labels[reaction.type]}`}
      </div>
    </div>
  );
}
