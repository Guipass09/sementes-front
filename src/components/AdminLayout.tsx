import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, Activity, Calendar, FileText, Menu, X, LogOut, Grid3X3 } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { useAuth } from "@/auth/AuthContext";
import EditProfileModal from "@/components/EditProfileModal";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";

interface UserData {
  name: string;
  email: string;
  role: string;
  profile_photo_url?: string | null;
}

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard, previewPath: "/preview-admin" },
  { path: "/admin/usuarios", label: "Usuários", icon: Users, previewPath: "/preview-admin/usuarios" },
  { path: "/admin/atividades", label: "Atividades", icon: Activity, previewPath: "/preview-admin/atividades" },
  { path: "/admin/jogos", label: "Jogos", icon: Grid3X3, previewPath: "/preview-admin/jogos" },
  { path: "/admin/horarios", label: "Horários", icon: Calendar, previewPath: "/preview-admin/horarios" },
  { path: "/admin/relatorios", label: "Relatórios", icon: FileText, previewPath: "/preview-admin/relatorios" },
];

const AdminLayout = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    // Se estiver na rota de preview, usar dados mock sem autenticação
    if (location.pathname.startsWith("/preview-admin")) {
      setUser({
        name: "Admin Preview",
        email: "admin@preview.com",
        role: "admin",
        profile_photo_url: null,
      });
      return;
    }

    if (auth.loading) return;

    if (!auth.user) {
      navigate("/entrar");
      return;
    }

    // Normalize role check to ensure admin detection works correctly
    const role = String(auth.user.role || "").toLowerCase().trim();
    if (role !== "admin") {
      navigate("/paciente");
      return;
    }

    setUser({
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
      profile_photo_url: auth.user.profile_photo_url ?? null,
    });
  }, [navigate, auth.loading, auth.user, location.pathname]);

  const handleLogout = () => {
    if (location.pathname.startsWith("/preview-admin")) {
      // Na preview, apenas voltar para home
      navigate("/");
    } else {
      void auth.logout().finally(() => navigate("/"));
    }
  };

  const isActivePath = (path: string) => {
    const currentPath = location.pathname;
    if (path === "/admin") {
      return currentPath === path || currentPath === "/preview-admin";
    }
    return currentPath.startsWith(path) || currentPath.startsWith(path.replace("/admin", "/preview-admin"));
  };

  const getNavPath = (item: typeof navItems[0]) => {
    return location.pathname.startsWith("/preview-admin") ? item.previewPath : item.path;
  };

  if (!user) return <FullScreenLogoLoader label="Carregando..." />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to={location.pathname.startsWith("/preview-admin") ? "/preview-admin" : "/admin"} className="flex items-center gap-2 flex-shrink-0">
            <img
              src={logoImage}
              alt="Sementes da Fala"
              className="w-10 h-10 rounded-lg object-contain"
            />
            <span className="hidden lg:block font-display font-bold text-lg">
              <span className="text-brand-green">Sementes</span>{" "}
              <span className="text-brand-brown">da Fala</span>
              <span className="text-xs ml-2 text-muted-foreground">Admin</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 justify-center overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  to={getNavPath(item)}
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-shrink-0 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* User Info - Desktop */}
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted/50 transition-colors"
              aria-label="Perfil"
            >
              <div className="text-right hidden xl:block">
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-orange to-brand-orange-dark flex items-center justify-center text-white font-semibold flex-shrink-0">
                {user.profile_photo_url ? (
                  <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map(n => n[0]).join("").slice(0, 2)
                )}
              </div>
            </button>

            {/* Logout Button - Desktop */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-2 lg:px-3 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-foreground hover:bg-muted/50 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden absolute top-full left-0 right-0 bg-background/98 backdrop-blur-lg border-b border-border shadow-lg transition-all duration-300 overflow-hidden ${
            mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="container mx-auto px-4 py-4">
            {/* User Info - Mobile */}
            <button
              type="button"
              onClick={() => {
                setProfileOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 pb-4 mb-4 border-b border-border text-left"
              aria-label="Perfil"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-orange to-brand-orange-dark flex items-center justify-center text-white font-semibold text-lg">
                {user.profile_photo_url ? (
                  <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map(n => n[0]).join("").slice(0, 2)
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">Toque para editar perfil</p>
              </div>
            </button>

            {/* Navigation Links - Mobile */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={getNavPath(item)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout - Mobile */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 mt-4 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>

      {auth.user && (
        <EditProfileModal
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={auth.user}
          onSaved={(u) => auth.setAuthUser(u)}
        />
      )}
    </div>
  );
};

export default AdminLayout;



