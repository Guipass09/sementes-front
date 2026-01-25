import { useEffect, useMemo, useState } from "react";
import { Activity, Calendar, FileText, Grid3X3, Users, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { professionalListUsers } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";

type StatCard = {
  label: string;
  value: string;
  icon: any;
  color: string;
  path: string;
};

export default function ProfessionalDashboard(): JSX.Element {
  const { toast } = useToast();
  const auth = useAuth();
  const [assignedUsersCount, setAssignedUsersCount] = useState(0);

  const firstName = useMemo(() => {
    const name = String(auth.user?.name ?? "").trim();
    if (!name) return "Profissional";
    return name.split(/\s+/)[0] || "Profissional";
  }, [auth.user?.name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await professionalListUsers();
        if (cancelled) return;
        setAssignedUsersCount((res.data ?? []).length);
      } catch {
        if (cancelled) return;
        toast({
          title: "Não foi possível carregar seus dados",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const stats: StatCard[] = useMemo(
    () => [
      {
        label: "Usuários vinculados",
        value: String(assignedUsersCount),
        icon: Users,
        color: "from-brand-blue to-brand-purple",
        path: "/profissional/relatorios",
      },
      {
        label: "Atividades",
        value: "—",
        icon: Activity,
        color: "from-brand-green to-brand-green-dark",
        path: "/profissional/atividades",
      },
      {
        label: "Sessões",
        value: "—",
        icon: Calendar,
        color: "from-brand-orange to-brand-orange-dark",
        path: "/profissional/horarios",
      },
    ],
    [assignedUsersCount]
  );

  const quickActions = [
    {
      title: "Atividades",
      description: "Criar e enviar atividades para seus usuários",
      icon: Activity,
      path: "/profissional/atividades",
      color: "from-brand-green to-brand-green-dark",
    },
    {
      title: "Jogos",
      description: "Criar jogos e atribuir aos seus usuários",
      icon: Grid3X3,
      path: "/profissional/jogos",
      color: "from-brand-brown to-brand-brown/70",
    },
    {
      title: "Horários",
      description: "Ver sessões agendadas pelo admin",
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
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-bold text-foreground mb-4 animate-fade-in">
              Painel <span className="text-brand-green">Profissional</span>
            </h1>

            {/* Description */}
            <p
              className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              Gerencie seus pacientes, atividades, horários e relatórios do sistema Sementes da Fala
            </p>

            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-medium animate-fade-in"
              style={{ animationDelay: "0.2s" }}
              title="Acesso Profissional"
            >
              <Shield size={16} />
              <span>Bem-vindo(a), {firstName}!</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 lg:py-12">

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
                    <div className="text-2xl font-bold text-foreground mt-1">{s.value}</div>
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

