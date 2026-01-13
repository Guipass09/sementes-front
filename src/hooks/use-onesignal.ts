import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthContext";
import { registerPushToken, unregisterPushToken } from "@/lib/laravel-api";

declare global {
  interface Window {
    OneSignal?: any;
  }
}

export function useOneSignal() {
  const auth = useAuth();
  const playerIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!auth.user || initializedRef.current) return;
    if (typeof window === "undefined") return;

    initializedRef.current = true;

    const setup = async () => {
      // Carregar OneSignal SDK
      if (!window.OneSignal) {
        const script = document.createElement("script");
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const OneSignal = window.OneSignal;
      if (!OneSignal) {
        console.warn("OneSignal SDK não carregou");
        return;
      }

      // Inicializar OneSignal
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn("ONESIGNAL_APP_ID não configurado");
        return;
      }

      await OneSignal.init({
        appId: appId,
        notifyButton: {
          enable: false, // Não mostrar botão padrão
        },
        allowLocalhostAsSecureOrigin: true, // Para desenvolvimento
      });

      // Solicitar permissão
      const permission = await OneSignal.Notifications.requestPermission();
      if (permission !== "granted") {
        console.log("Permissão de notificações negada");
        return;
      }

      // Obter player ID
      const playerId = await OneSignal.User.PushSubscription.id;
      if (!playerId) {
        console.warn("Não foi possível obter player ID");
        return;
      }

      playerIdRef.current = playerId;

      // Registrar no backend
      try {
        const deviceInfo = navigator.userAgent;
        const deviceType = /Mobile|Android|iPhone|iPad/.test(deviceInfo) ? "mobile" : "web";
        await registerPushToken(playerId, deviceType, deviceInfo);
        console.log("OneSignal player ID registrado:", playerId);
      } catch (error) {
        console.error("Erro ao registrar player ID:", error);
      }

      // Escutar cliques em notificações
      OneSignal.Notifications.addEventListener("click", (event: any) => {
        console.log("Notificação clicada:", event);
        const data = event.notification?.data;
        if (data?.kind === "new_content" && data?.content?.action_path) {
          window.location.href = data.content.action_path;
        } else if (data?.kind === "appointment_30min" || data?.kind === "appointment_completed") {
          window.location.href = "/paciente/sessoes";
        }
      });
    };

    void setup();

    // Cleanup
    return () => {
      if (playerIdRef.current) {
        unregisterPushToken(playerIdRef.current).catch(console.error);
        playerIdRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [auth.user]);
}
