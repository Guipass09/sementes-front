import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Sparkles } from "lucide-react";
import "./landing-presentation.css";

const mediaRoot = "/landing/presentation";

export default function LandingPresentation() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setActivated(true);
    // Attach the file only on intent, keeping the initial page free of video downloads.
    if (!video.getAttribute("src") || video.error) {
      const resolution = window.matchMedia("(max-width: 767px)").matches ? "720" : "1080";
      video.src = `${mediaRoot}/sementes-da-fala-${resolution}.mp4`;
      video.load();
    }
    void video.play().catch(() => {
      // Native controls remain available when a browser requires another gesture.
      if (video.error) setFailed(true);
    });
  };

  return (
    <section className="lp-presentation" aria-labelledby="lp-presentation-title">
      <div className="lp-container">
        <div className="lp-presentation__heading">
          <div className="lp-presentation__copy">
            <p className="lp-presentation__eyebrow"><Sparkles size={15} aria-hidden="true" /> CONHEÇA A PLATAFORMA</p>
            <h2 id="lp-presentation-title">Veja a Sementes da Fala em ação.</h2>
          </div>
          <div className="lp-presentation__aside">
            <p className="lp-presentation__description">Um olhar de perto para uma fonoaudiologia online mais próxima, interativa e conectada.</p>
            <span className="lp-presentation__duration"><Play size={14} fill="currentColor" aria-hidden="true" /> Vídeo <i aria-hidden="true" /> 1 min 32 s</span>
          </div>
        </div>
        <div className="lp-presentation__player">
          <video
            ref={videoRef}
            className="lp-presentation__video"
            controls={activated}
            playsInline
            preload="none"
            poster={`${mediaRoot}/capa.webp`}
            aria-label="Apresentação da plataforma Sementes da Fala"
            onError={() => setFailed(true)}
          />
          {!activated && (
            <button className="lp-presentation__cover" type="button" onClick={play} aria-label="Reproduzir apresentação da Sementes da Fala" title="Reproduzir apresentação">
              <img src={`${mediaRoot}/capa.webp`} alt="Muito além da videochamada. Fonoaudiologia online com a Sementes da Fala." width="1280" height="720" loading="lazy" decoding="async" />
              <span className="lp-presentation__play"><Play size={28} fill="currentColor" aria-hidden="true" /></span>
            </button>
          )}
          {failed && (
            <div className="lp-presentation__error" role="alert">
              <p>Não foi possível carregar o vídeo.</p>
              <button type="button" onClick={play}><RefreshCw size={18} aria-hidden="true" /> Tentar novamente</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
