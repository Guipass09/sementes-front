import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLogoLoader label="Carregando..." />;
  if (!user) return <Navigate to="/entrar" replace />;
  
  // Verificar role de múltiplas fontes
  const role = String(user.role || "").toLowerCase().trim();
  
  // Tentar também do localStorage diretamente (caso o user ainda não tenha sido normalizado)
  let roleFromStorage: string | null = null;
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      roleFromStorage = String(parsed.role || "").toLowerCase().trim();
    }
  } catch {}
  
  // Usar o role mais confiável
  const finalRole = role || roleFromStorage || "";
  
  // Verificação robusta de admin
  const isAdmin = 
    finalRole === "admin" || 
    finalRole.includes("admin") || 
    finalRole.includes("administrador") || 
    finalRole.includes("administrator");
  
  console.log("🔍 [RequireAdmin] Verificando acesso:", {
    user_role: role,
    storage_role: roleFromStorage,
    final_role: finalRole,
    is_admin: isAdmin
  });
  
  if (!isAdmin) {
    // If user is not admin, redirect to patient area
    console.log("❌ [RequireAdmin] Usuário não é admin, redirecionando para /paciente");
    return <Navigate to="/paciente" replace />;
  }
  
  console.log("✅ [RequireAdmin] Admin confirmado, permitindo acesso");
  return <>{children}</>;
}

export function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLogoLoader label="Carregando..." />;
  if (!user) return <Navigate to="/entrar" replace />;
  // Ensure role is properly checked - normalize if needed
  const role = String(user.role || "").toLowerCase().trim();
  // Check if role contains "admin" in any form
  if (role === "admin" || role.includes("admin") || role.includes("administrador") || role.includes("administrator")) {
    // If user is admin, redirect to admin area immediately
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}











