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
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Welcome Section - Landing Page Style */}
        <section className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-green-50 via-amber-50 to-green-100 dark:from-green-950/20 dark:via-amber-950/20 dark:to-green-900/20 p-8 lg:p-12">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-green-200/30 dark:bg-green-800/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-200/30 dark:bg-amber-800/20 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            {/* Logo */}
            <div className="mb-6">
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden shadow-lg border-2 border-white/50 dark:border-gray-800/50 bg-white dark:bg-gray-900">
                <img src={logoImage} alt="Sementes da Fala" className="w-full h-full object-cover" />
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-display font-bold mb-3">
              <span className="text-stone-700 dark:text-stone-300">Painel</span>{" "}
              <span className="text-brand-green dark:text-green-400">Profissional</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-stone-600 dark:text-stone-400 text-base lg:text-lg max-w-2xl mb-6">
              Gerencie seus pacientes, atividades, horários e relatórios do sistema Sementes da Fala
            </p>
            
            {/* Welcome Message */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-stone-700 dark:text-stone-300">
              <Shield size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium">Bem-vindo(a), {firstName}!</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Ações rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

