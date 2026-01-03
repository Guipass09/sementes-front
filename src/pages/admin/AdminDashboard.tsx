import { useEffect, useMemo, useState } from "react";
import { Users, Activity, Calendar, FileText, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { adminDashboardMetrics, isApiError } from "@/lib/laravel-api";
import { onAdminDataChanged } from "@/lib/admin-events";

type StatCard = {
  label: string;
  value: string;
  icon: any;
  color: string;
  path: string;
};

const quickActions = [
  {
    title: "Gerenciar Usuários",
    description: "Visualizar, bloquear ou liberar usuários e seus acessos",
    icon: Users,
    path: "/admin/usuarios",
    color: "from-brand-blue to-brand-purple",
  },
  {
    title: "Criar Atividade",
    description: "Adicionar nova atividade e enviar para usuários",
    icon: Activity,
    path: "/admin/atividades",
    color: "from-brand-green to-brand-green-dark",
  },
  {
    title: "Agendar Sessão",
    description: "Criar ou editar horários para qualquer usuário",
    icon: Calendar,
    path: "/admin/horarios",
    color: "from-brand-orange to-brand-orange-dark",
  },
  {
    title: "Novo Relatório",
    description: "Criar e enviar relatórios para usuários",
    icon: FileText,
    path: "/admin/relatorios",
    color: "from-brand-purple to-brand-blue",
  },
];

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<{ totalUsers: number; scheduledSessions: number }>({
    totalUsers: 0,
    scheduledSessions: 0,
  });

  const stats: StatCard[] = useMemo(
    () => [
      {
        label: "Total de Usuários",
        value: String(metrics.totalUsers),
        icon: Users,
        color: "from-brand-blue to-brand-purple",
        path: "/admin/usuarios",
      },
      {
        label: "Atividades Ativas",
        value: "—",
        icon: Activity,
        color: "from-brand-green to-brand-green-dark",
        path: "/admin/atividades",
      },
      {
        label: "Sessões Agendadas",
        value: String(metrics.scheduledSessions),
        icon: Calendar,
        color: "from-brand-orange to-brand-orange-dark",
        path: "/admin/horarios",
      },
      {
        label: "Relatórios",
        value: "—",
        icon: FileText,
        color: "from-brand-purple to-brand-blue",
        path: "/admin/relatorios",
      },
    ],
    [metrics.totalUsers, metrics.scheduledSessions]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await adminDashboardMetrics();
        if (!mounted) return;
        setMetrics({
          totalUsers: res.total_users,
          scheduledSessions: res.scheduled_sessions,
        });
      } catch (e) {
        // Silencioso: não queremos quebrar o dashboard por métricas.
        // Mantém 0/—. Se for erro de auth, a rota em si já seria protegida.
        if (isApiError(e) && (e.status === 401 || e.status === 403)) return;
      }
    };

    void load();

    // Atualiza automaticamente quando algo muda nas telas de admin.
    const off = onAdminDataChanged(() => void load());

    // Fallback: revalida periodicamente (casos de usuário criado via cadastro).
    const interval = window.setInterval(() => void load(), 15000);

    return () => {
      mounted = false;
      off();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-full">
      {/* Hero Section */}
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
              Painel <span className="text-brand-green">Administrativo</span>
            </h1>

            {/* Description */}
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Gerencie usuários, atividades, horários e relatórios do sistema Sementes da Fala
            </p>

            {/* Admin Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-medium animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <Shield size={16} />
              Acesso Administrativo
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Link
                  key={stat.label}
                  to={stat.path}
                  className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <TrendingUp size={20} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="py-12 lg:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-3">
              Ações Rápidas
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Acesse rapidamente as principais funcionalidades administrativas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  to={action.path}
                  className="group bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={28} className="text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-display font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;




