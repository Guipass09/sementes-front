import { useEffect, useId, useState } from "react";
import { Music2, Pause, Play, Repeat2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SESSION_MUSIC_TRACKS,
  musicTrack,
  type MusicState,
  type MusicView,
} from "./session-music-policy";

export function SessionMusicControls({
  view,
  disabled,
  onChange,
  showVolume = true,
}: {
  view: MusicView;
  disabled: boolean;
  onChange: (patch: Partial<MusicState>) => void;
  showVolume?: boolean;
}) {
  const id = useId();
  const [volume, setVolume] = useState(view.volume);
  useEffect(() => setVolume(view.volume), [view.volume]);
  const commitVolume = (value: string) => {
    if (Number(value) / 100 !== view.volume)
      onChange({ volume: Number(value) / 100 });
  };
  const track = musicTrack(view.trackId)!;
  return (
    <section
      className="mt-3 border-t border-border pt-3"
      aria-label="Músicas do atendimento"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <Music2 size={15} className="text-brand-green" /> Músicas infantis
        instrumentais
      </div>
      <Select
        value={view.trackId}
        disabled={disabled}
        onValueChange={(trackId) =>
          onChange({ trackId, position: 0, playing: false })
        }
      >
        <SelectTrigger
          className="h-10 w-full min-w-0 text-xs [&>span]:truncate"
          aria-label="Escolher música"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-64 w-[var(--radix-select-trigger-width)]"
        >
          {SESSION_MUSIC_TRACKS.map((item) => (
            <SelectItem key={item.id} value={item.id} className="text-xs">
              {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 flex-none"
          disabled={disabled}
          title="Voltar ao início"
          aria-label="Voltar ao início"
          onClick={() => onChange({ position: 0 })}
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          size="icon"
          className="h-9 w-9 flex-none"
          disabled={disabled}
          title={view.playing ? "Pausar para todos" : "Tocar para todos"}
          aria-label={view.playing ? "Pausar para todos" : "Tocar para todos"}
          onClick={() =>
            onChange({ playing: !view.playing, volume: view.volume || 0.25 })
          }
        >
          {view.playing ? <Pause size={17} /> : <Play size={17} />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className={`h-9 w-9 flex-none ${view.loop ? "border-brand-green text-brand-green" : ""}`}
          disabled={disabled}
          title="Repetir música"
          aria-label="Repetir música"
          aria-pressed={view.loop}
          onClick={() => onChange({ loop: !view.loop })}
        >
          <Repeat2 size={16} />
        </Button>
        <span
          className="min-w-0 flex-1 text-right text-xs text-muted-foreground"
          role="status"
        >
          {view.playing
            ? view.confirmed
              ? "Tocando para os dois"
              : "Conectando áudio…"
            : "Pausada"}
        </span>
      </div>
      {showVolume && <div className="mt-2 flex min-w-0 items-center gap-2">
        <label htmlFor={id} className="flex-none text-xs">
          Volume
        </label>
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(volume * 100)}
          disabled={disabled}
          aria-label="Volume da música"
          aria-valuetext={`${Math.round(volume * 100)}%`}
          className="h-8 min-w-0 flex-1 accent-primary"
          onChange={(event) =>
            setVolume(Number(event.currentTarget.value) / 100)
          }
          onPointerUp={(event) => commitVolume(event.currentTarget.value)}
          onBlur={(event) => commitVolume(event.currentTarget.value)}
          onKeyUp={(event) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key)
            )
              commitVolume(event.currentTarget.value);
          }}
        />
        <output
          htmlFor={id}
          className="w-8 flex-none text-right text-xs tabular-nums"
        >
          {Math.round(volume * 100)}%
        </output>
      </div>}
      {view.notice && (
        <p
          className="mt-1 text-xs leading-relaxed text-amber-800"
          role="status"
        >
          {view.notice}
        </p>
      )}
      <div className="mt-2 flex items-start justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="min-w-0 break-words">{track.author}</span>
        <a
          href="/audio/session-music/CREDITS.md"
          target="_blank"
          rel="noreferrer"
          className="flex-none underline underline-offset-2"
        >
          Créditos e licenças
        </a>
      </div>
    </section>
  );
}
