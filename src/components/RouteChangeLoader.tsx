import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";

/**
 * Loader simples de transição de rota.
 * Mostra um overlay por um tempo mínimo sempre que o pathname mudar.
 */
export default function RouteChangeLoader({
  minDurationMs = 900,
  disabled = false,
}: {
  minDurationMs?: number;
  disabled?: boolean;
}) {
  const location = useLocation();
  const [show, setShow] = useState(false);
  const timerRef = useRef<number | null>(null);

  // useLayoutEffect: aparece antes do paint da rota nova (mais perceptível e sem "piscar")
  useLayoutEffect(() => {
    const path = location.pathname;

    // Só mostrar a logo ao entrar em "abas principais" e telas de auth.
    // Importante: NÃO mostrar durante os jogos/atividades (onde há interações como drag/cartas).
    const isAuthScreen =
      path === "/" ||
      path === "/entrar" ||
      path === "/cadastro" ||
      path === "/esqueci-senha" ||
      path === "/redefinir-senha";
    const isMainTabs = path.startsWith("/admin") || path.startsWith("/paciente");
    const isGameplay = path.startsWith("/jogos/") || path.startsWith("/atividades/");

    const shouldShow = !disabled && (isAuthScreen || isMainTabs) && !isGameplay;
    if (!shouldShow) {
      setShow(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    setShow(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShow(false), Math.max(0, minDurationMs));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [location.pathname, disabled, minDurationMs]);

  if (!show) return null;
  return <FullScreenLogoLoader label="Carregando..." />;
}


