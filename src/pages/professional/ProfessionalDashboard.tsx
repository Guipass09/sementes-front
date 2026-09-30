import { useEffect, useMemo, useState } from "react";
import { Activity, Calendar, FileText, Grid3X3, Users, Shield, RefreshCw, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { professionalGetDashboardSummary, type ProfessionalDashboardSummary } from "@/lib/laravel-api";
import { useAuth } from "@/auth/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";

type StatCard = {
  label: string;
  value: number | null;
  detail?: string;
  icon: LucideIcon;
  color: string;
  path: string;
};

export default function ProfessionalDashboard(): JSX.Element {
  const auth = useAuth();
  const [summary, setSummary] = useState<ProfessionalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const clinicName = useMemo(() => String(auth.user?.clinic_name ?? "").trim(), [auth.user?.clinic_name]);
  const affiliatedClinicName = useMemo(() => String(auth.user?.affiliated_clinic_name ?? "").trim(), [auth.user?.affiliated_clinic_name]);
  const isClinicAccount = clinicName.length > 0;

  const firstName = useMemo(() => {
    const name = String(auth.user?.name ?? "").trim();
    if (!name) return "Profissional";
    return name.split(/\s+/)[0] || "Profissional";
  }, [auth.user?.name]);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    const load = async () => {
      const currentRequest = ++requestId;
      setLoading(true);
      try {
        const data = await professionalGetDashboardSummary();
        if (cancelled || currentRequest !== requestId) return;
        setSummary(data);
        setLoadError(false);
      } catch {
        if (cancelled || currentRequest !== requestId) return;
        setSummary(null);
        setLoadError(true);
      } finally {
        if (!cancelled && currentRequest === requestId) setLoading(false);
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, [auth.user?.id, reloadKey]);

  const stats: StatCard[] = useMemo(
    () => [
      {
        label: isClinicAccount ? "Pacientes da clínica" : "Pacientes vinculados",
        value: summary?.patients ?? null,
        icon: Users,
        color: "from-brand-blue to-brand-purple",
        path: "/profissional/pacientes",
      },
      {
        label: isClinicAccount ? "Atividades da equipe" : "Atividades próprias",
        value: summary?.activities_own ?? null,
        detail: summary ? `+${summary.activities_shared} compartilhadas` : undefined,
        icon: Activity,
        color: "from-brand-green to-brand-green-dark",
        path: "/profissional/atividades",
      },
      {
        label: "Sessões agendadas",
        value: summary?.scheduled_sessions ?? null,
        icon: Calendar,
        color: "from-brand-orange to-brand-orange-dark",
        path: "/profissional/horarios",
      },
    ],
    [isClinicAccount, summary]
  );

  const quickActions = [
    {
      title: "Atividades",
      description: isClinicAccount ? "Consultar atividades dos terapeutas" : "Criar e enviar atividades para seus pacientes",
      icon: Activity,
      path: "/profissional/atividades",
      color: "from-brand-green to-brand-green-dark",
    },
    {
      title: "Jogos",
      description: isClinicAccount ? "Consultar jogos dos terapeutas" : "Criar jogos e atribuir aos seus pacientes",
      icon: Grid3X3,
      path: "/profissional/jogos",
      color: "from-brand-brown to-brand-brown/70",
    },
    {
      title: "Horários",
      description: "Ver suas sessões agendadas",
      icon: Calendar,
      path: "/profissional/horarios",
      color: "from-brand-orange to-brand-orange-dark",
    },
    {
      title: "Relatórios",
      description: "Criar e gerenciar relatórios",
      icon: FileText,
      path: "/profissional/relatorios",
      color: "from-brand-purple to-brand-blue",
    },
  ];

  return (
    <div className="min-h-full">
      {/* Hero Section (mesmo estilo do Admin) */}
      <section className="relative bg-gradient-to-br from-brand-mint via-background to-brand-green/5 py-16 lg:py-24 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-orange/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-block mb-6 animate-float">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-green/20 rounded-2xl blur-xl scale-110" />
                <img
                  src={logoImage}
                  alt="Sementes da Fala"
                  className="relative w-24 h-24 lg:w-32 lg:h-32 object-contain rounded-2xl shadow-lg mx-auto"
                />
              </div>
            </div>

            {/* Title */}
            {isClinicAccount ? (
              <div className="mb-4 animate-fade-in space-y-3">
                <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-bold text-foreground">
                  Painel <span className="text-brand-green">Administrativo</span>
                </h1>
                <p className="text-lg lg:text-2xl text-muted-foreground font-medium">
                  <span className="text-foreground">Clínica:</span> {clinicName}
                </p>
              </div>
            ) : (
              <div className="mb-4 animate-fade-in space-y-3">
                <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-bold text-foreground">
                  Painel <span className="text-brand-green">Profissional</span>
                </h1>
                {affiliatedClinicName ? (
                  <p className="text-lg lg:text-2xl text-muted-foreground font-medium">
                    <span className="text-foreground">Clínica:</span> {affiliatedClinicName}
                  </p>
                ) : null}
              </div>
            )}

            {/* Description */}
            <p
              className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              {isClinicAccount
                ? "Gerencie pacientes, atividades, horários e relatórios da sua clínica no sistema Sementes da Fala"
                : affiliatedClinicName
                  ? `Gerencie seus pacientes, atividades, horários e relatórios como profissional vinculado à clínica ${affiliatedClinicName}`
                : "Gerencie seus pacientes, atividades, horários e relatórios do sistema Sementes da Fala"}
            </p>

            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-medium animate-fade-in"
              style={{ animationDelay: "0.2s" }}
              title={isClinicAccount ? "Acesso da Clínica" : "Acesso Profissional"}
            >
              <Shield size={16} />
              <span>
                {isClinicAccount
                  ? `Bem-vindo(a), ${clinicName}!`
                  : affiliatedClinicName
                    ? `Bem-vindo(a), ${firstName}! Clínica: ${affiliatedClinicName}`
                    : `Bem-vindo(a), ${firstName}!`}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 lg:py-12">

        {loadError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-destructive" role="alert">
            <span>Não foi possível carregar os indicadores.</span>
            <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="inline-flex items-center gap-2 font-semibold underline underline-offset-4">
              <RefreshCw size={15} /> Tentar novamente
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                to={s.path}
                className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                    {loading ? <Skeleton className="mt-2 h-7 w-14" /> : <div className="text-2xl font-bold text-foreground mt-1">{s.value ?? "—"}</div>}
                    {!loading && s.detail && <div className="mt-1 text-xs font-semibold text-brand-green-dark">{s.detail}</div>}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white`}>
                    <Icon size={18} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 sm:mt-8">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">Ações rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.title}
                  to={a.path}
                  className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white`}>
                    <Icon size={18} />
                  </div>
                  <div className="mt-3 font-semibold text-foreground">{a.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{a.description}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
