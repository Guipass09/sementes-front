import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthContext";
import { registerPushToken, unregisterPushToken } from "@/lib/laravel-api";

// Firebase config - você precisa adicionar suas credenciais FCM aqui
// Para obter: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const FCM_VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "";

let messaging: any = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

async function initializeFirebase() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    // Registrar service worker para push
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    serviceWorkerRegistration = registration;

    // Carregar Firebase SDK dinamicamente
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, isSupported, onMessage } = await import("firebase/messaging");

    if (!(await isSupported())) {
      console.warn("Firebase Messaging não é suportado neste navegador");
      return null;
    }

    const apps = getApps();
    let app;
    if (apps.length === 0) {
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
      };
      app = initializeApp(firebaseConfig);
    } else {
      app = apps[0];
    }

    messaging = getMessaging(app);

    // Escutar mensagens quando app está aberto
    onMessage(messaging, (payload) => {
      console.log("Push notification recebida (app aberto):", payload);
      // O NotificationsBell já mostra toast, então só logamos aqui
    });

    return messaging;
  } catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
    return null;
  }
}

async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  return await Notification.requestPermission();
}

async function getFCMToken(messagingInstance: any): Promise<string | null> {
  if (!messagingInstance || !FCM_VAPID_KEY) {
    console.warn("FCM não configurado: falta VAPID_KEY ou messaging");
    return null;
  }

  try {
    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messagingInstance, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration,
    });
    return token || null;
  } catch (error) {
    console.error("Erro ao obter token FCM:", error);
    return null;
  }
}

export function usePushNotifications() {
  const auth = useAuth();
  const tokenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!auth.user || initializedRef.current) return;

    initializedRef.current = true;

    const setup = async () => {
      // 1. Solicitar permissão
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        console.log("Permissão de notificações negada");
        return;
      }

      // 2. Inicializar Firebase
      const messagingInstance = await initializeFirebase();
      if (!messagingInstance) {
        console.warn("Firebase Messaging não disponível");
        return;
      }

      // 3. Obter token FCM
      const token = await getFCMToken(messagingInstance);
      if (!token) {
        console.warn("Não foi possível obter token FCM");
        return;
      }

      tokenRef.current = token;

      // 4. Registrar token no backend
      try {
        const deviceInfo = navigator.userAgent;
        const deviceType = /Mobile|Android|iPhone|iPad/.test(deviceInfo) ? "mobile" : "web";
        await registerPushToken(token, deviceType, deviceInfo);
        console.log("Token FCM registrado com sucesso");
      } catch (error) {
        console.error("Erro ao registrar token FCM:", error);
      }
    };

    void setup();

    // Cleanup: remover token ao deslogar
    return () => {
      if (tokenRef.current) {
        unregisterPushToken(tokenRef.current).catch(console.error);
        tokenRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [auth.user]);
}
