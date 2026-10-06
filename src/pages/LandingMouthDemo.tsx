import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import MouthModelScene, { type MouthView } from "@/features/mouth3d/MouthModelScene";
import type { MouthPose } from "@/features/mouth3d/createMouthModel";

const initialPose: MouthPose = { opening: .8, tongueLift: .12, tongueReach: .25, tongueCurl: 0, tongueSide: 0, tongueWidth: 0, lipShape: 0 };

export default function LandingMouthDemo({ onInteract }: { onInteract: () => void }) {
  const [pose, setPose] = useState(initialPose);
  const [view, setView] = useState<MouthView>("front");
  const id = useId();
  const update = (key: keyof MouthPose, value: number) => {
    onInteract();
    setPose(current => ({ ...current, [key]: value }));
  };
  return (
    <div className="lp-demo lp-mouth-demo" onPointerDownCapture={onInteract} onFocusCapture={onInteract}>
      <div className="lp-demo__heading">
        <div className="lp-demo__segmented" role="group" aria-label="Vista da boca">
          {([{ value: "front", label: "Frontal" }, { value: "angle", label: "Oblíqua" }, { value: "section", label: "Em corte" }] as const).map(item => (
            <button key={item.value} type="button" aria-pressed={view === item.value} onClick={() => { onInteract(); setView(item.value); }}>{item.label}</button>
          ))}
        </div>
        <button type="button" className="lp-demo__reset" aria-label="Restaurar boca" title="Restaurar posição inicial" onClick={() => { onInteract(); setPose(initialPose); setView("front"); }}><RotateCcw size={18} /></button>
      </div>
      <div className="lp-mouth-demo__stage">
        <MouthModelScene {...pose} view={view} dragMode="jaw" showFace showLabels={false} controlsOutside
          onOpeningChange={value => update("opening", value)} onTongueLiftChange={value => update("tongueLift", value)}
          onTongueReachChange={value => update("tongueReach", value)} onTongueCurlChange={value => update("tongueCurl", value)}
          onTongueSideChange={value => update("tongueSide", value)} />
      </div>
      <div className="lp-mouth-demo__controls">
        {([{ key: "opening", label: "Abertura da boca" }, { key: "tongueLift", label: "Elevação da língua" }] as const).map(control => (
          <div key={control.key}>
            <div className="lp-mouth-demo__label"><label htmlFor={`${id}-${control.key}`}>{control.label}</label><output htmlFor={`${id}-${control.key}`}>{Math.round(pose[control.key] * 100)}%</output></div>
            <input id={`${id}-${control.key}`} type="range" min="0" max="100" value={Math.round(pose[control.key] * 100)} onChange={event => update(control.key, Number(event.target.value) / 100)} />
          </div>
        ))}
      </div>
    </div>
  );
}
