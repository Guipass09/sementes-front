import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, RotateCcw, ScanFace, SlidersHorizontal } from "lucide-react";
import MouthModelScene, { type MouthView, type MouthDragMode } from "@/features/mouth3d/MouthModelScene";
import type { MouthPose } from "@/features/mouth3d/createMouthModel";
import "@/features/mouth3d/mouth3d.css";

type MouthPosition = MouthPose;
const neutralPosition: MouthPosition = { opening: 0.85, tongueLift: 0.12, tongueReach: 0.25, tongueCurl: 0, tongueSide: 0, tongueWidth: 0, lipShape: 0 };

const positions: { name: string; values: Omit<MouthPosition, "tongueWidth" | "lipShape"> }[] = [
  { name: "Repouso", values: { opening: 0, tongueLift: 0.24, tongueReach: 0.26, tongueCurl: 0, tongueSide: 0 } },
  { name: "Boca aberta", values: { opening: 0.88, tongueLift: 0.18, tongueReach: 0.34, tongueCurl: 0, tongueSide: 0 } },
  { name: "Língua elevada", values: { opening: 0.7, tongueLift: 0.91, tongueReach: 0.47, tongueCurl: 0, tongueSide: 0 } },
  { name: "Língua anterior", values: { opening: 0.7, tongueLift: 0.4, tongueReach: 0.96, tongueCurl: 0, tongueSide: 0 } },
  { name: "Ponta para cima", values: { opening: 0.85, tongueLift: 0.18, tongueReach: 1, tongueCurl: 0.85, tongueSide: 0 } },
  { name: "Ponta para baixo", values: { opening: 0.85, tongueLift: 0.18, tongueReach: 1, tongueCurl: -0.85, tongueSide: 0 } },
];

export default function AdminMouth3D() {
  const [opening, setOpening] = useState(neutralPosition.opening);
  const [tongueLift, setTongueLift] = useState(neutralPosition.tongueLift);
  const [tongueReach, setTongueReach] = useState(neutralPosition.tongueReach);
  const [tongueCurl, setTongueCurl] = useState(0);
  const [tongueSide, setTongueSide] = useState(0);
  const [tongueWidth, setTongueWidth] = useState(0);
  const [lipShape, setLipShape] = useState(0);
  const [view, setView] = useState<MouthView>("front");
  const [dragMode, setDragMode] = useState<MouthDragMode>("jaw");
  const [showFace, setShowFace] = useState(true);
  const [showLabels, setShowLabels] = useState(false);

  const setPosition = ({ opening: nextOpening, tongueLift: nextLift, tongueReach: nextReach, tongueCurl: nextCurl, tongueSide: nextSide, tongueWidth: nextWidth, lipShape: nextShape }: MouthPosition) => {
    setOpening(nextOpening);
    setTongueLift(nextLift);
    setTongueReach(nextReach);
    setTongueCurl(nextCurl);
    setTongueSide(nextSide);
    setTongueWidth(nextWidth);
    setLipShape(nextShape);
  };

  const changeLipShape = (value: number) => {
    setLipShape(value);
    setOpening(0);
    setShowFace(true);
    if (view === "section") setView("front");
  };

  const changeTongueWidth = (value: number) => {
    setTongueWidth(value);
    setLipShape(0);
    setOpening((current) => Math.max(current, 0.8));
    setTongueReach((current) => Math.max(current, 0.95));
  };

  const changeOpening = (value: number) => {
    setOpening(value);
    if (value > 0.05) setLipShape(0);
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
              <button type="button" className={view === "section" ? "active" : ""} onClick={() => setView("section")} aria-pressed={view === "section"}>Em corte</button>
            </div>
          </div>

          <MouthModelScene
            opening={opening}
            tongueLift={tongueLift}
            tongueReach={tongueReach}
            tongueCurl={tongueCurl}
            tongueSide={tongueSide}
            tongueWidth={tongueWidth}
            lipShape={lipShape}
            view={view}
            dragMode={dragMode}
            showFace={showFace}
            showLabels={showLabels}
            onOpeningChange={changeOpening}
            onTongueLiftChange={setTongueLift}
            onTongueReachChange={setTongueReach}
            onTongueCurlChange={setTongueCurl}
            onTongueSideChange={setTongueSide}
          />

          <div className="mouth3d-stage-bottom">
            <div className="mouth3d-view-switch" role="group" aria-label="Movimento ao arrastar">
              <button type="button" title="Arrastar para abrir e fechar a boca" className={dragMode === "jaw" ? "active" : ""} onClick={() => setDragMode("jaw")} aria-pressed={dragMode === "jaw"}>Mandíbula</button>
              <button type="button" title={view === "section" ? "Arrastar para elevar e avançar a língua" : "Arrastar para elevar e mover a língua para os lados"} className={dragMode === "tongue" ? "active" : ""} onClick={() => setDragMode("tongue")} aria-pressed={dragMode === "tongue"}>Língua</button>
              <button type="button" title="Arrastar para dobrar a ponta para cima ou para baixo" className={dragMode === "tip" ? "active" : ""} onClick={() => setDragMode("tip")} aria-pressed={dragMode === "tip"}>Ponta</button>
            </div>
            <span aria-hidden="true">SEMENTES DA FALA</span>
          </div>
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
            <div className="mouth3d-control-group mouth3d-expression">
              <div className="mouth3d-control-label"><label htmlFor="lip-shape">Posição dos lábios</label><output htmlFor="lip-shape">{lipShape === 0 ? "Normal" : `${Math.round(Math.abs(lipShape) * 100)}%`}</output></div>
              <div className="mouth3d-view-switch mouth3d-shape-switch" role="group" aria-label="Formato dos lábios">
                {[{ name: "Bico", value: -1 }, { name: "Normal", value: 0 }, { name: "Sorriso", value: 1 }].map(({ name, value }) => (
                  <button type="button" key={name} className={Math.sign(lipShape) === value ? "active" : ""} aria-pressed={Math.sign(lipShape) === value} onClick={() => changeLipShape(value)}>{name}</button>
                ))}
              </div>
              <input id="lip-shape" className="mouth3d-range-signed" type="range" min="-100" max="100" value={Math.round(lipShape * 100)} aria-valuetext={lipShape === 0 ? "Normal" : `${Math.round(Math.abs(lipShape) * 100)}% ${lipShape < 0 ? "bico" : "sorriso"}`} onChange={(event) => changeLipShape(Number(event.target.value) / 100)} style={{ "--range-start": `${50 + Math.min(0, lipShape) * 50}%`, "--range-end": `${50 + Math.max(0, lipShape) * 50}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Bico</span><span>Sorriso</span></div>
            </div>
            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="mouth-opening">Abertura da boca</label><output htmlFor="mouth-opening">{Math.round(opening * 100)}%</output></div>
              <input id="mouth-opening" type="range" min="0" max="100" value={Math.round(opening * 100)} onChange={(event) => changeOpening(Number(event.target.value) / 100)} style={{ "--range-progress": `${opening * 100}%` } as React.CSSProperties} />
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

            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="tongue-width">Largura da língua</label><output htmlFor="tongue-width">{tongueWidth === 0 ? "Normal" : `${Math.round(Math.abs(tongueWidth) * 100)}%`}</output></div>
              <div className="mouth3d-view-switch mouth3d-shape-switch" role="group" aria-label="Formato da língua">
                {[{ name: "Fina", value: -1 }, { name: "Normal", value: 0 }, { name: "Larga", value: 1 }].map(({ name, value }) => (
                  <button type="button" key={name} className={Math.sign(tongueWidth) === value ? "active" : ""} aria-pressed={Math.sign(tongueWidth) === value} onClick={() => changeTongueWidth(value)}>{name}</button>
                ))}
              </div>
              <input id="tongue-width" className="mouth3d-range-signed" type="range" min="-100" max="100" value={Math.round(tongueWidth * 100)} aria-valuetext={tongueWidth === 0 ? "Normal" : `${Math.round(Math.abs(tongueWidth) * 100)}% ${tongueWidth < 0 ? "fina" : "larga"}`} onChange={(event) => changeTongueWidth(Number(event.target.value) / 100)} style={{ "--range-start": `${50 + Math.min(0, tongueWidth) * 50}%`, "--range-end": `${50 + Math.max(0, tongueWidth) * 50}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Fina</span><span>Larga</span></div>
            </div>

            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="tongue-curl">Curvatura da ponta</label><output htmlFor="tongue-curl">{Math.round(tongueCurl * 100)}%</output></div>
              <input id="tongue-curl" className="mouth3d-range-signed" type="range" min="-100" max="100" value={Math.round(tongueCurl * 100)} aria-valuetext={tongueCurl === 0 ? "Neutra" : `${Math.round(Math.abs(tongueCurl) * 100)}% para ${tongueCurl > 0 ? "cima" : "baixo"}`} onChange={(event) => setTongueCurl(Number(event.target.value) / 100)} style={{ "--range-start": `${50 + Math.min(0, tongueCurl) * 50}%`, "--range-end": `${50 + Math.max(0, tongueCurl) * 50}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Para baixo</span><button type="button" onClick={() => setTongueCurl(0)} title="Zerar curvatura da ponta">Neutra</button><span>Para cima</span></div>
            </div>

            <div className="mouth3d-control-group">
              <div className="mouth3d-control-label"><label htmlFor="tongue-side">Movimento lateral</label><output htmlFor="tongue-side">{Math.round(tongueSide * 100)}%</output></div>
              <input id="tongue-side" className="mouth3d-range-signed" type="range" min="-100" max="100" value={Math.round(tongueSide * 100)} aria-valuetext={tongueSide === 0 ? "Centralizada" : `${Math.round(Math.abs(tongueSide) * 100)}% para a ${tongueSide > 0 ? "direita" : "esquerda"} da tela`} onChange={(event) => setTongueSide(Number(event.target.value) / 100)} style={{ "--range-start": `${50 + Math.min(0, tongueSide) * 50}%`, "--range-end": `${50 + Math.max(0, tongueSide) * 50}%` } as React.CSSProperties} />
              <div className="mouth3d-range-ends"><span>Esquerda</span><button type="button" onClick={() => setTongueSide(0)} title="Centralizar a língua">Centro</button><span>Direita</span></div>
            </div>
          </div>

          <div className="mouth3d-presets">
            <h3>Posições rápidas</h3>
            <div className="mouth3d-preset-list">
              {positions.map((position) => (
                <button type="button" key={position.name} onClick={() => setPosition({ ...position.values, tongueWidth: 0, lipShape: 0 })}>
                  <span>{position.name}</span>
                  <ArrowUpRight className="mouth3d-preset-arrow" size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="mouth3d-visibility">
            <label><input type="checkbox" checked={showFace} onChange={(event) => setShowFace(event.target.checked)} /> Lábios e face</label>
            <label><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /> Identificar estruturas</label>
          </div>
          <div className="mouth3d-notice">Modelo visual em desenvolvimento. Posições articulatórias ainda não validadas clinicamente.</div>
        </aside>
      </div>
    </main>
  );
}
