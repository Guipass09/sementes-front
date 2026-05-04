import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, Activity, Calendar, FileText, Menu, X, LogOut, Grid3X3, Users, History } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { useAuth } from "@/auth/AuthContext";
import EditProfileModal from "@/components/EditProfileModal";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import NotificationsBell from "@/components/NotificationsBell";
import PwaInstallButton from "@/components/PwaInstallButton";
import SaleSchedulerListener from "@/components/SaleSchedulerListener";

interface UserData {
  name: string;
  email: string;
  role: string;
  profile_photo_url?: string | null;
}

const ProfessionalLayout = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const clinicName = String(auth.user?.clinic_name ?? "").trim();
  const affiliatedClinicName = String(auth.user?.affiliated_clinic_name ?? "").trim();
  const isClinicAccount = clinicName.length > 0;
  const navItems = [
    { path: "/profissional", label: "Dashboard", icon: LayoutDashboard },
    { path: "/profissional/pacientes", label: isClinicAccount ? "Terapeutas" : "Pacientes", icon: Users },
    { path: "/profissional/atividades", label: "Atividades", icon: Activity },
    { path: "/profissional/jogos", label: "Jogos", icon: Grid3X3 },
    { path: "/profissional/horarios", label: "Horários", icon: Calendar },
    { path: "/profissional/historico", label: "Histórico", icon: History },
    { path: "/profissional/relatorios", label: "Relatórios", icon: FileText },
  ];

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      navigate("/entrar");
      return;
    }

    const role = String(auth.user.role || "").toLowerCase().trim();
    const isProfessional = role === "professional" || role.includes("professional") || role.includes("profissional");
    if (!isProfessional) {
      // admin vai para /admin; user vai para /paciente
      const isAdmin = role === "admin" || role.includes("admin") || role.includes("administrador") || role.includes("administrator");
      navigate(isAdmin ? "/admin" : "/paciente");
      return;
    }

    setUser({
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
      profile_photo_url: auth.user.profile_photo_url ?? null,
    });
  }, [navigate, auth.loading, auth.user]);

  const handleLogout = () => {
    void auth.logout().finally(() => navigate("/"));
  };

  const isActivePath = (path: string) => {
    const currentPath = location.pathname;
    if (path === "/profissional") return currentPath === path;
    return currentPath.startsWith(path);
  };

  if (!user) return <FullScreenLogoLoader label="Carregando..." />;

  return (
    <div className="min-h-screen bg-background">
      <SaleSchedulerListener />
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 max-w-[1920px]">
          <Link to="/profissional" className="flex items-center gap-1.5 flex-shrink-0">
            <img src={logoImage} alt="Sementes da Fala" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain" />
            <span className="hidden sm:block font-display font-bold text-sm sm:text-base">
              <span className="text-brand-green">Sementes</span>{" "}
              <span className="text-brand-brown">da Fala</span>
              <span className="text-[9px] sm:text-[10px] ml-1 text-muted-foreground hidden md:inline">
                {isClinicAccount ? "Clínica" : affiliatedClinicName ? `Profissional • ${affiliatedClinicName}` : "Profissional"}
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 sm:gap-1 flex-1 min-w-0 justify-center overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 flex-shrink-0 text-xs sm:text-sm ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden lg:inline whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <NotificationsBell />
            <PwaInstallButton />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="hidden md:flex items-center gap-1.5 sm:gap-2 rounded-xl px-1.5 sm:px-2 py-1 hover:bg-muted/50 transition-colors"
              aria-label="Perfil"
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate max-w-[120px]">{user.name}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate max-w-[160px]">
                  {isClinicAccount ? "Clínica" : affiliatedClinicName ? `Clínica: ${affiliatedClinicName}` : "Profissional"}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                {user.profile_photo_url ? (
                  <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                )}
              </div>
            </button>

            <button onClick={handleLogout} className="hidden md:flex items-center gap-1 px-1 sm:px-1.5 py-1.5 sm:py-2 text-xs sm:text-sm text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={14} className="sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 sm:p-2 text-foreground hover:bg-muted/50 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} className="sm:w-6 sm:h-6" /> : <Menu size={20} className="sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>

        <div
          className={`md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-xl transition-all duration-300 overflow-hidden ${
            mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="container mx-auto px-4 py-4">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 pb-4 mb-4 border-b border-border text-left"
              aria-label="Perfil"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-white font-semibold text-lg">
                {user.profile_photo_url ? (
                  <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">Toque para editar perfil</p>
              </div>
            </button>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 mt-4 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <LogOut size={20} />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-14 sm:pt-16 min-h-screen">
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

export default ProfessionalLayout;
