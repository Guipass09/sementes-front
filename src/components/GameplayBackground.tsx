import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fundo global apenas para as páginas de gameplay (jogos/atividades).
 * Importante: o fundo é só decorativo, fica atrás de todos os elementos.
 *
 * Para usar a imagem enviada, salve em /public com um destes nomes:
 * - gameplay-bg.jpg / gameplay-bg.jpeg / gameplay-bg.png / gameplay-bg.webp
 */
const GAMEPLAY_BG_CANDIDATES = [
  // imagem enviada (nome com espaços) - precisa estar no /public
  "/ChatGPT%20Image%2031%20de%20dez.%20de%202025,%2015_52_11.png",
  "/gameplay-bg.jpg",
  "/gameplay-bg.jpeg",
  "/gameplay-bg.png",
  "/gameplay-bg.webp",
] as const;

const GAMEPLAY_FRAME_CANDIDATES = [
  "/gameplay-frame.png",
  "/gameplay-frame.webp",
  "/gameplay-frame.jpg",
  "/gameplay-frame.jpeg",
] as const;

async function firstLoadableImageUrl(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // bust cache no dev para enxergar mudanças rápido
      img.src = `${url}?v=${Date.now()}`;
    });
    if (ok) return url;
  }
  return null;
}

export default function GameplayBackground(): JSX.Element | null {
  const location = useLocation();
  const path = location.pathname;

  const isGameplay = path.startsWith("/jogos/") || path.startsWith("/atividades/");
  if (!isGameplay) return null;

  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);

  const bgCandidates = useMemo(() => [...GAMEPLAY_BG_CANDIDATES], []);
  const frameCandidates = useMemo(() => [...GAMEPLAY_FRAME_CANDIDATES], []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [bg, frame] = await Promise.all([
        firstLoadableImageUrl(bgCandidates),
        firstLoadableImageUrl(frameCandidates),
      ]);
      if (cancelled) return;
      setBgUrl(bg);
      setFrameUrl(frame);

      if (!bg) {
        // eslint-disable-next-line no-console
        console.warn(
          "[GameplayBackground] Nenhuma imagem de fundo encontrada em /public. Salve como gameplay-bg.(jpg|jpeg|png|webp).",
        );
      }
      if (!frame) {
        // eslint-disable-next-line no-console
        console.warn(
          "[GameplayBackground] Nenhuma moldura encontrada em /public. (Opcional) Salve como gameplay-frame.(png|webp|jpg|jpeg).",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bgCandidates, frameCandidates]);

  return (
    <>
      {/* Imagem de fundo (bem suave) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-cover"
        style={
          bgUrl
            ? {
                backgroundImage: `url(${bgUrl})`,
                opacity: 1,
              }
            : { opacity: 0 }
        }
        aria-hidden="true"
      />

      {/* Overlay leve para manter legibilidade */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-background/35 via-background/45 to-background/55"
        aria-hidden="true"
      />

      {/* Moldura (opcional) */}
      {frameUrl ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-100"
          style={{ backgroundImage: `url(${frameUrl})` }}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}


