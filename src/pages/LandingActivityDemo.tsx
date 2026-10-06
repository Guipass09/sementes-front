import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, Check, Circle, RotateCcw } from "lucide-react";

const steps = ["Observe e conte", "Descubra os sons", "Organize a história"];
const words = [
  { name: "Sol", figure: "☀️", sound: true, color: "#fff0be" },
  { name: "Bola", figure: "⚽", sound: false, color: "#deeffb" },
  { name: "Sapo", figure: "🐸", sound: true, color: "#e4f2d9" },
  { name: "Flor", figure: "🌸", sound: false, color: "#f9e2ec" },
];
const moments = ["Plantar a semente", "Regar a plantinha", "Ver a flor crescer"];

export default function LandingActivityDemo({ onInteract, playing, reducedMotion }: { onInteract: () => void; playing: boolean; reducedMotion: boolean }) {
  const [viewport, carousel] = useEmblaCarousel({ watchDrag: false, duration: reducedMotion ? 0 : 25 });
  const [step, setStep] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  useEffect(() => {
    if (!carousel) return;
    const update = () => setStep(carousel.selectedScrollSnap());
    carousel.on("select", update);
    return () => { carousel.off("select", update); };
  }, [carousel]);
  useEffect(() => {
    if (!playing || !carousel || step === 2) return;
    const timer = setTimeout(() => carousel.scrollNext(), 5500);
    return () => clearTimeout(timer);
  }, [playing, carousel, step]);
  const navigate = (index: number) => { onInteract(); carousel?.scrollTo(index); };
  const restart = () => { onInteract(); setSelectedWords([]); setFeedback(""); setOrder([]); carousel?.scrollTo(0); };
  const chooseWord = (word: typeof words[number]) => {
    onInteract();
    if (!word.sound) { setFeedback("Vamos tentar outra figura?"); return; }
    const next = selectedWords.includes(word.name) ? selectedWords : [...selectedWords, word.name];
    setSelectedWords(next);
    setFeedback(next.length === 2 ? "Isso! Sol e sapo começam com o som /s/." : `${word.name} começa com o som /s/. Tem mais uma!`);
  };
  const ordered = order.length === 3 && order.every((value, index) => value === index);
  return (
    <div className="lp-demo lp-activity-demo" onPointerDownCapture={onInteract} onFocusCapture={onInteract}>
      <header className="lp-activity-demo__header"><div><span>UMA AVENTURA NO JARDIM</span><h4>{steps[step]}</h4></div><span className="lp-activity-demo__count">{step + 1} / 3</span></header>
      <div className="lp-activity-demo__viewport" ref={viewport}>
        <div className="lp-activity-demo__track">
          <section className="lp-activity-demo__slide" aria-label={steps[0]} aria-hidden={step !== 0}>
            <p>O que as crianças estão fazendo?</p>
            <img className="lp-activity-demo__garden" src="/landing/aventura-jardim.png" alt="Duas crianças cuidam de plantas no jardim. Há um sapo no lago, um sol, uma bola e flores." />
            <span className="lp-activity-demo__prompt">Quem está regando? O que você vê perto do lago?</span>
          </section>
          <section className="lp-activity-demo__slide" aria-label={steps[1]} aria-hidden={step !== 1}>
            <p>Quais palavras começam com o som <strong>/s/</strong>?</p>
            <div className="lp-activity-demo__words">
              {words.map(word => <button key={word.name} type="button" style={{ background: word.color }} aria-pressed={selectedWords.includes(word.name)} tabIndex={step === 1 ? 0 : -1} onClick={() => chooseWord(word)}>
                <span aria-hidden="true">{word.figure}</span><strong>{word.name}</strong>{selectedWords.includes(word.name) && <Check size={19} aria-hidden="true" />}
              </button>)}
            </div>
            <span className="lp-activity-demo__prompt" role="status" aria-live={step === 1 ? "polite" : "off"}>{feedback || "Sol, bola, sapo, flor. Vamos falar essas palavras?"}</span>
          </section>
          <section className="lp-activity-demo__slide" aria-label={steps[2]} aria-hidden={step !== 2}>
            <p>O que aconteceu primeiro?</p>
            <div className="lp-activity-demo__story">
              {[2, 0, 1].map(moment => <button type="button" key={moment} disabled={order.includes(moment)} tabIndex={step === 2 ? 0 : -1} aria-label={`${moments[moment]}${order.includes(moment) ? `, posição ${order.indexOf(moment) + 1}` : ""}`} onClick={() => { onInteract(); setOrder(current => current.includes(moment) ? current : [...current, moment]); }}>
                <span className="lp-activity-demo__story-image" role="img" aria-label={moments[moment]} style={{ backgroundPosition: `${moment * 50}% center` }} />
                <span className="lp-activity-demo__story-label"><b>{order.includes(moment) ? order.indexOf(moment) + 1 : "?"}</b>{moments[moment]}</span>
              </button>)}
            </div>
            <div className="lp-activity-demo__prompt" role="status" aria-live={step === 2 ? "polite" : "off"}><span>{order.length < 3 ? "Primeiro... depois... e no final?" : ordered ? "Isso! Plantar, regar e ver a flor crescer." : "Vamos tentar de novo? Tudo começa com a semente."}</span><button type="button" aria-label="Reordenar história" title="Reordenar história" tabIndex={step === 2 ? 0 : -1} onClick={() => { onInteract(); setOrder([]); }}><RotateCcw size={17} /></button></div>
          </section>
        </div>
      </div>
      <footer className="lp-activity-demo__navigation">
        <button type="button" className="lp-demo__reset" aria-label="Slide anterior" title="Slide anterior" disabled={step === 0} onClick={() => navigate(step - 1)}><ArrowLeft size={18} /></button>
        <div role="group" aria-label="Etapas da atividade">{steps.map((label, index) => <button type="button" key={label} aria-label={`Etapa ${index + 1}: ${label}`} aria-pressed={step === index} title={label} onClick={() => navigate(index)}><Circle size={10} fill={step === index ? "currentColor" : "none"} /></button>)}</div>
        <button type="button" className="lp-demo__reset" aria-label={step === 2 ? "Recomeçar atividade" : "Próximo slide"} title={step === 2 ? "Recomeçar atividade" : "Próximo slide"} onClick={() => step === 2 ? restart() : navigate(step + 1)}>{step === 2 ? <RotateCcw size={18} /> : <ArrowRight size={18} />}</button>
      </footer>
    </div>
  );
}
