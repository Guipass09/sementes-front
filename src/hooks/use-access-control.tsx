import { useMemo } from "react";
import { useAuth } from "@/auth/AuthContext";

interface UserAccess {
  atividades: boolean;
  horarios: boolean;
  relatorios: boolean;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  blocked: boolean;
  access: UserAccess;
}

export const useAccessControl = () => {
  const { user: currentUser } = useAuth();

  const userAccess = useMemo(() => {
    if (!currentUser) {
      // No user: no access
      return {
        atividades: false,
        horarios: false,
        relatorios: false,
        blocked: false,
      };
    }

    if (currentUser.role === "admin") {
      // Admin has full access
      return {
        atividades: true,
        horarios: true,
        relatorios: true,
        blocked: false,
      };
    }

    // Be defensive: user.access may be undefined depending on backend
    const access = (currentUser as any).access || { atividades: false, horarios: false, relatorios: false };

    return {
      atividades: !currentUser.blocked && !!access.atividades,
      horarios: !currentUser.blocked && !!access.horarios,
      relatorios: !currentUser.blocked && !!access.relatorios,
      blocked: !!currentUser.blocked,
    };
  }, [currentUser]);

  const checkAccess = (page: "atividades" | "horarios" | "relatorios"): boolean => {
    if (currentUser?.role === "admin") return true;
    if (userAccess.blocked) return false;
    return userAccess[page];
  };

  return {
    userAccess,
    checkAccess,
    isBlocked: userAccess.blocked,
  };
};

