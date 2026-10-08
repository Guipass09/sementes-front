import { useRef, useState, type PointerEvent } from "react";
import { Eraser, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };
// Same tools and green professional stroke as SessionCall: pencil and clear.
// This public demo draws locally and never sends a session command.
export default function LandingDrawingDemo({ onInteract }: { onInteract: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const pointer = useRef<number | null>(null);
  const point = (event: PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * 1000, y: (event.clientY - box.top) / box.height * (2000 / 3) };
  };
  const stop = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="lp-live-drawing">
    <div className="lp-live-drawing__bar">
      <span>Um jardim de descobertas<small>Cena ilustrativa para experimentar o lápis</small></span>
      <div>
        <Button variant="outline" className={enabled ? "rounded-xl border-brand-green text-brand-green" : "rounded-xl"} title="Rabiscar" aria-label="Rabiscar" aria-pressed={enabled}
          onClick={() => { onInteract(); setEnabled(value => !value); }}><Pencil size={16} /></Button>
        <Button variant="outline" className="rounded-xl" title="Apagar rabiscos" aria-label="Apagar rabiscos"
          onClick={() => { onInteract(); setShowHint(false); setStrokes([]); }}><Eraser size={16} /></Button>
      </div>
    </div>
    <div className="lp-live-drawing__surface">
      <img src="/landing/aventura-jardim.png" alt="Ilustração de duas crianças plantando em um jardim, com regador, flores, sapo no lago, tênis, balde e bola para explorar com o desenho" draggable={false} />
      <svg viewBox="0 0 1000 666.667" preserveAspectRatio="none" aria-label="Área para desenhar sobre a atividade" role="img" style={{ touchAction: enabled ? "none" : "auto", cursor: enabled ? "crosshair" : "default" }}
        onPointerDown={event => {
          if (!enabled || pointer.current !== null || event.button !== 0) return;
          onInteract(); setShowHint(false); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
          const first = point(event);
          setStrokes(previous => [...previous, [first]]);
        }}
        onPointerMove={event => {
          if (pointer.current !== event.pointerId) return;
          const next = point(event);
          setStrokes(previous => previous.length ? [...previous.slice(0, -1), [...previous[previous.length - 1], next]] : previous);
        }}
        onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { pointer.current = null; }}>
        {showHint && <path className="lp-live-drawing__hint" d="M 118 580 C 99 534 159 504 212 516 C 268 526 270 589 227 611 C 180 631 130 615 118 580 M 431 366 Q 459 380 467 440 M 452 425 L 467 440 L 480 423" />}
        {strokes.map((stroke, index) => <polyline key={index} data-drawing-stroke points={stroke.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
    </div>
    <div className="lp-live-drawing__prompt"><span>OLHE DE NOVO</span><strong>Onde está o sapo? E para onde vai a água?</strong></div>
    <p role="status">{strokes.length ? "Sua descoberta ganhou um traço. Use a borracha para começar outra vez." : "Circule o sapo ou ligue o regador à planta. Desenhe com o mouse ou o dedo."}</p>
    <small>Demonstração local do recurso de rabisco · nada é salvo</small>
  </div>;
}
