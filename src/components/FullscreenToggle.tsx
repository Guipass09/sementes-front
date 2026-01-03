import { type RefObject, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function canUseNativeFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  const anyEl = el as any;
  return !!(anyEl.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.msRequestFullscreen);
}

function isNativeFullscreenActive(): boolean {
  const doc: any = document;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

async function requestNativeFullscreen(el: HTMLElement): Promise<void> {
  const anyEl: any = el as any;
  const fn = anyEl.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.msRequestFullscreen;
  if (fn) await fn.call(anyEl);
}

async function exitNativeFullscreen(): Promise<void> {
  const doc: any = document;
  const fn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
  if (fn) await fn.call(doc);
}

export type FullscreenToggleProps = {
  targetRef: RefObject<HTMLElement | null>;
  /** classe do botão (posição), ex: "absolute bottom-3 right-3" */
  className?: string;
};

/**
 * Botão pequeno para fullscreen do CONTEÚDO (elemento alvo), com fallback "pseudo fullscreen"
 * para dispositivos que não suportam fullscreen de elemento (ex: alguns iOS).
 */
export default function FullscreenToggle({ targetRef, className }: FullscreenToggleProps): JSX.Element | null {
  const [pseudoActive, setPseudoActive] = useState(false);
  const [nativeActive, setNativeActive] = useState(false);
  const active = nativeActive || pseudoActive;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onChange = () => setNativeActive(isNativeFullscreenActive());
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange" as any, onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange" as any, onChange);
    };
  }, []);

  useEffect(() => {
    // sincroniza ao montar
    setNativeActive(typeof document !== "undefined" ? isNativeFullscreenActive() : false);
  }, []);

  // Ref não causa re-render; então marcamos "ready" após mount
  useEffect(() => {
    setReady(true);
  }, []);

  const toggle = async () => {
    const el = targetRef.current;
    if (!el) return;

    // Se estamos em pseudo fullscreen, sai dele.
    if (pseudoActive) {
      el.classList.remove("is-pseudo-fullscreen");
      document.documentElement.classList.remove("fs-lock");
      document.documentElement.classList.remove("fs-mode");
      setPseudoActive(false);
      return;
    }

    // Se o browser suportar fullscreen nativo, usa.
    if (canUseNativeFullscreen(el)) {
      try {
        if (isNativeFullscreenActive()) {
          await exitNativeFullscreen();
          document.documentElement.classList.remove("fs-mode");
          return;
        }

        await requestNativeFullscreen(el);
        // Alguns browsers falham silenciosamente. Se não entrou, cai no fallback.
        await new Promise((r) => window.setTimeout(r, 50));
        if (isNativeFullscreenActive()) {
          document.documentElement.classList.add("fs-mode");
          return;
        }
      } catch {
        // cai no fallback
      }
    }

    // Fallback: pseudo fullscreen via CSS (funciona em qualquer dispositivo)
    el.classList.add("is-pseudo-fullscreen");
    document.documentElement.classList.add("fs-lock");
    document.documentElement.classList.add("fs-mode");
    setPseudoActive(true);
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="default"
      className={cn(
        // verde (brand)
        "h-8 w-8 rounded-full shadow-md bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
      onClick={() => void toggle()}
      // não depende de ref.current (não é reativo); usamos 'ready' só para evitar clique antes do mount
      disabled={!ready}
      title={active ? "Sair da tela cheia" : "Tela cheia"}
    >
      {active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );
}


