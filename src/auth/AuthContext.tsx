import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import apiClient from "@/services/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAuthUser: (u: AuthUser | null) => void;
  loadUser: () => Promise<AuthUser | null>;
  login: (params: { email: string; password: string; remember?: boolean }) => Promise<AuthUser>;
  register: (params: { name: string; email: string; phone: string; password: string; password_confirmation: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setAuthUser = useCallback((u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem("user", JSON.stringify(u)); // compatibilidade com partes antigas do app
      // marca sessão válida para permitir carregamento posterior do usuário
      localStorage.setItem("session_valid", "1");
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("session_valid");
    }
  }, []);

  const loadUser = useCallback(async (): Promise<AuthUser | null> => {
    setLoading(true);
    try {
      const me = await api.me();
      setAuthUser(me);
      return me;
    } catch {
      setAuthUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAuthUser]);

  const refresh = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  // Não chamar /api/me automaticamente no mount, apenas quando
  // existir um flag explícito de sessão válida (setado no login)
  useEffect(() => {
    const shouldLoad = localStorage.getItem("session_valid") === "1";
    if (shouldLoad) {
      void loadUser();
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  // Eventos disparados pelo interceptor axios (centralizado em services/api.ts)
  useEffect(() => {
    const onCsrf = async () => {
      // Limpa estado de autenticação e tenta re-obter CSRF para futuro login
      setAuthUser(null);
      try {
        await apiClient.get("/sanctum/csrf-cookie");
      } catch {}
    };

    const onUnauthorized = (e: Event) => {
      try {
        const detail: any = (e as CustomEvent).detail;
        const currentPath = detail?.path || window.location.pathname;
        // não explodir UI quando estamos na página de login
        if (currentPath && currentPath.includes("/entrar")) return;
      } catch {}
      setAuthUser(null);
    };

    window.addEventListener("api:csrf", onCsrf as EventListener);
    window.addEventListener("api:unauthorized", onUnauthorized as EventListener);
    return () => {
      window.removeEventListener("api:csrf", onCsrf as EventListener);
      window.removeEventListener("api:unauthorized", onUnauthorized as EventListener);
    };
  }, [setAuthUser]);

  const login = useCallback(
    async (params: { email: string; password: string; remember?: boolean }) => {
      // garantir CSRF cookie antes do POST /api/login
      await apiClient.get("/sanctum/csrf-cookie");

      // realizar login (usa cookies HttpOnly do backend)
      await apiClient.post("/api/login", {
        email: params.email,
        password: params.password,
        remember: !!params.remember,
      });

      // carregar usuário autenticado somente após login bem sucedido
      const u = await loadUser();

      // retornar usuário como antes
      if (!u) throw new Error("Falha ao carregar usuário após login");

      return u;
    },
    [loadUser]
  );

  const register = useCallback(async (params: { name: string; email: string; password: string; password_confirmation: string }) => {
    const u = await api.register(params);
    setAuthUser(u);
    return u;
  }, [setAuthUser]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setAuthUser(null);
    }
  }, [setAuthUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, setAuthUser, loadUser, login, register, logout }),
    [user, loading, refresh, setAuthUser, loadUser, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}










