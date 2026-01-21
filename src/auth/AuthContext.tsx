import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  register: (params: { name: string; email: string; phone: string; child_age?: number | null; password: string; password_confirmation: string }) => Promise<AuthUser>;
  registerProfessional: (params: {
    name: string;
    email: string;
    phone: string;
    professional_age: number;
    professional_crfa: string;
    professional_registration: string;
    password: string;
    password_confirmation: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Função auxiliar para normalizar role (mesma lógica do normalizeRole mas sem callback)
  const normalizeRoleSync = (role: any): "admin" | "user" | "professional" => {
    if (!role) return "user";
    const r = String(role).toLowerCase().trim();
    const isAdmin = r === "admin" || r.includes("admin") || r.includes("administrador") || r.includes("administrator");
    if (isAdmin) return "admin";
    const isProfessional = r === "professional" || r.includes("professional") || r.includes("profissional");
    return isProfessional ? "professional" : "user";
  };

  // Inicializar estado a partir do localStorage para evitar chamadas desnecessárias a /api/me
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Normalizar role
        parsed.role = normalizeRoleSync(parsed.role);
        // Garantir que access nunca seja null
        parsed.access = parsed.access ?? {
          atividades: false,
          horarios: false,
          relatorios: false,
        };
        return parsed as AuthUser;
      }
    } catch {
      // Ignora erros de parse
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const didInitialSyncRef = useRef(false);

  const normalizeRole = useCallback((role: any): "admin" | "user" | "professional" => {
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
    const isProfessional = r === "professional" || r.includes("professional") || r.includes("profissional");
    if (isProfessional) return "professional";
    return "user";
  }, []);

  const setAuthUser = useCallback((u: AuthUser | null) => {
    // normalize user before setting
    if (u) {
      const norm = { ...(u as any) } as AuthUser & any;
      // Normalize role to ensure it's always "admin" or "user"
      norm.role = normalizeRole(norm.role);
      // Garantir que access nunca seja null usando ??
      norm.access = norm.access ?? {
        atividades: false,
        horarios: false,
        relatorios: false,
      };
      setUser(norm as AuthUser);
      try {
        localStorage.setItem("user", JSON.stringify(norm));
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
    } catch (e: any) {
      // Só limpa o token se for erro 401 (token realmente inválido)
      // Para outros erros (rede, servidor offline), mantém o usuário logado
      const status = e?.status || e?.response?.status;
      if (status === 401) {
        setAuthUser(null);
        try {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        } catch {}
      }
      // Se não for 401, mantém o user do localStorage
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAuthUser]);

  const refresh = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  // On mount: usar user do localStorage primeiro, mas sincronizar /api/me em background
  // para refletir mudanças de permissões (ex.: admin liberou "Horários") só com refresh.
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (token && (user || storedUser)) {
      // UX: renderiza imediatamente com o user armazenado,
      // mas sincroniza permissões/dados em background via /api/me.
      setLoading(false);
      if (didInitialSyncRef.current) return;
      didInitialSyncRef.current = true;
      void (async () => {
        try {
          const me = await api.me();
          setAuthUser(me);
        } catch (e: any) {
          const status = e?.status || e?.response?.status;
          if (status === 401) {
            setAuthUser(null);
            try {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
            } catch {}
          }
        }
      })();
      return;
    }
    
    if (token && !user && !storedUser) {
      // Só chama /api/me se tiver token mas não tiver user em lugar nenhum (caso raro)
      void loadUser();
    } else {
      // Sem token, não precisa fazer nada
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez no mount

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
        
        // Garantir que access nunca seja null usando ??
        user.access = user.access ?? {
          atividades: false,
          horarios: false,
          relatorios: false,
        };
        
        // Salvar token e user antes de redirecionar
        localStorage.setItem("user", JSON.stringify(user));
        setAuthUser(user as AuthUser);

        // Verificação definitiva do role para redirecionamento
        const finalRole = String(user.role || "").toLowerCase().trim();
        const isAdmin = finalRole === "admin" || finalRole.includes("admin") || finalRole.includes("administrador");
        const isProfessional = finalRole === "professional" || finalRole.includes("professional") || finalRole.includes("profissional");
        
        console.log("🔍 [LOGIN DEBUG] Verificação final - finalRole:", finalRole, "isAdmin:", isAdmin);
        
        // Redirecionamento usando href (não replace)
        if (isAdmin) {
          console.log("✅ [LOGIN] ADMIN detectado! Redirecionando para /admin");
          window.location.href = "/admin";
        } else if (isProfessional) {
          console.log("✅ [LOGIN] PROFESSIONAL detectado! Redirecionando para /profissional");
          window.location.href = "/profissional";
        } else {
          console.log("✅ [LOGIN] USER detectado! Redirecionando para /paciente");
          window.location.href = "/paciente";
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

  const register = useCallback(async (params: { name: string; email: string; phone?: string; child_age?: number | null; password: string; password_confirmation: string }) => {
    // Backend pode retornar token+user ou apenas user
    const res = await api.register(params as any);
    
    try {
      if ((res as any).token && (res as any).user) {
        localStorage.setItem("token", (res as any).token);
        const userData = { ...(res as any).user } as AuthUser & any;
        
        // Normalizar role: usuários novos sempre são "user" (não admin)
        // Se o backend retornar algo diferente, normalizamos para "user"
        const roleOriginal = userData.role || "user";
        userData.role = normalizeRole(roleOriginal);
        
        // Garantir que usuários novos sempre sejam "user" (não admin)
        // Mesmo se o backend retornar algo diferente, forçamos "user" para novos cadastros
        if (userData.role === "admin") {
          console.log("⚠️ [REGISTER] Role admin detectado em novo cadastro, corrigindo para 'user'");
          userData.role = "user";
        }
        
        // Garantir que access nunca seja null usando ??
        userData.access = userData.access ?? {
          atividades: false,
          horarios: false,
          relatorios: false,
        };
        
        console.log("✅ [REGISTER] Usuário cadastrado:", {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          access: userData.access
        });
        
        localStorage.setItem("user", JSON.stringify(userData));
        setAuthUser(userData as AuthUser);
        
        // Redirecionar para /paciente (usuários novos sempre vão para paciente, nunca admin)
        console.log("✅ [REGISTER] Redirecionando novo usuário para /paciente");
        window.location.href = "/paciente";
        
        return userData as AuthUser;
      }
    } catch {}
    
    // Fallback: se register retornou apenas o user object
    const userData = { ...res } as AuthUser & any;
    
    // Normalizar role: usuários novos sempre são "user"
    const roleOriginal = userData.role || "user";
    userData.role = normalizeRole(roleOriginal);
    
    // Garantir que usuários novos sempre sejam "user"
    if (userData.role === "admin") {
      console.log("⚠️ [REGISTER] Role admin detectado em novo cadastro, corrigindo para 'user'");
      userData.role = "user";
    }
    
    userData.access = userData.access ?? {
      atividades: false,
      horarios: false,
      relatorios: false,
    };
    
    console.log("✅ [REGISTER] Usuário cadastrado (fallback):", {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      access: userData.access
    });
    
    localStorage.setItem("user", JSON.stringify(userData));
    setAuthUser(userData as AuthUser);
    
    // Redirecionar para /paciente
    console.log("✅ [REGISTER] Redirecionando novo usuário para /paciente (fallback)");
    window.location.href = "/paciente";
    
    return userData as AuthUser;
  }, [setAuthUser, normalizeRole]);

  const registerProfessional = useCallback(
    async (params: {
      name: string;
      email: string;
      phone: string;
      professional_age: number;
      professional_crfa: string;
      professional_registration: string;
      password: string;
      password_confirmation: string;
    }) => {
      const res = await api.registerProfessional(params as any);

      if (!(res as any)?.token || !(res as any)?.user) {
        throw new Error("Resposta de cadastro (profissional) inválida");
      }

      localStorage.setItem("token", (res as any).token);
      const userData = { ...(res as any).user } as AuthUser & any;
      userData.role = normalizeRole(userData.role || "professional");
      userData.access = userData.access ?? { atividades: false, horarios: false, relatorios: false };

      localStorage.setItem("user", JSON.stringify(userData));
      setAuthUser(userData as AuthUser);

      window.location.href = "/profissional";
      return userData as AuthUser;
    },
    [setAuthUser, normalizeRole]
  );

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
    () => ({ user, loading, refresh, setAuthUser, loadUser, login, register, registerProfessional, logout }),
    [user, loading, refresh, setAuthUser, loadUser, login, register, registerProfessional, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}










