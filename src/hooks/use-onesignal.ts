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
      console.log("[OneSignal] Iniciando setup...");
      
      // Carregar OneSignal SDK
      if (!window.OneSignal) {
        console.log("[OneSignal] Carregando SDK...");
        const script = document.createElement("script");
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = () => {
            console.log("[OneSignal] SDK carregado");
            resolve(undefined);
          };
          script.onerror = () => {
            console.error("[OneSignal] Erro ao carregar SDK");
            resolve(undefined);
          };
        });
      }

      const OneSignal = window.OneSignal;
      if (!OneSignal) {
        console.error("[OneSignal] SDK não carregou");
        return;
      }

      // Inicializar OneSignal
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
      console.log("[OneSignal] App ID:", appId ? "Configurado" : "NÃO CONFIGURADO");
      if (!appId) {
        console.error("[OneSignal] ONESIGNAL_APP_ID não configurado");
        return;
      }

      try {
        console.log("[OneSignal] Inicializando OneSignal...");
        await OneSignal.init({
          appId: appId,
          notifyButton: {
            enable: false, // Não mostrar botão padrão
          },
          allowLocalhostAsSecureOrigin: true, // Para desenvolvimento
          serviceWorkerParam: {
            scope: "/",
          },
          serviceWorkerPath: "OneSignalSDKWorker.js",
        });
        console.log("[OneSignal] OneSignal inicializado com sucesso");
      } catch (error) {
        console.error("[OneSignal] Erro ao inicializar:", error);
        return;
      }

      // Verificar permissão atual
      const currentPermission = await OneSignal.Notifications.permissionNative;
      console.log("[OneSignal] Permissão atual:", currentPermission);

      // Solicitar permissão
      console.log("[OneSignal] Solicitando permissão...");
      const permission = await OneSignal.Notifications.requestPermission();
      console.log("[OneSignal] Permissão retornada:", permission);
      
      if (permission !== "granted") {
        console.warn("[OneSignal] Permissão de notificações negada ou não concedida:", permission);
        console.warn("[OneSignal] Para receber push notifications, você precisa permitir notificações no navegador");
        return;
      }

      // Verificar se o service worker está ativo
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          console.log("[OneSignal] Service Worker registrado:", registration ? "Sim" : "Não");
          if (registration) {
            console.log("[OneSignal] Service Worker scope:", registration.scope);
            console.log("[OneSignal] Service Worker active:", registration.active ? "Sim" : "Não");
          }
        } catch (e) {
          console.error("[OneSignal] Erro ao verificar service worker:", e);
        }
      }

      // Aguardar um pouco para garantir que o player ID está disponível
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Obter player ID
      console.log("[OneSignal] Obtendo player ID...");
      let playerId: string | null = null;
      try {
        // Verificar se está inscrito
        const isSubscribed = await OneSignal.User.PushSubscription.optedIn;
        console.log("[OneSignal] Push subscription opted in:", isSubscribed);
        
        if (isSubscribed) {
          playerId = await OneSignal.User.PushSubscription.id;
          console.log("[OneSignal] Player ID obtido:", playerId);
        } else {
          console.warn("[OneSignal] Usuário não está inscrito para push notifications");
          // Tentar inscrever novamente
          try {
            await OneSignal.User.PushSubscription.optIn();
            await new Promise(resolve => setTimeout(resolve, 500));
            playerId = await OneSignal.User.PushSubscription.id;
            console.log("[OneSignal] Player ID obtido após opt-in:", playerId);
          } catch (optInError) {
            console.error("[OneSignal] Erro ao fazer opt-in:", optInError);
          }
        }
      } catch (error) {
        console.error("[OneSignal] Erro ao obter player ID:", error);
      }

      if (!playerId) {
        console.error("[OneSignal] Não foi possível obter player ID após múltiplas tentativas");
        return;
      }

      playerIdRef.current = playerId;

      // Registrar no backend
      try {
        console.log("[OneSignal] Registrando player ID no backend...");
        const deviceInfo = navigator.userAgent;
        const deviceType = /Mobile|Android|iPhone|iPad/.test(deviceInfo) ? "mobile" : "web";
        console.log("[OneSignal] Device type:", deviceType);
        await registerPushToken(playerId, deviceType, deviceInfo);
        console.log("[OneSignal] ✅ Player ID registrado com sucesso:", playerId);
      } catch (error) {
        console.error("[OneSignal] ❌ Erro ao registrar player ID:", error);
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
