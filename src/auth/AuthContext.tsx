import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAuthUser: (u: AuthUser | null) => void;
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.me();
      setAuthUser(me);
    } catch {
      setAuthUser(null);
    } finally {
      setLoading(false);
    }
  }, [setAuthUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (params: { email: string; password: string; remember?: boolean }) => {
    const u = await api.login(params);
    setAuthUser(u);
    return u;
  }, [setAuthUser]);

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
    () => ({ user, loading, refresh, setAuthUser, login, register, logout }),
    [user, loading, refresh, setAuthUser, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}










