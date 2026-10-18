import { useEffect, useState, type CSSProperties } from "react";
import {
  REACTION_DURATION_MS,
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
  reaction,
}: {
  reaction: SessionReaction | null;
}) {
  return reaction ? <Reaction key={reaction.id} reaction={reaction} /> : null;
}

function Reaction({ reaction }: { reaction: SessionReaction }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(false),
      REACTION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="session-reaction" data-reaction={reaction.type}>
      <span className="sr-only" role="status">
        {reaction.type === "message" ? reaction.text : labels[reaction.type]}
      </span>
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
