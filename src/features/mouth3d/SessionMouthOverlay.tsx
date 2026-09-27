import { useRef, useState, type PointerEvent } from "react";
import { Grip, Maximize2, RotateCcw, ScanFace, Settings2, X } from "lucide-react";
import MouthModelScene, { type MouthDragMode, type MouthView } from "./MouthModelScene";
import { initialSessionMouthState, normalizeSessionMouthState, type SessionMouthState } from "./sessionMouthState";
import "./mouth3d.css";
import "./sessionMouthOverlay.css";

type Props = { state: SessionMouthState; editable: boolean; onChange: (next: SessionMouthState) => void };

export default function SessionMouthOverlay({ state, editable, onChange }: Props) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [dragMode, setDragMode] = useState<MouthDragMode>("jaw");
  const gesture = useRef<{ kind: "move" | "resize"; x: number; y: number; state: SessionMouthState; width: number; height: number } | null>(null);

  if (!state.open) return null;

  const update = (patch: Partial<SessionMouthState>) => onChange(normalizeSessionMouthState({ ...state, ...patch }));
  const updatePose = (patch: Partial<SessionMouthState["pose"]>) => update({ pose: { ...state.pose, ...patch } });
  const startGesture = (event: PointerEvent<HTMLElement>, kind: "move" | "resize") => {
    if (!editable) return;
    const parent = event.currentTarget.parentElement?.parentElement;
    if (!parent) return;
    const box = parent.getBoundingClientRect();
    gesture.current = { kind, x: event.clientX, y: event.clientY, state, width: box.width, height: box.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveGesture = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active) return;
    const dx = (event.clientX - active.x) / active.width;
    const dy = (event.clientY - active.y) / active.height;
    if (active.kind === "move") {
      onChange(normalizeSessionMouthState({ ...active.state, x: active.state.x + dx, y: active.state.y + dy }));
    } else {
      onChange(normalizeSessionMouthState({ ...active.state, w: Math.min(1 - active.state.x, active.state.w + dx), h: Math.min(1 - active.state.y, active.state.h + dy) }));
    }
  };
  const stopGesture = () => { gesture.current = null; };
  const control = (label: string, key: keyof SessionMouthState["pose"], signed = false) => (
    <label className="sc-mouth-control" key={key}>
      <span>{label}<output>{Math.round(state.pose[key] * 100)}%</output></span>
      <input type="range" aria-label={label} min={signed ? -100 : 0} max="100" value={Math.round(state.pose[key] * 100)} onChange={(event) => updatePose({ [key]: Number(event.target.value) / 100 })} />
    </label>
  );

  return (
    <div className={`sc-mouth-overlay${editable ? "" : " sc-mouth-overlay--readonly"}`} data-testid="session-mouth-overlay" style={{ left: `${state.x * 100}%`, top: `${state.y * 100}%`, width: `${state.w * 100}%`, height: `${state.h * 100}%` }}>
      <div className="sc-mouth-header" onPointerDown={(event) => { if (!(event.target as HTMLElement).closest("button")) startGesture(event, "move"); }} onPointerMove={moveGesture} onPointerUp={stopGesture} onPointerCancel={stopGesture}>
        <span><ScanFace size={17} /> Boca 3D</span>
        {editable && <div className="sc-mouth-header-actions">
          <Grip size={17} aria-hidden="true" />
          <button type="button" title="Movimentos da boca" aria-label="Movimentos da boca" aria-expanded={controlsOpen} onClick={() => setControlsOpen((value) => !value)}><Settings2 size={17} /></button>
          <button type="button" title="Fechar Boca 3D" aria-label="Fechar Boca 3D" onClick={() => update({ open: false })}><X size={17} /></button>
        </div>}
      </div>
      <div className="sc-mouth-model">
        <MouthModelScene {...state.pose} compact view={state.view} dragMode={dragMode} showFace={state.showFace} showLabels={false}
          onOpeningChange={(opening) => updatePose({ opening, lipShape: opening > 0.05 ? 0 : state.pose.lipShape })}
          onTongueLiftChange={(tongueLift) => updatePose({ tongueLift })}
          onTongueReachChange={(tongueReach) => updatePose({ tongueReach })}
          onTongueCurlChange={(tongueCurl) => updatePose({ tongueCurl })}
          onTongueSideChange={(tongueSide) => updatePose({ tongueSide })} />
      </div>
      {editable && controlsOpen && <div className="sc-mouth-options" aria-label="Movimentos da Boca 3D">
        <div className="sc-mouth-options-row"><strong>Movimentos</strong><button type="button" title="Repor movimentos" aria-label="Repor movimentos" onClick={() => update({ pose: initialSessionMouthState.pose })}><RotateCcw size={16} /></button></div>
        <div className="sc-mouth-options-row" role="group" aria-label="Vista da boca">
          {([["front", "Frontal"], ["angle", "Oblíqua"], ["section", "Corte"]] as [MouthView, string][]).map(([value, label]) => <button key={value} type="button" className={state.view === value ? "selected" : ""} onClick={() => update({ view: value })}>{label}</button>)}
        </div>
        <div className="sc-mouth-options-row" role="group" aria-label="Arrastar modelo">
          {([["jaw", "Boca"], ["tongue", "Língua"], ["tip", "Ponta"]] as [MouthDragMode, string][]).map(([value, label]) => <button key={value} type="button" className={dragMode === value ? "selected" : ""} onClick={() => setDragMode(value)}>{label}</button>)}
        </div>
        {control("Abertura", "opening")}
        {control("Elevação da língua", "tongueLift")}
        {control("Avanço da língua", "tongueReach")}
        {control("Curvatura da ponta", "tongueCurl", true)}
        {control("Movimento lateral", "tongueSide", true)}
        {control("Largura da língua", "tongueWidth", true)}
        {control("Lábios: bico / sorriso", "lipShape", true)}
        <label className="sc-mouth-face"><input type="checkbox" checked={state.showFace} onChange={(event) => update({ showFace: event.target.checked })} /> Mostrar rosto</label>
      </div>}
      {editable && <div className="sc-mouth-resize" role="button" tabIndex={0} aria-label="Redimensionar Boca 3D" title="Arraste para mudar o tamanho" onPointerDown={(event) => startGesture(event, "resize")} onPointerMove={moveGesture} onPointerUp={stopGesture} onPointerCancel={stopGesture} onKeyDown={(event) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        const amount = event.shiftKey ? 0.05 : 0.02;
        update({ w: Math.min(1 - state.x, state.w + (event.key === "ArrowRight" ? amount : event.key === "ArrowLeft" ? -amount : 0)), h: Math.min(1 - state.y, state.h + (event.key === "ArrowDown" ? amount : event.key === "ArrowUp" ? -amount : 0)) });
      }}><Maximize2 size={17} /></div>}
    </div>
  );
}
