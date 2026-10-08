import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FileText, Images, Maximize2, MonitorUp, NotebookPen, Pause, Pencil, Play, ScanFace, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./landing-live-sessions.css";
import LandingDrawingDemo from "./LandingDrawingDemo";
import { landingReportExample } from "./landing-report-example";

const ReportPreview = lazy(() => import("@/features/reports/ReportPreviewModal").then(module => ({ default: module.ReportPreviewModal })));

// Use an illustrative photo for the opening scene and original product screenshots.
const slides = [
  {
    label: "Atividades ao vivo", icon: MonitorUp,
    tag: "CONEXÃO DOS DOIS LADOS DA TELA",
    title: "A distância muda. A conexão continua.",
    text: "Um olhar para o atendimento online: a criança, a família e a profissional reunidas em torno da atividade.",
    benefit: "O atendimento centrado na interação",
    image: "/landing/atividade-compartilhada.png",
    alt: "Imagem ilustrativa de uma criança acompanhada por um adulto, apontando para uma atividade durante uma videochamada com a profissional",
    caption: "Foto ilustrativa do atendimento",
  },
  {
    label: "Atividade + Boca 3D", icon: ScanFace,
    tag: "A EXPLICAÇÃO JUNTO DA ATIVIDADE",
    title: "Boca 3D na mesma tela da atividade.",
    text: "Veja a janela da Boca 3D sobre a atividade, com as imagens e o recurso de ouvir a palavra. Assim ela aparece no sistema.",
    benefit: "Atividade e Boca 3D no mesmo espaço",
    image: "/landing/sessao-real-boca-3d.png",
    alt: "Captura real do sistema: atividade com imagens de vaca e peixe, botão Ouvir palavra e janela flutuante Boca 3D",
    caption: "Captura real do sistema",
  },
  {
    label: "Catálogo na sessão", icon: Images,
    tag: "SEUS MATERIAIS DURANTE O ATENDIMENTO",
    title: "O catálogo aberto dentro da sessão.",
    text: "Confira a grade real de atividades: imagens, títulos e categorias dos materiais, no catálogo aberto durante a sessão ao vivo.",
    benefit: "Materiais organizados em uma grade visual",
    image: "/landing/sessao-real-catalogo.png",
    alt: "Captura real do catálogo na sessão ao vivo, com a grade de atividades de fluência, R vibrante, escrita, articulação e outros materiais",
    caption: "Captura real do sistema",
  },
  {
    label: "Lápis na tela", icon: Pencil,
    tag: "CADA TRAÇO ABRE UMA CONVERSA",
    title: "Uma cena. Muitas descobertas.",
    text: "Encontre o sapo, acompanhe o caminho da água e explore os detalhes do jardim. Experimente o lápis sobre a ilustração e use a borracha para começar de novo.",
    benefit: "Rabiscos sobre o conteúdo, durante a chamada",
    image: "/landing/aventura-jardim.png",
    alt: "Demonstração do lápis sobre uma ilustração narrativa de crianças em um jardim",
    caption: "Demonstração interativa do recurso",
    demo: "drawing",
  },
  {
    label: "Evoluções", icon: NotebookPen,
    tag: "DO ENCONTRO AO REGISTRO",
    title: "Registre a evolução durante a sessão.",
    text: "No editor de evolução, preencha o título, a data e o registro clínico. O sistema salva o rascunho automaticamente e permite minimizar ou finalizar o documento.",
    benefit: "Rascunho, salvamento automático e finalização",
    image: "/landing/evolucao-sistema-demo.png",
    alt: "Editor real de evolução com título, data, registro clínico e botões Minimizar e Finalizar, preenchido com dados fictícios",
    caption: "Interface real · dados fictícios",
    demo: "evolution",
  },
  {
    label: "Relatórios", icon: FileText,
    tag: "O ACOMPANHAMENTO GANHA UM DOCUMENTO",
    title: "Visualize o relatório. Leve em PDF.",
    text: "Reúna a identificação, a data e o registro do atendimento em um relatório. Abra o exemplo para conhecer a visualização real e experimentar o download em PDF.",
    benefit: "Relatórios mensais, trimestrais e avaliações",
    image: "/landing/relatorio-sistema-demo.png",
    alt: "Visualização real de um relatório de acompanhamento com dados fictícios e botão Baixar PDF",
    caption: "Interface real · dados fictícios",
    demo: "report",
  },
];

export default function LandingLiveSessions() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sessionExampleOpen, setSessionExampleOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const slide = slides[active];
  const demo = "demo" in slide ? slide.demo : null;
  const playing = visible && pageVisible && !paused && !hovered && !reduced && !expanded && !sessionExampleOpen;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    if (root.current) observer.observe(root.current);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setActive(value => (value + 1) % slides.length), 8000);
    return () => window.clearTimeout(timer);
  }, [active, playing]);
  const select = (index: number) => {
    setActive((index + slides.length) % slides.length);
    setPaused(true);
  };

  return (
    <section ref={root} className="lp-live lp-section" id="sessoes-ao-vivo" aria-labelledby="lp-live-title" style={{ "--live-duration": "8000ms" } as CSSProperties}>
      <div className="lp-container">
        <header className="lp-live__intro">
          <div><p className="lp-kicker"><span className="lp-live__pulse" /> TELEATENDIMENTO QUE ENVOLVE</p><h2 id="lp-live-title">Muito além da chamada.<br /><em>Veja a sessão por dentro.</em></h2></div>
          <p>Da atividade compartilhada ao registro do atendimento. Explore o lápis, a Boca 3D, as evoluções e os relatórios.</p>
        </header>
        <div className="lp-live__glass" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onFocusCapture={event => { if (!(event.target as Element).closest(".lp-live__controls")) setPaused(true); }}>
          <div className="lp-live__room-top"><span><Video size={17} /> Por dentro da sessão ao vivo</span><span>{slide.caption}</span></div>
          <div className="lp-live__layout">
            <div id="live-session-panel" role="tabpanel" aria-labelledby={`live-tab-${active}`} className="lp-live__capture"
              onTouchStart={event => { touchX.current = demo === "drawing" ? null : event.touches[0].clientX; }}
              onTouchCancel={() => { touchX.current = null; }}
              onTouchEnd={event => {
                if (touchX.current !== null && Math.abs(event.changedTouches[0].clientX - touchX.current) > 55) select(active + (event.changedTouches[0].clientX < touchX.current ? 1 : -1));
                touchX.current = null;
              }}>
              {demo === "drawing" ? <LandingDrawingDemo onInteract={() => setPaused(true)} /> : <figure key={active} className="lp-live__figure">
                <div className="lp-live__image-stage" data-photo={active === 0}><img src={slide.image} alt={slide.alt} loading="lazy" /></div>
                <figcaption><span>{slide.label}</span><button type="button" onClick={() => { setPaused(true); setExpanded(true); }}><Maximize2 size={15} /> {demo === "report" ? "Abrir relatório de exemplo" : "Ampliar captura"}</button></figcaption>
              </figure>}
            </div>
            <div key={`copy-${active}`} className="lp-live__copy" aria-live={playing ? "off" : "polite"}>
              <span className="lp-live__chapter">0{active + 1} / NA PLATAFORMA</span>
              <p className="lp-live__tag">{slide.tag}</p><h3>{slide.title}</h3>
              <p className="lp-live__description">{slide.text}</p>
              {demo === "drawing" && <aside className="lp-live__session-reference" aria-label="Onde encontrar o lápis na sessão">
                <h4>Assim aparece na sessão ao vivo</h4>
                <button type="button" className="lp-live__session-reference-preview" aria-label="Ampliar exemplo do lápis na sessão ao vivo" onClick={() => { setPaused(true); setSessionExampleOpen(true); }}>
                  <img src="/landing/lapis-sessao-real-demo.png" alt="Tela real de sessão com a ilustração do jardim, um rabisco em volta do sapo e o lápis na barra inferior" loading="lazy" />
                  <span className="lp-live__pencil-marker" aria-hidden="true" />
                  <span className="lp-live__reference-zoom"><Maximize2 size={13} /> Ampliar</span>
                </button>
                <div className="lp-live__pencil-guide"><img src="/landing/lapis-controle-sessao.png" alt="Botão real Rabiscar ativado" loading="lazy" /><p><strong>Procure este lápis na barra inferior.</strong><span>Ative para desenhar. A borracha ao lado limpa os rabiscos.</span></p></div>
                <small>Interface real em sessão demonstrativa, sem paciente conectado.</small>
              </aside>}
              <div className="lp-live__benefit"><Check size={17} /><span>{slide.benefit}</span></div>
              <Link to="/cadastro?perfil=profissional" className="lp-live__cta">Quero conhecer a plataforma <ArrowRight size={18} /></Link>
            </div>
          </div>
          <div className="lp-live__navigation">
            <div ref={tabs} role="tablist" aria-label="Recursos da sessão ao vivo" className="lp-live__tabs">
              {slides.map((item, index) => <button key={item.label} id={`live-tab-${index}`} type="button" role="tab" aria-selected={index === active} aria-controls="live-session-panel" tabIndex={index === active ? 0 : -1}
                onClick={() => select(index)} onKeyDown={event => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + slides.length) % slides.length;
                  select(next); tabs.current?.querySelectorAll("button")[next]?.focus();
                }}><item.icon size={19} /><span>{item.label}</span>{index === active && <i key={`${active}-${playing}`} data-playing={playing} />}</button>)}
            </div>
            <div className="lp-live__controls">
              <button type="button" aria-label="Cena anterior" onClick={() => select(active - 1)}><ArrowLeft size={18} /></button>
              <button type="button" aria-label={paused || reduced ? "Reproduzir carrossel" : "Pausar carrossel"} aria-pressed={paused || reduced} onClick={() => { setPaused(!(paused || reduced)); setReduced(false); }}>{paused || reduced ? <Play size={17} /> : <Pause size={17} />}</button>
              <button type="button" aria-label="Próxima cena" onClick={() => select(active + 1)}><ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
        <div className="lp-live__footnote"><span><Images size={15} /> Atividades e recursos da plataforma.</span><small>{slide.caption}</small></div>
      </div>
      {demo === "report" && expanded ? <Suspense fallback={<p role="status">Abrindo exemplo de relatório…</p>}><ReportPreview open={expanded} onOpenChange={setExpanded} report={landingReportExample} /></Suspense> : <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="lp-live-lightbox">
          <DialogTitle>{slide.label}</DialogTitle>
          <DialogDescription>{slide.caption}. Role a imagem para ver os detalhes em telas menores.</DialogDescription>
          <div className="lp-live-lightbox__scroll"><img src={slide.image} alt={slide.alt} /></div>
        </DialogContent>
      </Dialog>}
      <Dialog open={sessionExampleOpen} onOpenChange={setSessionExampleOpen}>
        <DialogContent className="lp-live-lightbox">
          <DialogTitle>O lápis na sessão ao vivo</DialogTitle>
          <DialogDescription>Captura da interface real em uma sessão demonstrativa. O lápis aparece na barra inferior, ao lado da borracha.</DialogDescription>
          <div className="lp-live-lightbox__scroll"><img src="/landing/lapis-sessao-real-demo.png" alt="Tela completa da sessão com o lápis ativado na barra inferior e desenho sobre o jardim" /></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
