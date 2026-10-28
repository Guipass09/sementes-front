import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck, BarChart3, CalendarDays, ClipboardList, Gamepad2, History, IdCard, LayoutDashboard, UserRound, UsersRound, Wallet } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import ProfileShell, { type ProfileNavItem } from "@/components/ProfileShell";
import { useSubscriptionExpired } from "@/components/SubscriptionTimer";
import { isApiError, me } from "@/lib/laravel-api";
import { resourceNavigation } from "@/lib/resource-navigation";
import { canUsePersonalFinance } from "@/features/finance/finance";
import { hasIndividualSubscription } from "@/lib/subscription-details";

export default function ProfessionalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth.user;
  const clinicName = String(user?.clinic_name ?? "").trim();
  const isClinicAccount = clinicName.length > 0;
  const expired = useSubscriptionExpired(user?.professional_subscription);
  const needsSubscription = hasIndividualSubscription(user) && (user?.professional_subscription_status === "inactive" || expired);
  const onSubscriptionPage = location.pathname === "/profissional/assinatura";
  const onProfilePage = location.pathname === "/profissional/perfil";

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
  const allNavItems: ProfileNavItem[] = [
    { path: "/profissional", label: "Dashboard", icon: LayoutDashboard },
    { path: "/profissional/pacientes", label: isClinicAccount ? "Terapeutas" : "Pacientes", icon: UsersRound },
    { path: "/profissional/atividades", label: "Atividades", icon: ClipboardList, children: resources.activities },
    { path: "/profissional/jogos", label: "Jogos", icon: Gamepad2, children: resources.games },
    { path: "/profissional/horarios", label: "Horários", icon: CalendarDays },
    { path: "/profissional/historico", label: "Histórico", icon: History },
    ...(canUsePersonalFinance(user) ? [{ path: "/profissional/financeiro", label: "Financeiro", icon: Wallet }] : []),
    { path: "/profissional/relatorios", label: "Relatórios", icon: BarChart3 },
    ...(hasIndividualSubscription(user) ? [{ path: "/profissional/assinatura", label: "Assinatura", icon: BadgeCheck }] : []),
    { path: "/profissional/perfil", label: "Perfil", icon: UserRound },
  ].map((item) => ({ ...item, active: item.path === "/profissional" ? location.pathname === item.path : location.pathname.startsWith(item.path) }));
  const navItems = needsSubscription ? allNavItems.filter((item) => ["/profissional/assinatura", "/profissional/perfil"].includes(item.path)) : allNavItems;

  const subtitle = isClinicAccount
    ? (String(user.clinic_area ?? "").trim() || "Clínica")
    : (user.clinic_user_id ? String(user.professional_crfa ?? "").trim() || "Terapeuta" : "Fonoaudiologia");

  return (
    <ProfileShell
      homePath="/profissional"
      name={user.name}
      subtitle={subtitle}
      subtitleIcon={IdCard}
      photoUrl={user.profile_photo_url}
      navItems={navItems}
      onProfile={() => navigate("/profissional/perfil")}
      onLogout={() => void auth.logout().finally(() => navigate("/"))}
    >
      {needsSubscription && !onSubscriptionPage && !onProfilePage ? (
        <Navigate to="/profissional/assinatura" replace />
      ) : <Outlet />}
    </ProfileShell>
  );
}
