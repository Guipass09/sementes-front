import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, ClipboardList, Gamepad2, Home, UserRoundCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import EditProfileModal from "@/components/EditProfileModal";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import ProfileShell, { type ProfileNavItem } from "@/components/ProfileShell";
import { useAccessControl } from "@/hooks/use-access-control";
import { patientListLinkRequests } from "@/lib/laravel-api";
import PatientLinkRequests from "@/pages/patient/PatientLinkRequests";
import { resourceNavigation } from "@/lib/resource-navigation";

const items = [
  { path: "/paciente", label: "Início", icon: Home },
  { path: "/paciente/atividades", label: "Atividades", icon: ClipboardList },
  { path: "/paciente/jogos", label: "Jogos", icon: Gamepad2 },
  { path: "/paciente/sessoes", label: "Sessões", icon: CalendarDays },
  { path: "/paciente/relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function PatientLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { checkAccess, isBlocked } = useAccessControl();
  const auth = useAuth();
  const isPreview = location.pathname.startsWith("/preview-paciente");
  const user = isPreview ? { name: "Paciente Preview", profile_photo_url: null } : auth.user;

  const refreshPendingRequests = useCallback(async () => {
    if (isPreview || !auth.user || auth.user.role !== "user") return;
    try {
      setPendingRequests((await patientListLinkRequests()).length);
    } catch {
      // Keep the notification available even if the count cannot refresh.
    }
  }, [isPreview, auth.user?.id, auth.user?.role]);

  useEffect(() => {
    if (isPreview || !auth.user || auth.user.role !== "user") return;
    void refreshPendingRequests();
    const onFocus = () => void refreshPendingRequests();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void refreshPendingRequests(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [isPreview, auth.user?.id, auth.user?.role, refreshPendingRequests]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("solicitacoes") === "1") setRequestsOpen(true);
  }, [location.search]);

  const changeRequestsOpen = (open: boolean) => {
    setRequestsOpen(open);
    if (!open) {
      const params = new URLSearchParams(location.search);
      if (params.has("solicitacoes")) {
        params.delete("solicitacoes");
        navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true });
      }
    }
  };

  useEffect(() => {
    if (isPreview || auth.loading) return;
    if (!auth.user) {
      navigate("/entrar");
      return;
    }
    const role = String(auth.user.role || "").toLowerCase().trim();
    if (role === "admin" || role.includes("admin") || role.includes("administrador") || role.includes("administrator")) {
      navigate("/admin", { replace: true });
    }
  }, [navigate, auth.loading, auth.user, isPreview]);

  useEffect(() => {
    if (!isPreview && user && isBlocked) navigate("/entrar");
  }, [user, isBlocked, isPreview, navigate]);

  if (!user || (!isPreview && auth.loading)) return <FullScreenLogoLoader label="Carregando..." />;

  const homePath = isPreview ? "/preview-paciente" : "/paciente";
  const resources = resourceNavigation(homePath, { patient: true, preview: isPreview });
  const navItems: ProfileNavItem[] = items
    .filter((item) => isPreview || item.path !== "/paciente/sessoes" || checkAccess("horarios"))
    .map((item) => {
      const path = isPreview ? item.path.replace("/paciente", "/preview-paciente") : item.path;
      const children = item.path.endsWith("/jogos") ? resources.games : item.path.endsWith("/atividades") ? resources.activities : undefined;
      return { ...item, path, children, active: path === homePath ? location.pathname === path : location.pathname.startsWith(path) };
    });

  const requestAction = pendingRequests > 0 ? (
    <button
      type="button"
      onClick={() => changeRequestsOpen(true)}
      className="relative inline-flex h-9 w-9 flex-none items-center justify-center rounded-md text-brand-green hover:bg-primary/10"
      aria-label={`${pendingRequests} solicitações de acompanhamento pendentes`}
      title="Solicitações de acompanhamento"
    >
      <UserRoundCheck size={18} />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-0.5 text-[10px] text-white">
        {pendingRequests > 9 ? "9+" : pendingRequests}
      </span>
    </button>
  ) : null;

  return (
    <ProfileShell
      homePath={homePath}
      name={user.name}
      subtitle="Paciente"
      photoUrl={user.profile_photo_url}
      navItems={navItems}
      actions={requestAction}
      onProfile={() => setProfileOpen(true)}
      onLogout={() => isPreview ? navigate("/") : void auth.logout().finally(() => navigate("/"))}
    >
      <Outlet />
      {!isPreview && auth.user && (
        <EditProfileModal open={profileOpen} onOpenChange={setProfileOpen} user={auth.user} onSaved={auth.setAuthUser} />
      )}
      <PatientLinkRequests open={requestsOpen} onOpenChange={changeRequestsOpen} onResolved={() => void refreshPendingRequests()} />
    </ProfileShell>
  );
}
