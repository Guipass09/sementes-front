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
  if (role !== "admin") {
    // If user is not admin, redirect to patient area (or login if not authenticated)
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
  if (role === "admin") {
    // If user is admin, redirect to admin area
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}











