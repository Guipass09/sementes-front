import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function supportsFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as any;
  return !!(el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen);
}

async function requestFs(): Promise<void> {
  const el: any = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) await fn.call(el);
}

async function exitFs(): Promise<void> {
  const doc: any = document;
  const fn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
  if (fn) await fn.call(doc);
}

function isFsActive(): boolean {
  const doc: any = document;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

export default function GameplayFullscreenButton(): JSX.Element | null {
  const { pathname } = useLocation();
  const isGameplay = useMemo(
    () => pathname.startsWith("/jogos/") || pathname.startsWith("/atividades/"),
    [pathname],
  );

  const [available, setAvailable] = useState(() => (typeof window !== "undefined" ? supportsFullscreen() : false));
  const [active, setActive] = useState(() => (typeof window !== "undefined" ? isFsActive() : false));

  useEffect(() => {
    if (typeof document === "undefined") return;
    setAvailable(supportsFullscreen());
    setActive(isFsActive());

    const onChange = () => setActive(isFsActive());
    document.addEventListener("fullscreenchange", onChange);
    // webkit fallback (iOS Safari/PWA pode disparar)
    document.addEventListener("webkitfullscreenchange" as any, onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange" as any, onChange);
    };
  }, []);

  // Se não for gameplay, não renderiza. Se o device não suporta, também não mostra.
  if (!isGameplay || !available) return null;

  return (
    <div className="fixed right-3 top-3 z-50 pointer-events-auto">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-10 w-10 rounded-full shadow-md"
        onClick={async () => {
          try {
            if (isFsActive()) await exitFs();
            else await requestFs();
          } catch {
            // se falhar, não trava UX; só não entra em fullscreen
          }
        }}
        title={active ? "Sair da tela cheia" : "Tela cheia"}
      >
        {active ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </Button>
    </div>
  );
}


