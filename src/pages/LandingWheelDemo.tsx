import { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCw } from "lucide-react";

const options = [
  { label: "SOL", figure: "☀️", color: "#ffe16b" },
  { label: "BOLA", figure: "⚽", color: "#8cd5f3" },
  { label: "SAPO", figure: "🐸", color: "#a9df94" },
  { label: "SINO", figure: "🔔", color: "#e6bbef" },
  { label: "CARRO", figure: "🚗", color: "#ffa989" },
  { label: "BALÃO", figure: "🎈", color: "#99ded3" },
];
const point = (angle: number, radius: number) => [200 + Math.cos(angle * Math.PI / 180) * radius, 200 + Math.sin(angle * Math.PI / 180) * radius];

export default function LandingWheelDemo({ onInteract, reducedMotion }: { onInteract: () => void; reducedMotion: boolean }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  const spin = () => {
    if (timer.current !== null) return;
    onInteract();
    const winner = Math.floor(Math.random() * options.length);
    setSelected(null);
    setSpinning(true);
    setRotation(current => Math.ceil(current / 360) * 360 + 1440 + (360 - (winner * 60 + 30)) % 360);
    timer.current = setTimeout(() => {
      setSelected(winner);
      setSpinning(false);
      timer.current = null;
    }, reducedMotion ? 0 : 3200);
  };

  return (
    <div className="lp-demo lp-wheel-demo" onPointerDownCapture={onInteract} onFocusCapture={onInteract}>
      <div className="lp-demo__heading"><span>Roleta dos sons</span><span className="lp-demo__badge">Demonstração</span></div>
      <div className="lp-wheel-demo__stage">
        <div className="lp-wheel-demo__wheel">
          <ChevronDown className="lp-wheel-demo__pointer" size={36} strokeWidth={4} aria-hidden="true" />
          <svg viewBox="0 0 400 400" role="img" aria-label="Roleta com sol, bola, sapo, sino, carro e balão"
            style={{ transform: `rotate(${rotation}deg)`, transition: reducedMotion ? "none" : "transform 3.2s cubic-bezier(.15,.65,.15,1)" }}>
            {options.map((item, index) => {
              const angle = -90 + index * 60;
              const [x1, y1] = point(angle, 192);
              const [x2, y2] = point(angle + 60, 192);
              const [ix, iy] = point(angle + 30, 133);
              const [tx, ty] = point(angle + 30, 86);
              return <g key={item.label}>
                <path d={`M200 200 L${x1} ${y1} A192 192 0 0 1 ${x2} ${y2} Z`} fill={item.color} stroke="#fff" strokeWidth="3" />
                <text x={ix} y={iy} textAnchor="middle" dominantBaseline="central" fontSize="43" transform={`rotate(${angle + 120} ${ix} ${iy})`}>{item.figure}</text>
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fill="#233b30" transform={`rotate(${angle + 120} ${tx} ${ty})`}>{item.label}</text>
              </g>;
            })}
            <circle cx="200" cy="200" r="194" fill="none" stroke="#fff" strokeWidth="8" />
          </svg>
          <div className="lp-wheel-demo__center"><img src="/landing/sementes-logo-transparent.png" alt="Sementes da Fala" /></div>
        </div>
      </div>
      <div className="lp-wheel-demo__footer">
        <div className="lp-wheel-demo__result" role="status" aria-live="polite">
          {selected === null ? <span>{spinning ? "Sorteando..." : "Roleta dos sons"}</span> : <><span aria-hidden="true">{options[selected].figure}</span><strong>{options[selected].label}</strong></>}
        </div>
        <button type="button" className="lp-demo__action" onClick={spin} disabled={spinning}><RotateCw size={18} />{spinning ? "Girando..." : "Girar roleta"}</button>
      </div>
    </div>
  );
}
