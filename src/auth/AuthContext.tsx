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
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  const loadUser = useCallback(async (): Promise<AuthUser | null> => {
    setLoading(true);
    try {
      const me = await api.me();
      setAuthUser(me);
      return me;
    } catch (e) {
      setAuthUser(null);
      // clear token if me fails
      try {
        localStorage.removeItem("token");
      } catch {}
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAuthUser]);

  const refresh = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  // On mount, if token exists, try to load user; otherwise don't call /api/me
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      void loadUser();
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const login = useCallback(
    async (params: { email: string; password: string; remember?: boolean }) => {
      // POST /api/login -> expects { token, user }
      const res = await apiClient.post("/api/login", {
        email: params.email,
        password: params.password,
        remember: !!params.remember,
      });

      const data = res?.data;
      if (!data || !data.token || !data.user) {
        throw new Error("Resposta de login inválida");
      }

      try {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch {}

      setAuthUser(data.user);

      return data.user as AuthUser;
    },
    [setAuthUser]
  );

  const register = useCallback(async (params: { name: string; email: string; password: string; password_confirmation: string }) => {
    // Depending on backend, register may return token+user or user only.
    const res = await api.register(params as any);
    // try to sync local state if register returned user
    try {
      if ((res as any).token && (res as any).user) {
        localStorage.setItem("token", (res as any).token);
        localStorage.setItem("user", JSON.stringify((res as any).user));
        setAuthUser((res as any).user);
        return (res as any).user as AuthUser;
      }
    } catch {}
    // fallback: if register returned the user object
    setAuthUser(res as AuthUser);
    return res as AuthUser;
  }, [setAuthUser]);

  const logout = useCallback(async () => {
    try {
      // attempt to revoke token on backend
      try {
        await apiClient.post("/api/logout");
      } catch {}
    } finally {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {}
      setAuthUser(null);
      try {
        window.location.replace("/entrar");
      } catch {}
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










