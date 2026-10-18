import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Calendar, FileText, Grid3X3, LayoutDashboard, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import EditProfileModal from "@/components/EditProfileModal";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import ProfileShell, { type ProfileNavItem } from "@/components/ProfileShell";
import SaleSchedulerListener from "@/components/SaleSchedulerListener";

const items = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/usuarios", label: "Usuários", icon: Users },
  { path: "/admin/atividades", label: "Atividades", icon: Activity },
  { path: "/admin/jogos", label: "Jogos", icon: Grid3X3 },
  { path: "/admin/horarios", label: "Horários", icon: Calendar },
  { path: "/admin/relatorios", label: "Relatórios", icon: FileText },
];

export default function AdminLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
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
  const navItems: ProfileNavItem[] = items.map((item) => {
    const path = isPreview ? item.path.replace("/admin", "/preview-admin") : item.path;
    return { ...item, path, active: path === homePath ? location.pathname === path : location.pathname.startsWith(path) };
  });

  return (
    <ProfileShell
      homePath={homePath}
      name={user.name}
      subtitle="Administrador"
      photoUrl={user.profile_photo_url}
      navItems={navItems}
      onProfile={() => setProfileOpen(true)}
      onLogout={() => isPreview ? navigate("/") : void auth.logout().finally(() => navigate("/"))}
    >
      <SaleSchedulerListener />
      <Outlet />
      {!isPreview && auth.user && (
        <EditProfileModal open={profileOpen} onOpenChange={setProfileOpen} user={auth.user} onSaved={auth.setAuthUser} />
      )}
    </ProfileShell>
  );
}
