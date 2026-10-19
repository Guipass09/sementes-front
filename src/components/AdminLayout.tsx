import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, ClipboardList, Gamepad2, LayoutDashboard, UserRound, UsersRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import ProfileShell, { type ProfileNavItem } from "@/components/ProfileShell";
import SaleSchedulerListener from "@/components/SaleSchedulerListener";
import { resourceNavigation } from "@/lib/resource-navigation";

const items = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/usuarios", label: "Usuários", icon: UsersRound },
  { path: "/admin/atividades", label: "Atividades", icon: ClipboardList },
  { path: "/admin/jogos", label: "Jogos", icon: Gamepad2 },
  { path: "/admin/horarios", label: "Horários", icon: CalendarDays },
  { path: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { path: "/admin/perfil", label: "Perfil", icon: UserRound },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const isPreview = location.pathname.startsWith("/preview-admin");
  const user = isPreview ? { name: "Admin Preview", profile_photo_url: null } : auth.user;

  useEffect(() => {
    if (isPreview || auth.loading) return;
    if (!auth.user) {
      navigate("/entrar");
    } else if (String(auth.user.role || "").toLowerCase().trim() !== "admin") {
      navigate("/paciente");
    }
  }, [navigate, auth.loading, auth.user, isPreview]);

  if (!user || (!isPreview && auth.loading)) return <FullScreenLogoLoader label="Carregando..." />;

  const homePath = isPreview ? "/preview-admin" : "/admin";
  const resources = resourceNavigation(homePath, { preview: isPreview });
  const navItems: ProfileNavItem[] = items.map((item) => {
    const path = isPreview ? item.path.replace("/admin", "/preview-admin") : item.path;
    const children = item.path.endsWith("/jogos") ? resources.games : item.path.endsWith("/atividades") ? resources.activities : undefined;
    return { ...item, path, children, active: path === homePath ? location.pathname === path : location.pathname.startsWith(path) };
  });

  return (
    <ProfileShell
      homePath={homePath}
      name={user.name}
      subtitle="Administrador"
      photoUrl={user.profile_photo_url}
      navItems={navItems}
      onProfile={() => navigate(`${homePath}/perfil`)}
      onLogout={() => isPreview ? navigate("/") : void auth.logout().finally(() => navigate("/"))}
    >
      <SaleSchedulerListener />
      <Outlet />
    </ProfileShell>
  );
}
