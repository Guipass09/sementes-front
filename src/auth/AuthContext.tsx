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

  const normalizeRole = useCallback((role: any): "admin" | "user" => {
    if (!role) {
      console.log("🔍 [normalizeRole] Role vazio/null, retornando 'user'");
      return "user";
    }
    const r = String(role).toLowerCase().trim();
    console.log("🔍 [normalizeRole] Role recebido:", role, "-> normalizado para string:", r);
    
    const isAdmin = r === "admin" || r.includes("admin") || r.includes("administrador") || r.includes("administrator");
    console.log("🔍 [normalizeRole] É admin?", isAdmin);
    
    if (isAdmin) {
      return "admin";
    }
    return "user";
  }, []);

  const setAuthUser = useCallback((u: AuthUser | null) => {
    // normalize user before setting
    if (u) {
      const norm = { ...(u as any) } as AuthUser & any;
      // Normalize role to ensure it's always "admin" or "user"
      norm.role = normalizeRole(norm.role);
      norm.access = norm.access || { atividades: false, horarios: false, relatorios: false };
      setUser(norm as AuthUser);
      try {
        localStorage.setItem("user", JSON.stringify(norm)); // compatibilidade com partes antigas do app
      } catch {}
    } else {
      setUser(null);
      try {
        localStorage.removeItem("user");
      } catch {}
    }
  }, [normalizeRole]);

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
      // Clear old user data from localStorage to ensure fresh data
      try {
        const oldUser = localStorage.getItem("user");
        if (oldUser) {
          const parsed = JSON.parse(oldUser);
          // If old user has unnormalized role, clear it
          if (parsed.role && typeof parsed.role === "string") {
            const role = String(parsed.role).toLowerCase().trim();
            if (role !== "admin" && role !== "user" && (role.includes("admin") || role.includes("administrador"))) {
              localStorage.removeItem("user");
            }
          }
        }
      } catch {}
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
        // normalize user shape: ensure role is properly normalized and access defaults
        const user = { ...(data.user as any) } as AuthUser & any;
        
        // DEBUG: Log o que veio do backend
        console.log("🔍 [LOGIN DEBUG] Dados completos recebidos:", {
          token: data.token?.substring(0, 20) + "...",
          user: user,
          role_original: user.role,
          role_tipo: typeof user.role
        });
        
        // Tentar extrair role do token JWT também (fallback)
        let roleFromToken: string | null = null;
        try {
          const tokenParts = data.token.split(".");
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            roleFromToken = payload.role || payload.user?.role || null;
            console.log("🔍 [LOGIN DEBUG] Role extraído do token JWT:", roleFromToken);
          }
        } catch (e) {
          console.log("🔍 [LOGIN DEBUG] Não foi possível extrair role do token");
        }
        
        // Usar role do user primeiro, depois do token como fallback
        const roleOriginal = user.role || roleFromToken || "user";
        console.log("🔍 [LOGIN DEBUG] Role escolhido (user/token):", roleOriginal);
        
        // Normalize role using the same function
        user.role = normalizeRole(roleOriginal);
        
        // DEBUG: Log após normalização
        console.log("🔍 [LOGIN DEBUG] Role DEPOIS normalização:", user.role);
        console.log("🔍 [LOGIN DEBUG] É admin?", user.role === "admin");
        
        user.access = user.access || { atividades: false, horarios: false, relatorios: false };
        localStorage.setItem("user", JSON.stringify(user));

        setAuthUser(user as AuthUser);

        // Verificação definitiva do role para redirecionamento
        const finalRole = String(user.role || "").toLowerCase().trim();
        const isAdmin = finalRole === "admin" || finalRole.includes("admin") || finalRole.includes("administrador");
        
        console.log("🔍 [LOGIN DEBUG] Verificação final - finalRole:", finalRole, "isAdmin:", isAdmin);
        
        // REDIRECIONAMENTO IMEDIATO E FORÇADO
        // Não usar setTimeout - redirecionar imediatamente
        if (isAdmin) {
          console.log("✅ [LOGIN] ADMIN detectado! Redirecionando para /admin");
          // Usar replace para evitar que o usuário volte para a página de login
          window.location.replace("/admin");
        } else {
          console.log("✅ [LOGIN] USER detectado! Redirecionando para /paciente");
          window.location.replace("/paciente");
        }

        return user as AuthUser;
      } catch {
        // fallback
        setAuthUser(data.user);
        return data.user as AuthUser;
      }
    },
    [setAuthUser, normalizeRole]
  );

  const register = useCallback(async (params: { name: string; email: string; password: string; password_confirmation: string }) => {
    // Depending on backend, register may return token+user or user only.
    const res = await api.register(params as any);
    // try to sync local state if register returned user
    try {
      if ((res as any).token && (res as any).user) {
        localStorage.setItem("token", (res as any).token);
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










