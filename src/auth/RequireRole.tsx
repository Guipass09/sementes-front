import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLogoLoader label="Carregando..." />;
  if (!user) return <Navigate to="/entrar" replace />;
  // Ensure role is properly checked - normalize if needed
  const role = String(user.role || "").toLowerCase().trim();
  // Check if role contains "admin" in any form
  const isAdmin = role === "admin" || role.includes("admin") || role.includes("administrador") || role.includes("administrator");
  if (!isAdmin) {
    // If user is not admin, redirect to patient area
    return <Navigate to="/paciente" replace />;
  }
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











