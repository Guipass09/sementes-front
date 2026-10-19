import { useId, useRef, useState } from "react";
import {
  ChevronDown,
  Hand,
  Heart,
  PartyPopper,
  Send,
  Smile,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GameAudioControls } from "@/features/games/GameAudio";
import type { GameAudioSettings } from "@/lib/game-audio-policy";
import {
  REACTION_TEXT_LIMIT,
  MAX_PENDING_REACTIONS,
  createSessionReaction,
  reactionText,
  type SessionReaction,
} from "./session-reactions";

export const reactionOptions = [
  {
    type: "confetti",
    label: "Confetes",
    Icon: PartyPopper,
    color: "text-brand-orange",
  },
  { type: "applause", label: "Palmas", Icon: Hand, color: "text-amber-600" },
  { type: "hearts", label: "Corações", Icon: Heart, color: "text-rose-500" },
  {
    type: "happy",
    label: "Carinhas felizes",
    Icon: Smile,
    color: "text-brand-green",
  },
] as const;

export function SessionReactionPicker({
  disabled,
  audioPending = false,
  audioSettings,
  onAudioChange,
  onAudioCommit,
  onSend,
  musicControls,
}: {
  disabled: boolean;
  audioPending?: boolean;
  audioSettings?: GameAudioSettings;
  onAudioChange?: (settings: GameAudioSettings) => void;
  onAudioCommit?: (settings: GameAudioSettings) => void;
  onSend: (reaction: SessionReaction) => Promise<void>;
  musicControls?: import("react").ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  const [text, setText] = useState("");
  const inputId = useId();
  const cleaned = reactionText(text);
  const busy = pending >= MAX_PENDING_REACTIONS || disabled || audioPending;
  const send = async (reaction: SessionReaction) => {
    if (disabled || audioPending || pendingRef.current >= MAX_PENDING_REACTIONS)
      return;
    pendingRef.current += 1;
    setPending(pendingRef.current);
    try {
      await onSend(reaction);
    } finally {
      pendingRef.current -= 1;
      setPending(pendingRef.current);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="rounded-xl border-brand-orange text-brand-orange hover:bg-brand-orange/10"
          title="Reações da chamada"
        >
          <Sparkles className="h-4 w-4 mr-2" /> Reações{" "}
          <ChevronDown className="h-3.5 w-3.5 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={12}
        className="w-[320px] max-w-[calc(100vw-24px)] max-h-[min(540px,var(--radix-popover-content-available-height))] overflow-y-auto rounded-lg p-4"
        aria-label="Reações da chamada"
      >
        <h3 className="mb-3 text-sm font-semibold">Reações</h3>
        <div className="grid grid-cols-2 gap-2">
          {reactionOptions.map(({ type, label, Icon, color }) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void send(createSessionReaction(type))}
              className="h-16 min-w-0 flex-col gap-1 rounded-md px-1 text-xs"
            >
              <Icon className={`h-5 w-5 ${color}`} /> {label}
            </Button>
          ))}
        </div>
        <form
          className="mt-4 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (cleaned) void send(createSessionReaction("message", cleaned));
          }}
        >
          <label htmlFor={inputId} className="text-xs font-medium">
            Mensagem personalizada
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id={inputId}
              value={text}
              onChange={(event) =>
                setText(
                  Array.from(event.target.value)
                    .slice(0, REACTION_TEXT_LIMIT)
                    .join(""),
                )
              }
              placeholder="Você foi incrível!"
              className="min-w-0 flex-1"
              disabled={disabled}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!cleaned || busy}
              title="Enviar mensagem animada"
              aria-label="Enviar mensagem animada"
              className="h-10 w-10 flex-none"
            >
              <Send size={17} />
            </Button>
          </div>
          <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
            {Array.from(text).length}/{REACTION_TEXT_LIMIT}
          </div>
        </form>
        {musicControls}
        {audioSettings && onAudioChange && <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-xs font-medium">
            Som dos jogos e reações
          </div>
          <GameAudioControls
            settings={audioSettings}
            disabled={disabled || audioPending}
            onChange={onAudioChange}
            onCommit={onAudioCommit}
          />
        </div>}
      </PopoverContent>
    </Popover>
  );
}
