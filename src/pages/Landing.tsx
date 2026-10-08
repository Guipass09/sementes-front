import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Gamepad2,
  Instagram,
  Menu,
  MessageCircle,
  MousePointer2,
  Pause,
  PenLine,
  Play,
  ScanFace,
  UsersRound,
  Video,
  X,
  Maximize2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { LandingPolicies } from "./LandingPolicies";
import LandingWheelDemo from "./LandingWheelDemo";
import LandingSessionDemo from "./LandingSessionDemo";
import LandingActivityDemo from "./LandingActivityDemo";
import LandingLiveSessions from "./LandingLiveSessions";
import "./landing.css";
import "./landing-showcase.css";

const LandingMouthDemo = lazy(() => import("./LandingMouthDemo"));

const assets = {
  logo: "/landing/sementes-logo-transparent.png",
  hero: "/landing/teleatendimento-fono.png",
  activity: "/landing/atividade-compartilhada.png",
  session: "/landing/sessao-atividade-demo.png",
  activityInUse: "/landing/atividade-em-uso-demo-hd.png",
  wheel: "/landing/roleta-dos-sons-demo-hd.png",
  mouth: "/landing/boca-3d-profissional.png",
  activityBuilder: "/landing/criacao-memoria-demo.png",
};

const whatsappHref = "https://wa.me/message/GKL4EEB2NSI4A1";
const instagramHref = "https://www.instagram.com/sementes_dafalaoficial/";
const showcaseIntervalMs = 6500;
const professionalSignup = "/cadastro?perfil=profissional";

const planBenefits = [
  { icon: Video, title: "Atendimento ao vivo", detail: "Vídeo e materiais no mesmo espaço de atendimento." },
  { icon: MousePointer2, title: "Interação na tela", detail: "Paciente e profissional participam da atividade em tempo real." },
  { icon: Gamepad2, title: "Jogos terapêuticos", detail: "Uma biblioteca lúdica para usar durante e entre sessões." },
  { icon: PenLine, title: "Atividades personalizadas", detail: "Crie propostas com seus próprios objetivos e imagens." },
  { icon: ClipboardList, title: "Relatórios e evolução", detail: "Documente o percurso clínico sem sair da plataforma." },
  { icon: CalendarDays, title: "Agenda organizada", detail: "Horários e sessões reunidos na sua rotina de trabalho." },
  { icon: UsersRound, title: "Perfis conectados", detail: "Você e seu paciente têm espaços próprios e vinculados." },
  { icon: ScanFace, title: "Boca 3D", detail: "Mostre movimentos articulatórios durante o atendimento." },
];

const plans = [
  { number: "01", name: "Mensal", description: "Comece no seu ritmo.", price: "249,90", cadence: "por mês", charge: "Cobrança mensal de R$ 249,90", saving: "Liberdade para começar", featured: false },
  { number: "02", name: "Trimestral", description: "Mais fôlego para a sua prática.", price: "224,90", cadence: "por mês, equivalente", charge: "R$ 674,70 a cada 3 meses", saving: "R$ 75,00 de economia por trimestre", featured: false },
  { number: "03", name: "Anual", description: "O melhor valor para crescer.", price: "199,90", cadence: "por mês, equivalente", charge: "R$ 2.398,80 por ano", saving: "R$ 600,00 de economia por ano", featured: true },
];

const planInclusions = [
  "Sessões ao vivo com interação na tela",
  "Jogos terapêuticos e atividades personalizadas",
  "Agenda e perfis de paciente vinculados",
  "Relatórios, avaliações e evoluções",
  "Boca 3D durante o atendimento",
];

const showcase = [
  {
    number: "01",
    tone: "green",
    shortLabel: "Atividades",
    icon: ClipboardList,
    benefits: ["Sequências visuais personalizadas", "Etapas no ritmo de cada paciente", "Materiais disponíveis durante a sessão"],
    tag: "Atividades em uso",
    title: "Materiais que ganham vida na sessão.",
    description:
      "Dê forma às suas ideias e conduza cada etapa com a criança, sem sair do atendimento.",
    image: assets.activityInUse,
    demo: "activity",
    alt: "Atividade demonstrativa Missão dos Sons aberta na plataforma, com figuras coloridas",
  },
  {
    number: "02",
    tone: "orange",
    shortLabel: "Jogos",
    icon: Gamepad2,
    benefits: ["Memória, roleta, forca e muito mais", "Participação do paciente na tela", "Novas rodadas sempre que precisar"],
    tag: "Jogos interativos",
    title: "O jogo muda o ritmo do encontro.",
    description:
      "Transforme seus objetivos em propostas lúdicas que convidam o paciente a participar.",
    image: assets.wheel,
    demo: "wheel",
    alt: "Roleta dos sons com figuras e palavras coloridas",
  },
  {
    number: "03",
    tone: "blue",
    shortLabel: "Ao vivo",
    icon: Video,
    benefits: ["Vídeo e materiais juntos", "Controle de interação do paciente", "Troca de atividades sem sair da chamada"],
    tag: "Sessão ao vivo",
    title: "A atividade e a conversa acontecem juntas.",
    description:
      "Compartilhe mais que uma chamada. Vocês conversam, exploram e interagem no mesmo espaço.",
    image: assets.session,
    demo: "session",
    notice: { title: "Uma demonstração para experimentar", text: "O jogo da memória nesta cena é clicável e demonstrativo. Na plataforma, você personaliza jogos e atividades com suas imagens e objetivos para cada paciente." },
    alt: "Sessão ao vivo demonstrativa com uma atividade visual aberta e janelas de vídeo",
  },
  {
    number: "04",
    tone: "purple",
    shortLabel: "Criação",
    icon: PenLine,
    benefits: ["Suas próprias imagens", "Pares alinhados ao objetivo terapêutico", "Biblioteca pessoal para reutilizar"],
    tag: "Criação de jogos",
    title: "Crie um jogo com suas imagens.",
    description:
      "Escolha as figuras, monte os pares e personalize o jogo da memória para o objetivo de cada atendimento.",
    image: assets.activityBuilder,
    alt: "Criação de jogo da memória com três figuras adicionadas e outros pares ainda vazios",
  },
  {
    number: "05",
    tone: "pink",
    shortLabel: "Boca 3D",
    icon: ScanFace,
    benefits: ["Demonstração de lábios e língua", "Ajustes dos movimentos articulatórios", "Recurso disponível no atendimento"],
    tag: "Modelo articulatório",
    title: "Mostre o movimento, não só explique.",
    description:
      "A boca 3D permite demonstrar lábios e língua durante a sessão. Um recurso visual para tornar orientações articulatórias mais claras.",
    image: assets.mouth,
    demo: "mouth",
    notice: { title: "Mais movimentos no plano pago", text: "Com a assinatura, você pode mover a língua para diferentes lados, colocá-la para fora, demonstrar bico e sorriso e explorar outros movimentos para os exercícios articulatórios." },
    alt: "Modelo de boca 3D aberto na área profissional",
  },
] as const;

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a className={`lp-brand ${footer ? "lp-brand--footer" : ""}`} href="#inicio" aria-label="Sementes da Fala, voltar ao início">
      <img src={assets.logo} alt="" width="64" height="64" />
      <span className="lp-brand__name"><strong>Sementes</strong> <small>da</small> Fala</span>
    </a>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [slideCycle, setSlideCycle] = useState(0);
  const [carouselInView, setCarouselInView] = useState(false);
  const [carouselTouching, setCarouselTouching] = useState(false);
  const [carouselUserPaused, setCarouselUserPaused] = useState(false);
  const [playbackOverride, setPlaybackOverride] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const playbackPaused = carouselUserPaused || (prefersReducedMotion && !playbackOverride);
  const autoPlaying = carouselInView && !playbackPaused && !carouselTouching && pageVisible && !expanded;
  const slide = showcase[activeSlide];
  const interactiveSlide = "demo" in slide;
  const slideDuration = "demo" in slide && slide.demo === "activity" ? 18000 : showcaseIntervalMs;
  const pauseForInteraction = () => setCarouselUserPaused(true);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const centerActiveTab = () => {
      const active = tabs.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) tabs.scrollTo({ left: active.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - active.clientWidth) / 2, behavior: prefersReducedMotion ? "auto" : "smooth" });
    };
    centerActiveTab();
    const observer = new ResizeObserver(centerActiveTab);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [activeSlide, prefersReducedMotion]);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      if (!token || !storedUser) return;
      const user = JSON.parse(storedUser);
      const role = String(user.role || "").toLowerCase().trim();
      if (role.includes("admin") || role.includes("administrador")) navigate("/admin", { replace: true });
      else if (role.includes("profissional") || role.includes("professional") || role.includes("clinica") || role.includes("clinic")) navigate("/profissional", { replace: true });
      else navigate("/paciente", { replace: true });
    } catch {
      // A sessão armazenada pode estar desatualizada; a landing continua acessível.
    }
  }, [navigate]);

  useEffect(() => {
    const section = showcaseRef.current;
    if (!section) return;
    if (!window.IntersectionObserver) {
      setCarouselInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setCarouselInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMotionPreference();
    updateVisibility();
    motionPreference.addEventListener("change", updateMotionPreference);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      motionPreference.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!autoPlaying) return;
    const timer = window.setTimeout(() => setActiveSlide((current) => (current + 1) % showcase.length), slideDuration);
    return () => window.clearTimeout(timer);
  }, [activeSlide, slideCycle, autoPlaying, slideDuration]);

  useEffect(() => {
    if (!carouselInView) return;
    const nextImage = new Image();
    nextImage.src = showcase[(activeSlide + 1) % showcase.length].image;
  }, [activeSlide, carouselInView]);

  const changeSlide = (direction: number) => {
    setActiveSlide((current) => (current + direction + showcase.length) % showcase.length);
    setSlideCycle((current) => current + 1);
  };

  const selectSlide = (index: number) => {
    setActiveSlide(index);
    setSlideCycle((current) => current + 1);
  };

  const closeMenu = () => setMenuOpen(false);

  const togglePlayback = () => {
    if (playbackPaused) {
      setPlaybackOverride(true);
      setCarouselUserPaused(false);
    } else {
      setCarouselUserPaused(true);
    }
    setSlideCycle((current) => current + 1);
  };

  return (
    <main className="lp" id="inicio">
      <header className="lp-header">
        <div className="lp-header__inner">
          <Brand />
          <nav className={`lp-nav ${menuOpen ? "lp-nav--open" : ""}`} aria-label="Navegação principal">
            <a href="#plataforma" onClick={closeMenu}>A plataforma</a>
            <a href="#recursos" onClick={closeMenu}>Recursos</a>
            <a href="#experiencia" onClick={closeMenu}>Na prática</a>
            <a href="#planos" onClick={closeMenu}>Planos</a>
            <Link to="/entrar" onClick={closeMenu}>Entrar</Link>
            <Link className="lp-nav__cta" to={professionalSignup} onClick={closeMenu}>Começar agora <ArrowRight size={16} /></Link>
          </nav>
          <button
            className="lp-menu-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <section className="lp-hero" aria-labelledby="lp-hero-title">
        <img className="lp-hero__image" src={assets.hero} alt="Fonoaudióloga em atendimento online, interagindo com uma criança na tela" fetchPriority="high" />
        <div className="lp-hero__wash" />
        <div className="lp-hero__content lp-container">
          <p className="lp-eyebrow"><span /> A plataforma de quem faz fonoaudiologia</p>
          <h1 id="lp-hero-title">Sementes<br />da Fala<span className="lp-hero__period">.</span></h1>
          <p className="lp-hero__lead">Seu atendimento online pode ser tão vivo quanto a sua prática.</p>
          <p className="lp-hero__body">Sessões ao vivo com atividades interativas, materiais criados por você e toda a rotina clínica em um só lugar.</p>
          <div className="lp-hero__actions">
            <Link to={professionalSignup} className="lp-button lp-button--primary">Começar como profissional <ArrowRight size={18} /></Link>
            <a href="#plataforma" className="lp-button lp-button--outline">Explorar a plataforma <ArrowDown size={17} /></a>
          </div>
        </div>
        <div className="lp-hero__index" aria-hidden="true">SEMENTES DA FALA &nbsp; / &nbsp; FONOAUDIOLOGIA ONLINE</div>
      </section>

      <div className="lp-proof" aria-label="Recursos da plataforma">
        <div className="lp-container lp-proof__inner">
          <span><Video size={21} /> Atendimento ao vivo</span>
          <span><MousePointer2 size={21} /> Interação em tempo real</span>
          <span><PenLine size={21} /> Atividades personalizadas</span>
          <span><CalendarDays size={21} /> Rotina organizada</span>
        </div>
      </div>

      <section className="lp-intro lp-section" id="plataforma">
        <div className="lp-container lp-intro__grid">
          <div>
            <p className="lp-kicker">FEITA PARA A PRÁTICA CLÍNICA</p>
            <h2>Não é só organizar consultas. <em>É fazer o atendimento acontecer.</em></h2>
          </div>
          <div className="lp-intro__aside">
            <p>Da primeira atividade ao registro de evolução, a Sementes da Fala acompanha a fonoaudióloga em cada etapa do atendimento online.</p>
            <a className="lp-text-link" href="#experiencia">Veja a plataforma por dentro <ArrowRight size={18} /></a>
          </div>
        </div>
      </section>

      <LandingLiveSessions />

      <section className="lp-photo-story" aria-labelledby="lp-photo-title">
        <img src={assets.activity} alt="Criança participando de uma atividade interativa em atendimento online" loading="lazy" />
        <div className="lp-photo-story__shade" />
        <div className="lp-container lp-photo-story__content">
          <p className="lp-kicker">A CONEXÃO CONTINUA DO OUTRO LADO</p>
          <h2 id="lp-photo-title">Não é assistir à tela.<br />É <em>participar dela.</em></h2>
          <p>Quando a atividade responde ao toque e à criatividade, a distância deixa de ser o centro da sessão.</p>
        </div>
        <span className="lp-photo-story__note">Imagem ilustrativa</span>
      </section>

      <section className="lp-resources lp-section" id="recursos">
        <div className="lp-container">
          <div className="lp-resources__heading">
            <p className="lp-kicker">UM ESPAÇO PARA O SEU JEITO DE ATENDER</p>
            <h2>Seu trabalho tem método.<br /><em>Sua plataforma também.</em></h2>
          </div>
          <div className="lp-resources__grid">
            <article className="lp-resource">
              <span className="lp-resource__icon lp-resource__icon--coral"><PenLine size={25} /></span>
              <span className="lp-resource__number">01 / CRIAR</span>
              <h3>Atividades com a sua assinatura</h3>
              <p>Monte materiais e jogos, adapte para cada objetivo terapêutico e compartilhe com outros profissionais.</p>
            </article>
            <article className="lp-resource">
              <span className="lp-resource__icon lp-resource__icon--green"><CalendarDays size={25} /></span>
              <span className="lp-resource__number">02 / ORGANIZAR</span>
              <h3>Agenda sem perder o fio da rotina</h3>
              <p>Visualize seus horários, acompanhe sessões e encontre o que precisa antes de cada atendimento.</p>
            </article>
            <article className="lp-resource">
              <span className="lp-resource__icon lp-resource__icon--yellow"><ClipboardList size={25} /></span>
              <span className="lp-resource__number">03 / ACOMPANHAR</span>
              <h3>Relatórios e evolução no mesmo lugar</h3>
              <p>Registre o percurso do paciente e reúna as informações que dão continuidade ao cuidado.</p>
            </article>
          </div>
        </div>
      </section>

      <section
        ref={showcaseRef}
        className="lp-showcase lp-section lp-tour"
        id="experiencia"
        aria-labelledby="lp-showcase-title"
        data-autoplay={autoPlaying}
        style={{ "--tour-duration": `${slideDuration}ms` } as CSSProperties}
      >
        <div className="lp-container">
          <div className="lp-showcase__top">
            <div>
              <p className="lp-kicker">POR DENTRO DA SEMENTES DA FALA</p>
              <h2 id="lp-showcase-title">Uma plataforma para <em>usar, não só gerenciar.</em></h2>
            </div>
            <p className="lp-tour__intro">Da sua primeira ideia ao encontro com o paciente. Conheça o que faz parte da sua prática aqui.</p>
          </div>
          <div className="lp-tour__navigation">
            <div ref={tabsRef} className="lp-tour__tabs" role="tablist" aria-label="Recursos da plataforma">
              {showcase.map((item, index) => (
                <button key={item.number} id={`tour-tab-${index}`} role="tab" type="button" aria-selected={index === activeSlide} aria-controls="tour-panel" tabIndex={index === activeSlide ? 0 : -1}
                  onClick={() => selectSlide(index)}
                  onKeyDown={event => {
                    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : event.key === "End" ? showcase.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + showcase.length) % showcase.length;
                    selectSlide(next);
                    tabsRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                  }}>
                  <item.icon size={20} aria-hidden="true" /><span>{item.shortLabel}</span>
                  {index === activeSlide && <i key={`${index}-${slideCycle}-${autoPlaying}`} className="lp-tour__progress" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="lp-showcase__controls">
              <button type="button" onClick={() => changeSlide(-1)} title="Demonstração anterior" aria-label="Imagem anterior"><ArrowLeft size={18} /></button>
              <button type="button" onClick={togglePlayback} title={playbackPaused ? "Reproduzir carrossel" : "Pausar carrossel"} aria-label={playbackPaused ? "Reproduzir carrossel" : "Pausar carrossel"} aria-pressed={playbackPaused}>
                {playbackPaused ? <Play size={19} /> : <Pause size={19} />}
              </button>
              <button type="button" onClick={() => changeSlide(1)} title="Próxima demonstração" aria-label="Próxima imagem"><ArrowRight size={18} /></button>
            </div>
          </div>
          <div
            className={`lp-showcase__stage lp-showcase__stage--${showcase[activeSlide].tone}`}
            id="tour-panel"
            role="tabpanel"
            aria-labelledby={`tour-tab-${activeSlide}`}
            tabIndex={0}
            onTouchStart={(event) => {
              if ((event.target as Element).closest(".lp-demo, .lp-session-demo")) { touchStartX.current = null; return; }
              touchStartX.current = event.touches[0].clientX;
              setCarouselTouching(true);
            }}
            onTouchEnd={(event) => {
              setCarouselTouching(false);
              if (touchStartX.current === null) return;
              const distance = event.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(distance) > 45) changeSlide(distance < 0 ? 1 : -1);
              touchStartX.current = null;
            }}
            onTouchCancel={() => { touchStartX.current = null; setCarouselTouching(false); }}
          >
            <figure className="lp-tour__figure">
              <div className="lp-tour__image" data-interactive={interactiveSlide} data-demo={"demo" in slide ? slide.demo : undefined}>
                {showcase.map((item, index) => (
                  <div key={item.number} className="lp-tour__scene" aria-hidden={index !== activeSlide}
                    data-position={index === activeSlide ? "active" : index < activeSlide ? "before" : "after"}>
                    {index === activeSlide && carouselInView && "demo" in item ? (
                      item.demo === "activity" ? <LandingActivityDemo onInteract={pauseForInteraction} playing={autoPlaying} reducedMotion={prefersReducedMotion} /> : item.demo === "wheel" ? <LandingWheelDemo onInteract={pauseForInteraction} reducedMotion={prefersReducedMotion} /> : item.demo === "session" ? (
                        <LandingSessionDemo image={item.image} onInteract={pauseForInteraction} />
                      ) : (
                        <Suspense fallback={<img className="lp-tour__still" src={item.image} alt={item.alt} />}>
                          <LandingMouthDemo onInteract={pauseForInteraction} />
                        </Suspense>
                      )
                    ) : <img className="lp-tour__still" src={item.image} alt={item.alt} loading="lazy" decoding="async" />}
                  </div>
                ))}
                {!interactiveSlide && <button type="button" className="lp-tour__expand" title="Ampliar demonstração" aria-label="Ampliar demonstração" onClick={() => setExpanded(true)}><Maximize2 size={19} /></button>}
              </div>
              <figcaption><span>Demonstração ilustrativa · Dados fictícios</span><span>{slide.number} / 05</span></figcaption>
            </figure>
            <div key={slide.number} className="lp-showcase__details" aria-live={autoPlaying ? "off" : "polite"}>
              <span className="lp-tour__chapter"><slide.icon size={20} aria-hidden="true" /> {slide.tag}</span>
              <h3>{slide.title}</h3>
              <p>{slide.description}</p>
              <ul className="lp-tour__benefits">{slide.benefits.map(benefit => <li key={benefit}><Check size={16} aria-hidden="true" /><span>{benefit}</span></li>)}</ul>
              {"notice" in slide && <aside className="lp-tour__notice" data-highlight={"demo" in slide && slide.demo === "mouth"} aria-label={slide.notice.title}><strong>{slide.notice.title}</strong><p>{slide.notice.text}</p></aside>}
              <Link className="lp-text-link lp-tour__link" to={professionalSignup}>Quero esse espaço para atender <ArrowRight size={18} /></Link>
            </div>
          </div>
          <div className="lp-tour__footer">
            <span><UsersRound size={18} /> Seu jeito de atender. Um só lugar.</span>
            <a href="#planos">Conhecer os planos <ArrowDown size={16} /></a>
          </div>
        </div>
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="lp-tour-lightbox" hideClose>
            <div className="lp-tour-lightbox__top"><div><DialogTitle>{slide.shortLabel}</DialogTitle><DialogDescription>Demonstração ilustrativa com dados fictícios</DialogDescription></div><DialogClose aria-label="Fechar demonstração" title="Fechar demonstração"><X size={23} /></DialogClose></div>
            <img src={slide.image} alt={slide.alt} />
          </DialogContent>
        </Dialog>
      </section>

      <section className="lp-plans lp-section" id="planos" aria-labelledby="lp-plans-title">
        <div className="lp-container">
          <div className="lp-plans__intro">
            <div>
              <p className="lp-kicker">PARA PROFISSIONAIS QUE ATENDEM ONLINE</p>
              <h2 id="lp-plans-title">Tudo para a sua prática <em>acontecer aqui.</em></h2>
            </div>
            <p>Mais que organizar atendimentos: um ambiente para criar, conduzir, acompanhar e se conectar com cada paciente.</p>
          </div>

          <div className="lp-plans__benefits" aria-label="O que está incluído">
            {planBenefits.map(({ icon: Icon, title, detail }) => (
              <div className="lp-plans__benefit" key={title}>
                <span className="lp-plans__benefit-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{detail}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-plans__pricing">
          <div className="lp-container">
          <div className="lp-plans__pricing-head">
            <div>
              <p className="lp-kicker">SEU ESPAÇO PROFISSIONAL</p>
              <h3>Um jeito melhor de atender.<br /><em>Um plano no seu ritmo.</em></h3>
            </div>
            <p>O acesso é completo nos três planos. Você escolhe apenas por quanto tempo quer contratar.</p>
          </div>

          <div className="lp-plans__grid">
            {plans.map((plan) => (
              <article className={`lp-plan${plan.featured ? " lp-plan--featured" : ""}`} key={plan.name}>
                <div className="lp-plan__top">
                  <span className="lp-plan__number">{plan.number} / ACESSO COMPLETO</span>
                  {plan.featured && <span className="lp-plan__badge">Melhor valor</span>}
                </div>
                <h4>{plan.name}</h4>
                <p className="lp-plan__description">{plan.description}</p>
                <div className="lp-plan__price"><span>R$</span> {plan.price}</div>
                <p className="lp-plan__cadence">{plan.cadence}</p>
                <p className="lp-plan__charge">{plan.charge}</p>
                <p className="lp-plan__saving"><Check size={16} aria-hidden="true" /> {plan.saving}</p>
                <div className="lp-plan__included">
                  <p>O QUE VOCÊ RECEBE</p>
                  <ul>
                    {planInclusions.map((item) => <li key={item}><Check size={15} aria-hidden="true" /> <span>{item}</span></li>)}
                  </ul>
                </div>
                <Link className="lp-plan__action" to={professionalSignup}>Criar conta profissional <ArrowRight size={17} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
          <p className="lp-plans__footnote">Valores para profissionais individuais. O cadastro não realiza cobrança.</p>
          </div>
        </div>
      </section>

      <section className="lp-cta lp-section">
        <div className="lp-container lp-cta__inner">
          <div>
            <p className="lp-kicker">SEU PRÓXIMO ATENDIMENTO COMEÇA AQUI</p>
            <h2>Leve a sua prática para um espaço à altura dela.</h2>
          </div>
          <div className="lp-cta__actions">
            <Link to={professionalSignup} className="lp-button lp-button--light">Criar conta profissional <ArrowRight size={19} /></Link>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="lp-cta__contact">Conversar sobre a plataforma <MessageCircle size={18} /></a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer__main">
          <div className="lp-footer__identity">
            <Brand footer />
            <p>Um espaço vivo para a fonoaudiologia online.</p>
          </div>
          <div className="lp-footer__links">
            <strong>Plataforma</strong>
            <a href="#plataforma">Conhecer</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <Link to="/cadastro">Cadastrar-se</Link>
            <Link to="/entrar">Entrar</Link>
          </div>
          <div className="lp-footer__links">
            <strong>Contato</strong>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a href={instagramHref} target="_blank" rel="noopener noreferrer">Instagram <Instagram size={14} /></a>
            <a href="mailto:sementesdafala@gmail.com">E-mail</a>
          </div>
        </div>
        <div className="lp-container lp-footer__bottom">
          <span>© {new Date().getFullYear()} Sementes da Fala</span>
          <LandingPolicies />
        </div>
      </footer>
    </main>
  );
}
