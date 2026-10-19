import { useId, useState } from "react";
import { AudioLines, Clapperboard, Gamepad2, Mic, MonitorUp, Music2, RotateCcw, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AUDIO_CHANNELS, channelMaximum, type AudioChannel, type SessionAudioMix } from "./session-audio-mix";
import type { ReactNode } from "react";

const channels = {
  professionalMic: { label: "Seu microfone", Icon: Mic }, patientMic: { label: "Microfone do paciente", Icon: Mic },
  activity: { label: "Áudio das atividades", Icon: Clapperboard }, effects: { label: "Efeitos dos jogos", Icon: Gamepad2 },
  reactions: { label: "Reações", Icon: Sparkles }, music: { label: "Músicas do atendimento", Icon: Music2 },
  soundtrack: { label: "Trilha dos jogos", Icon: Music2 }, screen: { label: "Áudio da tela compartilhada", Icon: MonitorUp },
};
export function SessionAudioMixer({ mix, onChange, onReset, disabled, confirmed, notice, musicControls, microphones }: {
  mix: SessionAudioMix; onChange: (next: SessionAudioMix) => void; onReset: () => void;
  disabled: boolean; confirmed: boolean; notice: string; musicControls: ReactNode;
  microphones: { professionalMic: boolean | null; patientMic: boolean | null };
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const update = (channel: AudioChannel, patch: Partial<SessionAudioMix["channels"][AudioChannel]>) => onChange({ ...mix, channels: { ...mix.channels, [channel]: { ...mix.channels[channel], ...patch } } });
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} title="Abrir mixer de áudio" className="h-10 gap-2 rounded-md">
      <AudioLines size={18} /> Áudio
    </Button>
    <DialogContent hideClose className="flex w-[calc(100vw-24px)] max-w-lg max-h-[90svh] flex-col gap-3 overflow-hidden rounded-lg p-4 sm:p-6" aria-describedby={`${id}-status`}>
      <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-2 top-2 h-11 w-11" aria-label="Fechar áudio da sessão" title="Fechar áudio da sessão"><X size={18} /></Button></DialogClose>
      <DialogHeader className="flex-none pr-10">
        <DialogTitle className="flex items-center gap-2 text-lg"><AudioLines size={20} className="text-brand-green" /> Áudio da sessão</DialogTitle>
        <DialogDescription id={`${id}-status`} className="text-xs" aria-live="polite">{notice || (confirmed ? "Ajustes confirmados no paciente" : "Aguardando confirmação do paciente")}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <label htmlFor={`${id}-priority`} className="text-sm font-medium">Priorizar a voz</label>
        <Switch id={`${id}-priority`} checked={mix.speechPriority} disabled={disabled} onCheckedChange={speechPriority => onChange({ ...mix, speechPriority })} />
      </div>
      <div className="divide-y divide-border">
        {AUDIO_CHANNELS.map(channel => {
          const { label, Icon } = channels[channel]; const level = mix.channels[channel];
          const percent = Math.round(level.volume * 100); const silent = level.muted || percent === 0;
          const microphoneOff = (channel === "professionalMic" || channel === "patientMic") && microphones[channel] === false;
          return <fieldset key={channel} disabled={disabled} className="min-w-0 py-3" aria-label={label}>
            <div className="mb-1.5 flex min-w-0 items-center gap-2">
              <Icon size={16} className="flex-none text-muted-foreground" />
              <label htmlFor={`${id}-${channel}`} className="min-w-0 flex-1 text-sm font-medium leading-tight">{label}</label>
              <output htmlFor={`${id}-${channel}`} className="w-16 flex-none text-right text-xs tabular-nums text-muted-foreground">{microphoneOff ? "Desligado" : level.muted ? "Mudo" : `${percent}%`}</output>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 flex-none rounded-md" title={`${silent ? "Ativar" : "Silenciar"} ${label.toLowerCase()}`} aria-label={`${silent ? "Ativar" : "Silenciar"} ${label.toLowerCase()}`} aria-pressed={silent} onClick={() => update(channel, { muted: !silent, ...(silent && level.volume === 0 ? { volume: 0.3 } : {}) })}>
                {silent ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </Button>
              <input id={`${id}-${channel}`} type="range" min={0} max={channelMaximum(channel) * 100} step={1} value={percent} aria-label={`Volume: ${label}`} aria-valuetext={`${percent}%${level.muted ? ", silenciado" : ""}`} className="h-11 min-w-0 w-full cursor-pointer accent-primary" onChange={event => update(channel, { volume: Number(event.currentTarget.value) / 100 })} />
            </div>
          </fieldset>;
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Ganho dos microfones: até 200%</span>
        <Button variant="outline" size="icon" className="h-11 w-11 flex-none" disabled={disabled} title="Restaurar configuração recomendada" aria-label="Restaurar configuração recomendada" onClick={onReset}><RotateCcw size={18} /></Button>
      </div>
      {musicControls}
      </div>
    </DialogContent>
  </Dialog>;
}
