import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLogoLoader label="Carregando..." />;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role !== "admin") return <Navigate to="/paciente" replace />;
  return <>{children}</>;
}

export function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLogoLoader label="Carregando..." />;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}











