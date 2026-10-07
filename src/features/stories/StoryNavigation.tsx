import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Film, Gamepad2, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { ActivityRow, StoryGameType } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import "./stories.css";

const gameLabels: Record<StoryGameType, string> = {
  sound_image_game: "Sons e imagens", image_sequence_game: "Sequência",
  memory_game: "Memória", memory_game_v2: "Memória 2.0", phoneme_game: "Fonemas",
  auditory_game: "Escuta", hangman_game: "Forca", spin_wheel_game: "Roleta",
  word_search_game: "Caça-palavras", card_game: "Cartas", guess_image_game: "Acerte a imagem",
};

export function storyStepPresentation(story: ActivityRow, index: number) {
  const step = story.story_steps?.[index];
  const media = step?.type === "media" ? story.media.find(item => item.id === step.media_id) : null;
  const kind = step?.type === "game" ? "game" : media?.media_type === "video" ? "video" : "image";
  return {
    kind,
    label: step?.type === "game" ? gameLabels[step.game_type] : kind === "video" ? "Vídeo" : "Imagem",
    thumbnail: media?.media_type === "video" ? media.thumbnail_url : media?.url,
    Icon: kind === "game" ? Gamepad2 : kind === "video" ? Film : ImageIcon,
  };
}

type Props = {
  story: ActivityRow;
  index: number;
  onSelect: (index: number) => void;
  onReplay?: () => void;
  tools?: ReactNode;
  compact?: boolean;
};

export default function StoryNavigation({ story, index, onSelect, onReplay, tools, compact = false }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const count = story.story_steps?.length ?? 0;
  const current = storyStepPresentation(story, index);
  const last = index === count - 1;

  useEffect(() => {
    const strip = stripRef.current;
    const selected = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !selected) return;
    strip.scrollTo({
      left: selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [index]);

  if (!count) return null;

  return <nav className={`story-navigation${compact ? " story-navigation--compact" : ""}`} data-kind={current.kind} aria-label="Navegação da história">
    <div className="story-navigation-main">
      <div className="story-step-summary">
        <span className="story-kind-icon"><current.Icon size={21} strokeWidth={1.7} /></span>
        <div className="story-step-summary-text">
          <span className="story-step-eyebrow">{compact ? current.label : "História completa"}<span aria-hidden="true"> / </span>{String(index + 1).padStart(2, "0")} de {String(count).padStart(2, "0")}</span>
          <span className="story-step-title">{compact ? story.title : current.label}</span>
        </div>
      </div>
      <div className="story-navigation-actions">
        {tools}
        {onReplay && <button className="story-icon-button story-replay" type="button" title="Recomeçar esta etapa" aria-label="Recomeçar esta etapa" onClick={onReplay}><RotateCcw size={18} /></button>}
        <span className="story-actions-divider" />
        <button className="story-icon-button story-previous" type="button" title="Etapa anterior" aria-label="Etapa anterior" disabled={index <= 0} onClick={() => onSelect(index - 1)}><ArrowLeft size={20} /></button>
        <button className="story-next" type="button" title={last ? "Recomeçar história" : "Próxima etapa"} aria-label={last ? "Recomeçar história" : "Próxima etapa"} onClick={() => last && count === 1 && onReplay ? onReplay() : onSelect(last ? 0 : index + 1)}>
          <span>{last ? "Rever história" : "Continuar"}</span>{last ? <RotateCcw size={19} /> : <ArrowRight size={21} />}
        </button>
      </div>
    </div>
    <div className="story-progress" role="progressbar" aria-label="Etapa atual" aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / count) * 100}%` }} /></div>
    <div className="story-filmstrip" ref={stripRef}>
      {story.story_steps?.map((step, stepIndex) => {
        const item = storyStepPresentation(story, stepIndex);
        return <button key={stepIndex} className="story-step-tile" data-kind={item.kind} type="button" aria-current={stepIndex === index ? "step" : undefined} aria-label={`Etapa ${stepIndex + 1}: ${item.label}`} title={`Etapa ${stepIndex + 1}: ${item.label}`} onClick={() => onSelect(stepIndex)}>
          <span className="story-step-preview">
            {item.thumbnail ? <img src={normalizeMediaUrl(item.thumbnail)} alt="" loading="lazy" /> : <item.Icon size={23} strokeWidth={1.5} />}
            {step.type === "game" && <span className="story-game-preview-pattern" aria-hidden="true" />}
            <span className="story-step-number">{String(stepIndex + 1).padStart(2, "0")}</span>
          </span>
          <span className="story-step-tile-label">{item.label}</span>
        </button>;
      })}
    </div>
  </nav>;
}
