import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Instagram,
  Menu,
  MessageCircle,
  MousePointer2,
  PenLine,
  Video,
  X,
} from "lucide-react";
import { LandingPolicies } from "./LandingPolicies";
import "./landing.css";

const assets = {
  logo: "/landing/sementes-logo-transparent.png",
  hero: "/landing/teleatendimento-fono.png",
  activity: "/landing/atividade-compartilhada.png",
  session: "/landing/sessao-atividade-demo.png",
  activityInUse: "/landing/atividade-em-uso-demo.png",
  wheel: "/landing/roleta-dos-sons-demo.png",
  mouth: "/landing/boca-3d-profissional.png",
  activityBuilder: "/landing/criacao-memoria-demo.png",
};

const whatsappHref = "https://wa.me/message/GKL4EEB2NSI4A1";
const instagramHref = "https://www.instagram.com/sementes_dafalaoficial/";
const showcaseIntervalMs = 6500;

const showcase = [
  {
    number: "01",
    tone: "green",
    shortLabel: "Atividades",
    tag: "Atividades em uso",
    title: "Materiais que ganham vida na sessão.",
    description:
      "Crie sequências visuais do seu jeito e conduza cada etapa com a criança. A atividade é parte do atendimento, não um arquivo perdido em outra aba.",
    image: assets.activityInUse,
    alt: "Atividade demonstrativa Missão dos Sons aberta na plataforma, com figuras coloridas",
  },
  {
    number: "02",
    tone: "orange",
    shortLabel: "Jogos",
    tag: "Jogos interativos",
    title: "O jogo muda o ritmo do encontro.",
    description:
      "Roleta, memória, caça-palavras e outras propostas para você adaptar à sua prática e compartilhar com o paciente durante o atendimento.",
    image: assets.wheel,
    alt: "Roleta dos Sons demonstrativa com imagens e palavras coloridas",
  },
  {
    number: "03",
    tone: "blue",
    shortLabel: "Ao vivo",
    tag: "Sessão ao vivo",
    title: "A atividade e a conversa acontecem juntas.",
    description:
      "Vídeo, atividades e interação no mesmo ambiente. Profissional e paciente participam da sessão em tempo real, sem alternar entre várias ferramentas.",
    image: assets.session,
    alt: "Sessão ao vivo demonstrativa com uma atividade visual aberta e janelas de vídeo",
  },
  {
    number: "04",
    tone: "purple",
    shortLabel: "Criação",
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
    tag: "Modelo articulatório",
    title: "Mostre o movimento, não só explique.",
    description:
      "A boca 3D permite demonstrar lábios e língua durante a sessão. Um recurso visual para tornar orientações articulatórias mais claras.",
    image: assets.mouth,
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
  const [slideCycle, setSlideCycle] = useState(0);
  const [carouselInView, setCarouselInView] = useState(false);
  const [carouselHovered, setCarouselHovered] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [carouselTouching, setCarouselTouching] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const carouselPaused = carouselHovered || carouselFocused || carouselTouching;

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
    if (!carouselInView || carouselPaused || !pageVisible || prefersReducedMotion) return;
    const timer = window.setTimeout(() => setActiveSlide((current) => (current + 1) % showcase.length), showcaseIntervalMs);
    return () => window.clearTimeout(timer);
  }, [activeSlide, slideCycle, carouselInView, carouselPaused, pageVisible, prefersReducedMotion]);

  const changeSlide = (direction: number) => {
    setActiveSlide((current) => (current + direction + showcase.length) % showcase.length);
    setSlideCycle((current) => current + 1);
  };

  const selectSlide = (index: number) => {
    setActiveSlide(index);
    setSlideCycle((current) => current + 1);
  };

  const closeMenu = () => setMenuOpen(false);
  const autoPlaying = carouselInView && !carouselPaused && pageVisible && !prefersReducedMotion;

  return (
    <main className="lp" id="inicio">
      <header className="lp-header">
        <div className="lp-header__inner">
          <Brand />
          <nav className={`lp-nav ${menuOpen ? "lp-nav--open" : ""}`} aria-label="Navegação principal">
            <a href="#plataforma" onClick={closeMenu}>A plataforma</a>
            <a href="#recursos" onClick={closeMenu}>Recursos</a>
            <a href="#experiencia" onClick={closeMenu}>Na prática</a>
            <Link to="/entrar" onClick={closeMenu}>Entrar</Link>
            <Link className="lp-nav__cta" to="/cadastro" onClick={closeMenu}>Começar agora <ArrowRight size={16} /></Link>
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
            <Link to="/cadastro" className="lp-button lp-button--primary">Começar como profissional <ArrowRight size={18} /></Link>
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

      <section className="lp-session lp-section" aria-labelledby="lp-session-title">
        <div className="lp-container lp-session__grid">
          <div className="lp-session__visual">
            <img src={assets.session} alt="Sala de sessão ao vivo com uma atividade visual compartilhada e vídeo dos participantes" loading="lazy" />
            <span className="lp-image-note">Demonstração ilustrativa com dados fictícios</span>
          </div>
          <div className="lp-session__copy">
            <p className="lp-kicker">TELEATENDIMENTO QUE ENVOLVE</p>
            <h2>A sessão vai muito além da chamada de vídeo.</h2>
            <p>Você conduz, compartilha e interage. O paciente vê a mesma atividade e pode participar diretamente da tela, enquanto vocês conversam ao vivo.</p>
            <div className="lp-session__line"><span>01</span> Vídeo e recursos no mesmo ambiente</div>
            <div className="lp-session__line"><span>02</span> Atividades compartilhadas durante a sessão</div>
            <div className="lp-session__line"><span>03</span> Interação em tempo real com o paciente</div>
          </div>
        </div>
      </section>

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
        className="lp-showcase lp-section"
        id="experiencia"
        aria-labelledby="lp-showcase-title"
        data-autoplay={autoPlaying}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setCarouselHovered(true); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setCarouselHovered(false); }}
        onFocusCapture={(event) => { if ((event.target as HTMLElement).matches(":focus-visible")) setCarouselFocused(true); }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselFocused(false);
        }}
      >
        <div className="lp-container">
          <div className="lp-showcase__top">
            <div>
              <p className="lp-kicker">VEJA DE PERTO</p>
              <h2 id="lp-showcase-title">Uma plataforma para <em>usar, não só gerenciar.</em></h2>
            </div>
            <div className="lp-showcase__controls">
              <button type="button" onClick={() => changeSlide(-1)} aria-label="Imagem anterior"><ArrowLeft size={20} /></button>
              <button type="button" onClick={() => changeSlide(1)} aria-label="Próxima imagem"><ArrowRight size={20} /></button>
            </div>
          </div>
          <div
            className={`lp-showcase__stage lp-showcase__stage--${showcase[activeSlide].tone}`}
            role="group"
            aria-roledescription="carrossel"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; setCarouselTouching(true); }}
            onTouchEnd={(event) => {
              setCarouselTouching(false);
              if (touchStartX.current === null) return;
              const distance = event.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(distance) > 45) changeSlide(distance < 0 ? 1 : -1);
              touchStartX.current = null;
            }}
            onTouchCancel={() => { touchStartX.current = null; setCarouselTouching(false); }}
          >
            <div className="lp-showcase__media">
              <img key={showcase[activeSlide].image} className={activeSlide === 0 ? "lp-showcase__focus" : "lp-showcase__fit"} src={showcase[activeSlide].image} alt={showcase[activeSlide].alt} loading="lazy" />
              <span>Demonstração ilustrativa com dados fictícios</span>
            </div>
            <div className="lp-showcase__details" aria-live={carouselInView && !carouselPaused && !prefersReducedMotion ? "off" : "polite"}>
              <span className="lp-showcase__count">{showcase[activeSlide].number} / 0{showcase.length}</span>
              <p className="lp-kicker">{showcase[activeSlide].tag}</p>
              <h3>{showcase[activeSlide].title}</h3>
              <p>{showcase[activeSlide].description}</p>
            </div>
          </div>
          <div className="lp-showcase__previews" role="tablist" aria-label="Selecione uma demonstração">
            {showcase.map((slide, index) => (
              <button
                key={slide.number}
                className={`lp-showcase__preview lp-showcase__preview--${slide.tone}`}
                type="button"
                role="tab"
                aria-label={`Ver ${slide.tag}`}
                aria-selected={index === activeSlide}
                onClick={() => selectSlide(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + showcase.length) % showcase.length;
                    selectSlide(next);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                  }
                }}
              >
                <img src={slide.image} alt="" loading="lazy" />
                <span><small>{slide.number}</small>{slide.shortLabel}</span>
                {index === activeSlide && <i key={`${slide.number}-${slideCycle}-${autoPlaying}`} className="lp-showcase__preview-progress" aria-hidden="true" />}
              </button>
            ))}
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
            <Link to="/cadastro" className="lp-button lp-button--light">Criar conta profissional <ArrowRight size={19} /></Link>
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
