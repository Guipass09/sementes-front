import { useEffect, useMemo, useState } from "react";
import { Users, Activity, Calendar, FileText, TrendingUp, Shield, Eye, EyeOff, DollarSign, Package } from "lucide-react";
import { Link } from "react-router-dom";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { adminDashboardMetrics, adminListAllCustomPackages, isApiError } from "@/lib/laravel-api";
import { onAdminDataChanged } from "@/lib/admin-events";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type StatCard = {
  label: string;
  value: string;
  icon: any;
  color: string;
  path: string;
};

type SalePackage = {
  id: string;
  title: string;
  sessions: number;
  pricePerSession: number;
  totalPrice: number;
  kind: "fixed" | "custom";
  userName?: string;
};

const fixedPackages: SalePackage[] = [
  { id: "fixed-3", title: "3 Sessões", sessions: 3, pricePerSession: 93.33, totalPrice: 280, kind: "fixed" },
  { id: "fixed-6", title: "6 Sessões", sessions: 6, pricePerSession: 80, totalPrice: 480, kind: "fixed" },
  { id: "fixed-9", title: "9 Sessões", sessions: 9, pricePerSession: 62.22, totalPrice: 560, kind: "fixed" },
  { id: "fixed-15", title: "15 Sessões", sessions: 15, pricePerSession: 58.67, totalPrice: 880, kind: "fixed" },
  { id: "fixed-20", title: "20 Sessões", sessions: 20, pricePerSession: 55, totalPrice: 1100, kind: "fixed" },
  { id: "fixed-35", title: "35 Sessões", sessions: 35, pricePerSession: 50, totalPrice: 1750, kind: "fixed" },
  { id: "fixed-45", title: "45 Sessões", sessions: 45, pricePerSession: 47, totalPrice: 2115, kind: "fixed" },
];

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getMonthKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
  const [monthKey, setMonthKey] = useState(getMonthKey);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesVisible, setSalesVisible] = useState(true);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [saleConfirmOpen, setSaleConfirmOpen] = useState(false);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<SalePackage | null>(null);
  const [customPackages, setCustomPackages] = useState<SalePackage[]>([]);

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
    ],
    [metrics.totalUsers, metrics.scheduledSessions]
  );

  const allPackages = useMemo(() => [...fixedPackages, ...customPackages], [customPackages]);

  useEffect(() => {
    const storedVisible = window.localStorage.getItem("admin_sales_visible");
    if (storedVisible === "0") setSalesVisible(false);
  }, []);

  useEffect(() => {
    const key = getMonthKey();
    if (key !== monthKey) setMonthKey(key);
    const interval = window.setInterval(() => {
      const k = getMonthKey();
      if (k !== monthKey) setMonthKey(k);
    }, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [monthKey]);

  useEffect(() => {
    const key = `admin_sales_total:${monthKey}`;
    const stored = window.localStorage.getItem(key);
    const value = stored ? Number(stored) : 0;
    setSalesTotal(Number.isFinite(value) ? value : 0);
  }, [monthKey]);

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

  useEffect(() => {
    let mounted = true;
    const loadPackages = async () => {
      try {
        const rows = await adminListAllCustomPackages();
        if (!mounted) return;
        const mapped = rows.map((pkg) => ({
          id: `custom-${pkg.id}`,
          title: pkg.title,
          sessions: Number(pkg.sessions_count),
          pricePerSession: Number(pkg.price_per_session),
          totalPrice: Number(pkg.total_price),
          kind: "custom" as const,
          userName: pkg.user?.name,
        }));
        setCustomPackages(mapped);
      } catch {
        if (mounted) setCustomPackages([]);
      }
    };
    void loadPackages();
    const off = onAdminDataChanged(() => void loadPackages());
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const handleToggleSalesVisibility = () => {
    const next = !salesVisible;
    setSalesVisible(next);
    window.localStorage.setItem("admin_sales_visible", next ? "1" : "0");
  };

  const handleConfirmSale = (pkg: SalePackage) => {
    setSelectedPackage(pkg);
    setSaleConfirmOpen(true);
  };

  const applySale = () => {
    if (!selectedPackage) return;
    const key = `admin_sales_total:${monthKey}`;
    const nextTotal = Math.max(0, salesTotal + selectedPackage.totalPrice);
    setSalesTotal(nextTotal);
    window.localStorage.setItem(key, String(nextTotal));
    setSaleConfirmOpen(false);
    setCelebrateOpen(true);
  };

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
            <style>{`
              .admin-access-badge {
                background-color: hsl(var(--brand-blue));
                color: white;
              }
            `}</style>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full admin-access-badge text-sm font-medium animate-fade-in" style={{ animationDelay: "0.2s" }}>
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

            {/* Vendas do mês */}
            <button
              type="button"
              onClick={() => setPackagesOpen(true)}
              className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in text-left"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <DollarSign size={24} className="text-white" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSalesVisibility();
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={salesVisible ? "Ocultar vendas" : "Mostrar vendas"}
                >
                  {salesVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-1">
                {salesVisible ? formatMoney(salesTotal) : "••••••"}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Package size={16} />
                Vendas do mês
              </p>
            </button>
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

      {/* Modal: pacotes vendidos */}
      <Dialog open={packagesOpen} onOpenChange={setPackagesOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pacotes disponíveis para venda</DialogTitle>
            <DialogDescription>
              Clique em um pacote para confirmar a venda e somar ao total do mês.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="text-sm text-muted-foreground">
              Total do mês: <span className="font-semibold text-foreground">{formatMoney(salesTotal)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const key = `admin_sales_total:${monthKey}`;
                setSalesTotal(0);
                window.localStorage.setItem(key, "0");
              }}
            >
              Limpar total
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Pacotes fixos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fixedPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handleConfirmSale(pkg)}
                    className="text-left bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{pkg.sessions}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{pkg.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(pkg.pricePerSession)} por sessão
                        </div>
                        <div className="text-sm font-semibold text-foreground">{formatMoney(pkg.totalPrice)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Pacotes personalizados</h4>
              {customPackages.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum pacote personalizado cadastrado.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handleConfirmSale(pkg)}
                      className="text-left bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">{pkg.sessions}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{pkg.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(pkg.pricePerSession)} por sessão
                          </div>
                          <div className="text-sm font-semibold text-foreground">{formatMoney(pkg.totalPrice)}</div>
                          {pkg.userName ? (
                            <div className="text-xs text-muted-foreground truncate">Paciente: {pkg.userName}</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar venda */}
      <Dialog open={saleConfirmOpen} onOpenChange={setSaleConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar venda</DialogTitle>
            <DialogDescription>
              Você vendeu o pacote <strong>{selectedPackage?.title}</strong>?
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="text-sm text-muted-foreground">
              Valor: <strong className="text-foreground">{formatMoney(selectedPackage.totalPrice)}</strong>
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setSaleConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => applySale()}>Confirmar venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: celebração */}
      <Dialog open={celebrateOpen} onOpenChange={setCelebrateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parabéns pela venda! 🎉</DialogTitle>
            <DialogDescription>
              O valor foi somado ao total do mês.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-4 py-6 text-4xl">
            <span className="animate-bounce">🎆</span>
            <span className="animate-pulse">🎉</span>
            <span className="animate-bounce">✨</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCelebrateOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;




