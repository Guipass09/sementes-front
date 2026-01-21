import { useEffect, useMemo, useState } from "react";
import { Activity, Calendar, FileText, Grid3X3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { professionalListUsers } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";

type StatCard = {
  label: string;
  value: string;
  icon: any;
  color: string;
  path: string;
};

export default function ProfessionalDashboard(): JSX.Element {
  const { toast } = useToast();
  const [assignedUsersCount, setAssignedUsersCount] = useState(0);

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
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Seu ambiente de trabalho. Você só verá usuários e conteúdos permitidos pelo admin.
          </p>
        </div>

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

