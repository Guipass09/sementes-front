import { useEffect, useRef, useState } from "react";

type Props = {
  image: string;
  alt: string;
  video?: string;
  loadVideo: boolean;
  playing: boolean;
  controls?: boolean;
};

export function LandingShowcaseMedia({ image, alt, video, loadVideo, playing, controls = false }: Props) {
  const player = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    if (playing) void element.play().catch(() => { /* Keep the poster if autoplay is unavailable. */ });
    else element.pause();
    return () => element.pause();
  }, [playing, loadVideo, failed, video]);

  return (
    <div className="lp-tour__media">
      {video && loadVideo && !failed ? (
        <video ref={player} src={video} poster={image} muted playsInline loop preload="auto"
          controls={controls} aria-label={alt} onError={() => setFailed(true)} />
      ) : (
        <img src={image} alt={alt} loading="lazy" decoding="async" />
      )}
    </div>
  );
}
