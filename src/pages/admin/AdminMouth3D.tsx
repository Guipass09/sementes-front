import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, ScanFace, SlidersHorizontal } from "lucide-react";
import MouthModelScene, { type MouthView } from "@/features/mouth3d/MouthModelScene";
import "@/features/mouth3d/mouth3d.css";

type MouthPosition = {
  opening: number;
  tongueLift: number;
  tongueReach: number;
};

const neutralPosition: MouthPosition = { opening: 0.48, tongueLift: 0.28, tongueReach: 0.38 };

const positions: { name: string; values: MouthPosition }[] = [
  { name: "Repouso", values: { opening: 0, tongueLift: 0.24, tongueReach: 0.26 } },
  { name: "Boca aberta", values: { opening: 0.88, tongueLift: 0.18, tongueReach: 0.34 } },
  { name: "Língua elevada", values: { opening: 0.7, tongueLift: 0.91, tongueReach: 0.47 } },
  { name: "Língua anterior", values: { opening: 0.7, tongueLift: 0.4, tongueReach: 0.96 } },
];

export default function AdminMouth3D() {
  const [opening, setOpening] = useState(neutralPosition.opening);
  const [tongueLift, setTongueLift] = useState(neutralPosition.tongueLift);
  const [tongueReach, setTongueReach] = useState(neutralPosition.tongueReach);
  const [view, setView] = useState<MouthView>("front");

  const setPosition = ({ opening: nextOpening, tongueLift: nextLift, tongueReach: nextReach }: MouthPosition) => {
    setOpening(nextOpening);
    setTongueLift(nextLift);
    setTongueReach(nextReach);
  };

  return (
    <main className="mouth3d-page">
      <div className="mouth3d-heading">
        <div className="mouth3d-title-group">
          <Link to="/admin/jogos" className="mouth3d-back" title="Voltar aos jogos" aria-label="Voltar aos jogos">
            <ArrowLeft size={19} />
          </Link>
          <div>
            <div className="mouth3d-eyebrow">Estúdio articulatório</div>
            <h1>Boca 3D</h1>
          </div>
        </div>
        <div className="mouth3d-status"><span /> Protótipo admin</div>
      </div>

      <div className="mouth3d-workspace">
        <section className="mouth3d-stage" aria-label="Visualização da boca em 3D">
          <div className="mouth3d-stage-top">
            <div className="mouth3d-stage-label"><ScanFace size={18} /> Modelo articulatório</div>
            <div className="mouth3d-view-switch" role="group" aria-label="Vista do modelo">
              <button type="button" className={view === "front" ? "active" : ""} onClick={() => setView("front")} aria-pressed={view === "front"}>Frontal</button>
              <button type="button" className={view === "angle" ? "active" : ""} onClick={() => setView("angle")} aria-pressed={view === "angle"}>Oblíqua</button>
            </div>
          </div>

          <MouthModelScene
            opening={opening}
            tongueLift={tongueLift}
            tongueReach={tongueReach}
            view={view}
            onOpeningChange={setOpening}
            onTongueLiftChange={setTongueLift}
            onTongueReachChange={setTongueReach}
          />

          <div className="mouth3d-stage-bottom" aria-hidden="true">SEMENTES DA FALA</div>
        </section>

        <aside className="mouth3d-controls" aria-label="Controles do modelo">
          <div className="mouth3d-controls-heading">
            <div className="mouth3d-controls-icon"><SlidersHorizontal size={19} /></div>
            <div>
              <h2>Movimentos</h2>
              <p>Posição do modelo</p>
            </div>
            <button type="button" className="mouth3d-reset" title="Repor posição inicial" aria-label="Repor posição inicial" onClick={() => setPosition(neutralPosition)}>
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="mouth3d-control-section">
            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="mouth-opening">Abertura da boca</label><output htmlFor="mouth-opening">{Math.round(opening * 100)}%</output></div>
              <input id="mouth-opening" type="range" min="0" max="100" value={Math.round(opening * 100)} onChange={(event) => setOpening(Number(event.target.value) / 100)} style={{ "--range-progress": `${opening * 100}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Fechada</span><span>Aberta</span></div>
            </div>

            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="tongue-lift">Elevação da língua</label><output htmlFor="tongue-lift">{Math.round(tongueLift * 100)}%</output></div>
              <input id="tongue-lift" type="range" min="0" max="100" value={Math.round(tongueLift * 100)} onChange={(event) => setTongueLift(Number(event.target.value) / 100)} style={{ "--range-progress": `${tongueLift * 100}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Baixa</span><span>Elevada</span></div>
            </div>

            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="tongue-reach">Avanço da língua</label><output htmlFor="tongue-reach">{Math.round(tongueReach * 100)}%</output></div>
              <input id="tongue-reach" type="range" min="0" max="100" value={Math.round(tongueReach * 100)} onChange={(event) => setTongueReach(Number(event.target.value) / 100)} style={{ "--range-progress": `${tongueReach * 100}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Posterior</span><span>Anterior</span></div>
            </div>
          </div>

          <div className="mouth3d-presets">
            <h3>Posições rápidas</h3>
            <div className="mouth3d-preset-list">
              {positions.map((position, index) => (
                <button type="button" key={position.name} onClick={() => setPosition(position.values)}>
                  <span className="mouth3d-preset-number">0{index + 1}</span>
                  <span>{position.name}</span>
                  <span className="mouth3d-preset-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mouth3d-notice">Modelo visual em desenvolvimento. Posições articulatórias ainda não validadas clinicamente.</div>
        </aside>
      </div>
    </main>
  );
}
