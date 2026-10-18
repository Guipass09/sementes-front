import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, ClipboardList, Gamepad2, History, LayoutDashboard, UsersRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import EditProfileModal from "@/components/EditProfileModal";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import ProfileShell, { type ProfileNavItem } from "@/components/ProfileShell";
import ProfessionalSubscriptionPreview from "@/components/ProfessionalSubscriptionPreview";
import SaleSchedulerListener from "@/components/SaleSchedulerListener";
import SubscriptionTimer, { useSubscriptionRemaining } from "@/components/SubscriptionTimer";
import { isApiError, me } from "@/lib/laravel-api";
import { resourceNavigation } from "@/lib/resource-navigation";

export default function ProfessionalLayout() {
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth.user;
  const clinicName = String(user?.clinic_name ?? "").trim();
  const isClinicAccount = clinicName.length > 0;
  const remaining = useSubscriptionRemaining(user?.professional_subscription);
  const needsSubscription = (user?.professional_subscription_status === "inactive" || (user?.professional_subscription_status === "active" && remaining === 0)) && !isClinicAccount && !user?.clinic_user_id;

  useEffect(() => {
    if (auth.loading) return;
    if (!user) {
      navigate("/entrar");
      return;
    }
    const role = String(user.role || "").toLowerCase().trim();
    const isProfessional = role === "professional" || role.includes("professional") || role.includes("profissional");
    if (!isProfessional) {
      const isAdmin = role === "admin" || role.includes("admin") || role.includes("administrador") || role.includes("administrator");
      navigate(isAdmin ? "/admin" : "/paciente");
    }
  }, [navigate, auth.loading, user]);

  useEffect(() => {
    if (!user || user.role !== "professional" || isClinicAccount || user.clinic_user_id
      || !["active", "inactive", "legacy"].includes(user.professional_subscription_status ?? "")) return;
    let cancelled = false;
    let pending = false;
    const syncSubscription = async () => {
      if (pending) return;
      pending = true;
      try {
        const freshUser = await me();
        if (!cancelled && freshUser.id === user.id) auth.setAuthUser(freshUser);
      } catch (error) {
        if (!cancelled && isApiError(error) && error.status === 401) void auth.refresh();
      } finally {
        pending = false;
      }
    };
    window.addEventListener("focus", syncSubscription);
    const timer = window.setInterval(syncSubscription, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncSubscription);
      window.clearInterval(timer);
    };
  }, [user?.id, user?.role, user?.clinic_user_id, user?.professional_subscription_status, isClinicAccount, auth.refresh, auth.setAuthUser]);

  if (!user || auth.loading) return <FullScreenLogoLoader label="Carregando..." />;

  const resources = resourceNavigation("/profissional", { clinic: isClinicAccount });
  const navItems: ProfileNavItem[] = [
    { path: "/profissional", label: "Dashboard", icon: LayoutDashboard },
    { path: "/profissional/pacientes", label: isClinicAccount ? "Terapeutas" : "Pacientes", icon: UsersRound },
    { path: "/profissional/atividades", label: "Atividades", icon: ClipboardList, children: resources.activities },
    { path: "/profissional/jogos", label: "Jogos", icon: Gamepad2, children: resources.games },
    { path: "/profissional/horarios", label: "Horários", icon: CalendarDays },
    { path: "/profissional/historico", label: "Histórico", icon: History },
    { path: "/profissional/relatorios", label: "Relatórios", icon: BarChart3 },
  ].map((item) => ({ ...item, active: item.path === "/profissional" ? location.pathname === item.path : location.pathname.startsWith(item.path) }));

  const subtitle = isClinicAccount
    ? (String(user.clinic_area ?? "").trim() || "Clínica")
    : (user.clinic_user_id ? String(user.professional_crfa ?? "").trim() || "Terapeuta" : "Fonoaudiologia");

  return (
    <ProfileShell
      homePath="/profissional"
      name={user.name}
      subtitle={subtitle}
      photoUrl={user.profile_photo_url}
      navItems={navItems}
      onProfile={() => setProfileOpen(true)}
      onLogout={() => void auth.logout().finally(() => navigate("/"))}
    >
      {!needsSubscription && <SaleSchedulerListener />}
      {!isClinicAccount && !user.clinic_user_id && user.professional_subscription && (
        <div className="border-b border-border px-4 py-3 text-right text-sm text-primary">
          <SubscriptionTimer subscription={user.professional_subscription} />
        </div>
      )}
      {needsSubscription ? (
        <>
          <p className="px-4 pt-4 text-center text-sm text-muted-foreground">Seus pacientes, atividades e documentos continuam preservados. Reative sua assinatura para retomar o acesso.</p>
          <ProfessionalSubscriptionPreview expiresOn={user.professional_subscription_expires_on} onRefresh={() => void auth.refresh()} />
        </>
      ) : <Outlet />}
      <EditProfileModal open={profileOpen} onOpenChange={setProfileOpen} user={user} onSaved={auth.setAuthUser} />
    </ProfileShell>
  );
}
