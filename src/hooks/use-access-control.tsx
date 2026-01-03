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
    if (!currentUser || currentUser.role === "admin") {
      // Admin has full access
      return {
        atividades: true,
        horarios: true,
        relatorios: true,
        blocked: false,
      };
    }

    return {
      atividades: !currentUser.blocked && currentUser.access.atividades,
      horarios: !currentUser.blocked && currentUser.access.horarios,
      relatorios: !currentUser.blocked && currentUser.access.relatorios,
      blocked: currentUser.blocked,
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

