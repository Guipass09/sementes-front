import { useEffect, useId, useState } from "react";
import { AudioLines, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { changeMouthDemo, MOUTH_DEMOS, MOUTH_DEMO_DURATION, MOUTH_DEMO_LEASE, type MouthDemoId, type MouthDemoState } from "./mouth-demonstrations";
import "./mouth-demonstrations.css";

export default function MouthDemoControls({ demo, onChange, now, live = false, onActivate, notice = "", position = 0 }: {
  demo: MouthDemoState | null; onChange: (demo: MouthDemoState | null) => void; now: () => number; live?: boolean;
  onActivate: () => void; notice?: string; position?: number;
}) {
  const id = useId();
  const [preset, setPreset] = useState<MouthDemoId>(demo?.preset || "trill");
  const [speed, setSpeed] = useState(demo?.speed || 1);
  const [repeat, setRepeat] = useState(demo?.repeat ?? true);
  const [volume, setVolume] = useState(demo?.volume ?? 0.7);
  const [muted, setMuted] = useState(demo?.muted ?? false);
  useEffect(() => { if (demo) { setPreset(demo.preset); setSpeed(demo.speed); setRepeat(demo.repeat); setVolume(demo.volume); setMuted(demo.muted); } }, [demo]);
  const info = MOUTH_DEMOS.find(p => p.id === preset)!;
  const playing = demo?.status === "playing";
  const patch = (value: Partial<MouthDemoState>) => { if (demo) onChange(changeMouthDemo(demo, value, now())); };
  const play = () => {
    onActivate();
    const time = now();
    if (playing && demo) { onChange(changeMouthDemo(demo, { status: "paused" }, time)); return; }
    onChange({ id: crypto.randomUUID(), preset, status: "playing", position: demo?.status === "paused" ? demo.position : 0,
      startedAt: time + (live ? 350 : 0), speed, repeat, volume, muted, expiresAt: live ? time + MOUTH_DEMO_LEASE : 0 });
  };
  return <details className="mouth-demos">
    <summary><AudioLines size={18} aria-hidden="true" /><span>Demonstrações com som</span>{playing && <span className="mouth-demos__badge">Em reprodução</span>}</summary>
    <div className="mouth-demos__body">
      <label htmlFor={`${id}-preset`}>Escolha a demonstração</label>
      <select id={`${id}-preset`} value={preset} onChange={e => { const value = e.target.value as MouthDemoId; onChange(null); setPreset(value); setRepeat(MOUTH_DEMOS.find(p => p.id === value)!.continuous); }}>
        {["Língua", "Lábios", "Sons prolongados"].map(group => <optgroup key={group} label={group}>{MOUTH_DEMOS.filter(p => p.group === group).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>)}
      </select>
      <p className="mouth-demos__cue">{info.cue}</p>
      <div className="mouth-demos__transport">
        <button type="button" className="mouth-demos__play" onClick={play}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? "Pausar" : demo?.status === "paused" ? "Continuar" : "Reproduzir"}</button>
        <button type="button" disabled={!demo} onClick={() => onChange(null)}><Square size={16} />Parar</button>
      </div>
      <div className="mouth-demos__progress" role="progressbar" aria-label="Progresso da demonstração" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position / MOUTH_DEMO_DURATION * 100)}><span style={{ width: `${position / MOUTH_DEMO_DURATION * 100}%` }} /></div>
      <div className="mouth-demos__settings">
        <label htmlFor={`${id}-speed`}>Velocidade<select id={`${id}-speed`} aria-label="Velocidade" value={speed} onChange={e => { const value = Number(e.target.value); setSpeed(value); patch({ speed: value }); }}><option value={0.5}>0,5× · Bem devagar</option><option value={0.75}>0,75× · Devagar</option><option value={1}>1× · Normal</option></select></label>
        <label className="mouth-demos__repeat"><input type="checkbox" checked={repeat} onChange={e => { setRepeat(e.target.checked); patch({ repeat: e.target.checked }); }} />Repetir até parar</label>
      </div>
      <label htmlFor={`${id}-volume`}>Volume do exemplo <output>{muted ? "Mudo" : `${Math.round(volume * 100)}%`}</output></label>
      <div className="mouth-demos__volume"><button type="button" aria-label={muted ? "Ativar som da demonstração" : "Silenciar demonstração"} title={muted ? "Ativar som" : "Silenciar"} onClick={() => { setMuted(!muted); patch({ muted: !muted }); }}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input id={`${id}-volume`} type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={e => { const value = Number(e.target.value) / 100; setVolume(value); patch({ volume: value }); }} /></div>
      {notice === "blocked" && <button type="button" className="mouth-demos__unlock" onClick={onActivate}><Volume2 size={16} />Toque para ativar o som</button>}
      {notice === "failed" && <p role="alert">Não foi possível carregar o exemplo. Pare e tente reproduzir novamente.</p>}
      {notice === "expired" && <p role="status">Demonstração interrompida por segurança. Toque em reproduzir para retomar.</p>}
      <p className="mouth-demos__note">Áudios sintéticos de exemplo. A fono orienta a produção do som. A vibração da ponta é diferente do toque curto.</p>
      {live && <p className="mouth-demos__note">Som integrado ao volume de atividade da chamada.</p>}
    </div>
  </details>;
}
