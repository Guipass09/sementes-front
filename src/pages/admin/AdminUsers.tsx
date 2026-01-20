import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  User,
  Lock,
  Unlock,
  Eye,
  Activity,
  Calendar,
  FileText,
  Shield,
  ShieldOff,
  Trash2,
  CheckCircle2,
  Package,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { computeTodaySessionAlert, getTodayYMD } from "@/lib/session-alert";
import {
  adminClearPurchaseIntent,
  adminCreateCustomPackage,
  adminDeleteUser,
  adminDeleteAllAppointmentsForUser,
  adminDeleteCustomPackage,
  adminGetUserProgressSummary,
  adminListCustomPackages,
  adminListUsers,
  adminUpdateAppointmentStatus,
  adminUpdateCustomPackage,
  adminUpdateUser,
  isApiError,
} from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { emitAdminDataChanged, onAdminDataChanged } from "@/lib/admin-events";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { ReportFormModal } from "@/features/reports/ReportFormModal";
import type { CustomPackageRow, ReportType } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";

interface UserAccess {
  atividades: boolean;
  horarios: boolean;
  relatorios: boolean;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  child_age?: number | null;
  blocked: boolean;
  access: UserAccess;
  profile_description?: string | null;
  profile_photo_url?: string | null;
  purchase_intent_message?: string | null;
  purchase_intent_at?: string | null;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatMoney = (value: number | string) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [clearPurchaseOpen, setClearPurchaseOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserData | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [progressSummary, setProgressSummary] = useState<null | {
    activities: { total: number; disponivel: number; em_andamento: number; concluida: number };
    memory_games: { total: number; disponivel: number; concluido: number };
    auditory_games: { total: number; disponivel: number; concluido: number };
    hangman_games: { total: number; disponivel: number; concluido: number };
  }>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [customPackages, setCustomPackages] = useState<CustomPackageRow[]>([]);
  const [customPackagesLoading, setCustomPackagesLoading] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CustomPackageRow | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);
  const [deletePackageOpen, setDeletePackageOpen] = useState(false);
  const [deletePackageTarget, setDeletePackageTarget] = useState<CustomPackageRow | null>(null);
  const [packageForm, setPackageForm] = useState({
    sessions_count: "",
    title: "",
    price_per_session: "",
    total_price: "",
    payment_url: "",
  });
  const [deleteAppointmentsOpen, setDeleteAppointmentsOpen] = useState(false);
  const [deletingAppointments, setDeletingAppointments] = useState(false);
  const [selectedUserAppointments, setSelectedUserAppointments] = useState<
    Array<{
      id: number;
      date: string;
      time: string;
      professional: string;
      totalSessions: number;
      status: "agendada" | "realizada" | "cancelada";
    }>
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const reloadSelectedUserAppointments = (userId: number) => {
    return api
      .adminListAppointments()
      .then((rows) => {
        const mapped = rows
          .filter((r) => (r.user?.id || r.user_id) === userId)
          .map((r) => ({
            id: r.id,
            date: (() => {
              const raw = r.session_date || "";
              if (raw.includes("T")) return raw.slice(0, 10);
              return raw;
            })(),
            time: (r.session_time || "").slice(0, 5),
            professional: r.professional_name,
            totalSessions: Number(r.total_sessions) || 0,
            status:
              r.status === "completed"
                ? ("realizada" as const)
                : r.status === "canceled"
                  ? ("cancelada" as const)
                  : ("agendada" as const),
          }));
        setSelectedUserAppointments(mapped);
      })
      .catch(() => setSelectedUserAppointments([]));
  };

  const reloadCustomPackages = async (userId: number) => {
    setCustomPackagesLoading(true);
    try {
      const rows = await adminListCustomPackages(userId);
      setCustomPackages(rows);
    } catch {
      setCustomPackages([]);
    } finally {
      setCustomPackagesLoading(false);
    }
  };

  const resetPackageForm = (pkg?: CustomPackageRow | null) => {
    setPackageForm({
      sessions_count: pkg ? String(pkg.sessions_count) : "",
      title: pkg?.title ?? "",
      price_per_session: pkg ? String(pkg.price_per_session) : "",
      total_price: pkg ? String(pkg.total_price) : "",
      payment_url: pkg?.payment_url ?? "",
    });
  };

  const openCreatePackage = () => {
    setEditingPackage(null);
    resetPackageForm();
    setPackageDialogOpen(true);
  };

  const openEditPackage = (pkg: CustomPackageRow) => {
    setEditingPackage(pkg);
    resetPackageForm(pkg);
    setPackageDialogOpen(true);
  };

  const handleSavePackage = async () => {
    if (!selectedUser) return;
    const sessionsCount = Number(packageForm.sessions_count);
    const pricePerSession = Number(packageForm.price_per_session);
    const totalPrice = Number(packageForm.total_price);
    if (!Number.isFinite(sessionsCount) || sessionsCount <= 0) {
      toast({ title: "Sessões inválidas", description: "Informe a quantidade de sessões.", variant: "destructive" });
      return;
    }
    if (!packageForm.title.trim()) {
      toast({ title: "Título obrigatório", description: "Informe o título do pacote.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(pricePerSession) || pricePerSession < 0) {
      toast({ title: "Valor inválido", description: "Informe o valor por sessão.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      toast({ title: "Valor inválido", description: "Informe o valor total do pacote.", variant: "destructive" });
      return;
    }
    if (!packageForm.payment_url.trim()) {
      toast({ title: "Link obrigatório", description: "Informe o link do Mercado Pago.", variant: "destructive" });
      return;
    }

    setSavingPackage(true);
    try {
      if (editingPackage) {
        await adminUpdateCustomPackage(editingPackage.id, {
          sessions_count: sessionsCount,
          title: packageForm.title.trim(),
          price_per_session: pricePerSession,
          total_price: totalPrice,
          payment_url: packageForm.payment_url.trim(),
        });
      } else {
        await adminCreateCustomPackage(selectedUser.id, {
          sessions_count: sessionsCount,
          title: packageForm.title.trim(),
          price_per_session: pricePerSession,
          total_price: totalPrice,
          payment_url: packageForm.payment_url.trim(),
        });
      }
      await reloadCustomPackages(selectedUser.id);
      setPackageDialogOpen(false);
      setEditingPackage(null);
    } catch (e) {
      const msg = isApiError(e) ? e.message : "Não foi possível salvar o pacote.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSavingPackage(false);
    }
  };

  const confirmDeletePackage = async () => {
    if (!deletePackageTarget || !selectedUser) return;
    try {
      await adminDeleteCustomPackage(deletePackageTarget.id);
      await reloadCustomPackages(selectedUser.id);
      setDeletePackageOpen(false);
      setDeletePackageTarget(null);
      toast({ title: "Pacote removido", description: "O pacote foi excluído permanentemente." });
    } catch (e) {
      const msg = isApiError(e) ? e.message : "Não foi possível excluir o pacote.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const reloadUsers = async () => {
    setIsLoading(true);
    const list = await adminListUsers();
    // Mostra apenas usuários comuns no menu (admin é fixo e não editável aqui)
    const onlyUsers = list
      .filter((u) => u.role === "user")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        child_age: u.child_age ?? null,
        blocked: u.blocked,
        access: u.access,
        profile_description: u.profile_description ?? null,
        profile_photo_url: u.profile_photo_url ?? null,
        purchase_intent_message: u.purchase_intent_message ?? null,
        purchase_intent_at: u.purchase_intent_at ?? null,
      }));
    setUsers(onlyUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const list = await adminListUsers();
        const onlyUsers = list
          .filter((u) => u.role === "user")
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone ?? null,
            child_age: u.child_age ?? null,
            blocked: u.blocked,
            access: u.access,
            profile_description: u.profile_description ?? null,
            profile_photo_url: u.profile_photo_url ?? null,
            purchase_intent_message: u.purchase_intent_message ?? null,
            purchase_intent_at: u.purchase_intent_at ?? null,
          }));
        if (mounted) setUsers(onlyUsers);
      } catch (e) {
        if (mounted) {
          toast({
            title: "Erro ao carregar usuários",
            description: "Não foi possível buscar a lista de usuários.",
            variant: "destructive",
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const handleDeleteUser = async (user: UserData) => {
    setDeleteUserTarget(user);
    setDeleteUserOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await adminDeleteUser(deleteUserTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      if (selectedUser?.id === deleteUserTarget.id) {
        setSelectedUser(null);
        setIsUserDialogOpen(false);
      }
      emitAdminDataChanged();
      toast({ title: "Usuário excluído", description: "O usuário foi removido permanentemente." });
    } catch (e) {
      const msg =
        isApiError(e) && e.status === 403
          ? "Ação não permitida."
          : "Não foi possível excluir este usuário.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      // Revalida a lista para evitar estado divergente
      try {
        await reloadUsers();
      } catch {
        // ignora
      }
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleSetBlocked = (userId: number, blocked: boolean) => {
    const current = users.find((u) => u.id === userId);
    if (!current) return;
    if (current.blocked === blocked) return;

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, blocked } : u)));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, blocked });

    void adminUpdateUser(userId, { blocked })
      .then((updated) => {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, blocked: updated.blocked, access: updated.access } : u))
        );
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) => (prev ? { ...prev, blocked: updated.blocked, access: updated.access } : prev));
        }
        emitAdminDataChanged();
      })
      .catch((e) => {
        setUsers((prev) => prev.map((u) => (u.id === userId ? current : u)));
        if (selectedUser?.id === userId) setSelectedUser(current);
        const msg =
          isApiError(e) && e.status === 403
            ? "Ação não permitida."
            : "Não foi possível atualizar este usuário.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      });
  };

  const handleSetAccess = (userId: number, access: UserAccess) => {
    const current = users.find((u) => u.id === userId);
    if (!current) return;

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, access } : u)));
    if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, access });

    void adminUpdateUser(userId, { access })
      .then((updated) => {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, blocked: updated.blocked, access: updated.access } : u))
        );
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) => (prev ? { ...prev, blocked: updated.blocked, access: updated.access } : prev));
        }
        emitAdminDataChanged();
      })
      .catch(() => {
        setUsers((prev) => prev.map((u) => (u.id === userId ? current : u)));
        if (selectedUser?.id === userId) setSelectedUser(current);
        toast({ title: "Erro", description: "Não foi possível atualizar o acesso.", variant: "destructive" });
      });
  };

  const openUserProfile = (user: UserData) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
    setProgressSummary(null);
    setProgressLoading(true);
    setSelectedUserAppointments([]);
    setCustomPackages([]);
    setCustomPackagesLoading(true);
    void adminGetUserProgressSummary(user.id)
      .then((res) => setProgressSummary(res))
      .catch(() => setProgressSummary(null))
      .finally(() => setProgressLoading(false));

    // Busca horários/sessões do usuário para exibir alerta (bolinha) no perfil.
    void reloadSelectedUserAppointments(user.id);
    void reloadCustomPackages(user.id);
  };

  const selectedUserTodayAlert = useMemo(() => {
    const todayYMD = getTodayYMD(nowMs);
    return computeTodaySessionAlert({
      sessions: selectedUserAppointments.filter((a) => a.status === "agendada"),
      todayYMD,
      nowMs,
    });
  }, [nowMs, selectedUserAppointments]);

  const selectedUserSessionsSummary = useMemo(() => {
    const maxContracted = selectedUserAppointments.reduce((acc, s) => Math.max(acc, s.totalSessions || 0), 0);
    const totalContratadas = Math.max(maxContracted, selectedUserAppointments.length);
    const utilizadas = selectedUserAppointments.filter((s) => s.status === "realizada").length;
    const restantes = Math.max(0, totalContratadas - utilizadas);
    return { totalContratadas, utilizadas, restantes };
  }, [selectedUserAppointments]);

  const selectedAgenda = useMemo(
    () => selectedUserAppointments.filter((a) => a.status === "agendada").slice().sort((a, b) => (`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))),
    [selectedUserAppointments]
  );
  const selectedHistory = useMemo(
    () => selectedUserAppointments.filter((a) => a.status !== "agendada").slice().sort((a, b) => (`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))),
    [selectedUserAppointments]
  );

  const handleMarkSelectedAppointmentCompleted = async (appointmentId: number) => {
    if (!selectedUser) return;
    try {
      await adminUpdateAppointmentStatus(appointmentId, "completed");
      await reloadSelectedUserAppointments(selectedUser.id);
      emitAdminDataChanged();
      toast({ title: "Sessão marcada como realizada", description: "A sessão foi movida para o histórico." });
    } catch (e) {
      const msg =
        isApiError(e) && e.status === 403
          ? "Ação não permitida."
          : "Não foi possível marcar como realizada.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  // Se admin marcar como "Realizada" em outra tela, esse evento atualiza a bolinha do perfil aberto.
  useEffect(() => {
    if (!isUserDialogOpen || !selectedUser) return;
    const unsubscribe = onAdminDataChanged(() => {
      void reloadSelectedUserAppointments(selectedUser.id);
    });
    return unsubscribe;
  }, [isUserDialogOpen, selectedUser]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
            Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground">
            Visualize, bloqueie ou libere usuários e seus acessos específicos. Usuários são criados via cadastro público e aparecem automaticamente aqui.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Carregando usuários...</p>
            </div>
          )}
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${0.05 * index}s` }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold">
                    {user.profile_photo_url ? (
                      <img src={normalizeMediaUrl(user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{user.name}</h3>
                      {user.blocked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                          Bloqueado
                        </span>
                      )}
                      {!!user.purchase_intent_message && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                          Tentando comprar sessões
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    {user.phone && (
                      <p className="text-xs text-muted-foreground truncate">
                        Celular: {user.phone}
                      </p>
                    )}
                    {user.child_age !== null && user.child_age !== undefined && (
                      <p className="text-xs text-muted-foreground truncate">
                        Idade da criança: {user.child_age} ano(s)
                      </p>
                    )}
                  </div>
                </div>

                {/* Access Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs">
                    <Activity
                      size={14}
                      className={user.access.atividades ? "text-brand-green" : "text-muted-foreground"}
                    />
                    <span className={user.access.atividades ? "text-brand-green" : "text-muted-foreground"}>
                      Atividades
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Calendar
                      size={14}
                      className={user.access.horarios ? "text-brand-green" : "text-muted-foreground"}
                    />
                    <span className={user.access.horarios ? "text-brand-green" : "text-muted-foreground"}>
                      Horários
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <FileText
                      size={14}
                      className={user.access.relatorios ? "text-brand-green" : "text-muted-foreground"}
                    />
                    <span className={user.access.relatorios ? "text-brand-green" : "text-muted-foreground"}>
                      Relatórios
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUserProfile(user)}
                  >
                    <Eye size={16} className="mr-2" />
                    Ver Perfil
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDeleteUser(user)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Excluir
                  </Button>
                  <Button
                    variant={user.blocked ? "default" : "destructive"}
                    size="sm"
                    onClick={() => handleSetBlocked(user.id, !user.blocked)}
                  >
                    {user.blocked ? (
                      <>
                        <Unlock size={16} className="mr-2" />
                        Liberar
                      </>
                    ) : (
                      <>
                        <Lock size={16} className="mr-2" />
                        Bloquear
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </div>
        )}

        {/* User Profile Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User size={24} />
                Perfil do Usuário
              </DialogTitle>
              <DialogDescription>
                Gerencie bloqueios e acessos específicos para este usuário
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6 mt-4">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xl">
                    {selectedUser.profile_photo_url ? (
                      <img src={normalizeMediaUrl(selectedUser.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{selectedUser.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    {selectedUser.phone && (
                      <p className="text-sm text-muted-foreground">
                        Celular: {selectedUser.phone}
                      </p>
                    )}
                    {selectedUser.child_age !== null && selectedUser.child_age !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Idade da criança: {selectedUser.child_age} ano(s)
                      </p>
                    )}
                  </div>
                </div>

                {/* Resumo de Sessões (contratadas / utilizadas / restantes) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Total contratadas</p>
                    <p className="text-2xl font-bold text-foreground">{selectedUserSessionsSummary.totalContratadas}</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Utilizadas</p>
                    <p className="text-2xl font-bold text-foreground">{selectedUserSessionsSummary.utilizadas}</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Restantes</p>
                    <p className="text-2xl font-bold text-foreground">{selectedUserSessionsSummary.restantes}</p>
                  </div>
                </div>

                {/* Profile Description */}
                <div className="p-4 border border-border rounded-lg">
                  <div className="font-semibold text-foreground mb-1">Descrição</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedUser.profile_description?.trim()
                      ? selectedUser.profile_description
                      : "Sem descrição cadastrada."}
                  </div>
                </div>

                {/* Block User */}
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <Label htmlFor="block-user" className="text-base font-semibold">
                      Bloquear Usuário
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quando bloqueado, o usuário não pode acessar o sistema
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedUser.blocked ? (
                      <ShieldOff className="text-destructive" size={20} />
                    ) : (
                      <Shield className="text-brand-green" size={20} />
                    )}
                    <Switch
                      id="block-user"
                      checked={selectedUser.blocked}
                      onCheckedChange={(checked) => handleSetBlocked(selectedUser.id, checked)}
                    />
                  </div>
                </div>

                {/* Purchase intent message (Catálogo de pacotes) */}
                {selectedUser.purchase_intent_message && (
                  <div className="p-4 border border-brand-orange/20 rounded-lg bg-brand-orange/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground mb-1">Solicitação de compra</div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {selectedUser.purchase_intent_message}
                        </div>
                        {selectedUser.purchase_intent_at && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Registrado em: {new Date(selectedUser.purchase_intent_at).toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setClearPurchaseOpen(true);
                        }}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                )}

                <BrandedConfirmDialog
                  open={clearPurchaseOpen}
                  onOpenChange={setClearPurchaseOpen}
                  title="Limpar solicitação de compra?"
                  description="Isso vai remover a mensagem do usuário (você pode receber uma nova depois)."
                  confirmLabel="Limpar"
                  cancelLabel="Cancelar"
                  variant="danger"
                  onConfirm={() => {
                    if (!selectedUser) return;
                    void adminClearPurchaseIntent(selectedUser.id)
                      .then(async () => {
                        updateSelectedUser({ purchase_intent_message: null, purchase_intent_at: null });
                        await reloadUsers();
                        emitAdminDataChanged();
                        toast({ title: "Mensagem limpa", description: "A solicitação de compra foi removida." });
                      })
                      .catch(() => {
                        toast({ title: "Erro", description: "Não foi possível limpar a mensagem.", variant: "destructive" });
                      });
                  }}
                />

                {/* Pacotes personalizados */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Package size={18} />
                        Pacotes personalizados
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Estes pacotes aparecem no catálogo do paciente selecionado.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={openCreatePackage}>
                      <Plus size={16} className="mr-2" />
                      Criar pacote
                    </Button>
                  </div>

                  {customPackagesLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando pacotes…</div>
                  ) : customPackages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum pacote personalizado para este paciente.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customPackages.map((pkg) => (
                        <div key={pkg.id} className="rounded-xl border border-border p-4 bg-card">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-lg font-bold text-primary">{pkg.sessions_count}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{pkg.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatMoney(pkg.price_per_session)} por sessão
                              </div>
                              <div className="text-sm font-semibold text-foreground">{formatMoney(pkg.total_price)}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditPackage(pkg)}>
                              <Pencil size={14} className="mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeletePackageTarget(pkg);
                                setDeletePackageOpen(true);
                              }}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <BrandedConfirmDialog
                  open={deletePackageOpen}
                  onOpenChange={(open) => {
                    setDeletePackageOpen(open);
                    if (!open) setDeletePackageTarget(null);
                  }}
                  title="Excluir pacote?"
                  description="Isso remove o pacote personalizado permanentemente para este paciente."
                  confirmLabel="Excluir"
                  cancelLabel="Cancelar"
                  variant="danger"
                  onConfirm={() => void confirmDeletePackage()}
                />

                {/* Access Controls */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground">Controle de Acessos</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permissões padrão aplicadas no registro: Início, Atividades, Jogos, Relatórios e Sessões habilitados.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Atividades Access */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Activity size={20} className="text-brand-green" />
                        <div>
                          <Label htmlFor="access-atividades" className="text-base font-medium">
                            Acesso a Atividades
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Permite visualizar e realizar atividades
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="access-atividades"
                        checked={selectedUser.access.atividades}
                        onCheckedChange={(checked) =>
                          handleSetAccess(selectedUser.id, { ...selectedUser.access, atividades: checked })
                        }
                        disabled={selectedUser.blocked}
                      />
                    </div>

                    {/* Horários Access */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-brand-orange" />
                        <div>
                          <Label htmlFor="access-horarios" className="text-base font-medium">
                            Acesso a Horários
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Permite visualizar sessões agendadas
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="access-horarios"
                        checked={selectedUser.access.horarios}
                        onCheckedChange={(checked) =>
                          handleSetAccess(selectedUser.id, { ...selectedUser.access, horarios: checked })
                        }
                        disabled={selectedUser.blocked}
                      />
                    </div>

                    {/* Relatórios Access */}
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-brand-purple" />
                        <div>
                          <Label htmlFor="access-relatorios" className="text-base font-medium">
                            Acesso a Relatórios
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Permite visualizar relatórios
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="access-relatorios"
                        checked={selectedUser.access.relatorios}
                        onCheckedChange={(checked) =>
                          handleSetAccess(selectedUser.id, { ...selectedUser.access, relatorios: checked })
                        }
                        disabled={selectedUser.blocked}
                      />
                    </div>
                  </div>
                </div>

                {/* Progresso (visível para o admin) */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Progresso do Usuário</h4>
                  {progressLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando progresso...</div>
                  ) : progressSummary ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-sm font-semibold text-foreground">Atividades</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Total: {progressSummary.activities.total}
                        </div>
                        <div className="mt-2 text-sm">
                          <div>Concluídas: <span className="font-semibold">{progressSummary.activities.concluida}</span></div>
                          <div>Em andamento: <span className="font-semibold">{progressSummary.activities.em_andamento}</span></div>
                          <div>Disponíveis: <span className="font-semibold">{progressSummary.activities.disponivel}</span></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-sm font-semibold text-foreground">Jogo da Memória</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Total: {progressSummary.memory_games.total}
                        </div>
                        <div className="mt-2 text-sm">
                          <div>Concluídos: <span className="font-semibold">{progressSummary.memory_games.concluido}</span></div>
                          <div>Disponíveis: <span className="font-semibold">{progressSummary.memory_games.disponivel}</span></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-sm font-semibold text-foreground">Estimulação Auditiva</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Total: {progressSummary.auditory_games.total}
                        </div>
                        <div className="mt-2 text-sm">
                          <div>Concluídos: <span className="font-semibold">{progressSummary.auditory_games.concluido}</span></div>
                          <div>Disponíveis: <span className="font-semibold">{progressSummary.auditory_games.disponivel}</span></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-sm font-semibold text-foreground">Jogo da Forca</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Total: {progressSummary.hangman_games.total}
                        </div>
                        <div className="mt-2 text-sm">
                          <div>Concluídos: <span className="font-semibold">{progressSummary.hangman_games.concluido}</span></div>
                          <div>Disponíveis: <span className="font-semibold">{progressSummary.hangman_games.disponivel}</span></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem dados de progresso.</div>
                  )}
                </div>

                {/* Actions in Profile */}
                <div className="pt-4 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-3">Ações Rápidas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="w-full">
                      <Activity size={16} className="mr-2" />
                      Adicionar Atividade
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                      <Calendar size={16} className="mr-2" />
                      <span className="inline-flex items-center gap-2">
                        Sessão
                        {selectedUserTodayAlert.show && (
                          <span
                            className={[
                              "inline-block h-2.5 w-2.5 rounded-full bg-brand-orange",
                              selectedUserTodayAlert.blink ? "animate-pulse" : "",
                            ].join(" ")}
                            title={
                              selectedUserTodayAlert.nextSession?.time
                                ? `Sessão hoje às ${selectedUserTodayAlert.nextSession.time}${selectedUserTodayAlert.blink ? " (próxima do horário)" : ""}`
                                : "Sessão hoje"
                            }
                          />
                        )}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setReportOpen(true)}
                    >
                      <FileText size={16} className="mr-2" />
                      Adicionar Relatório
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setDeleteAppointmentsOpen(true)}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Excluir todos os horários deste usuário
                    </Button>
                  </div>
                </div>

                {/* Agenda + Histórico (dentro do perfil do usuário) */}
                <div className="pt-4 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">Sessões do Usuário</h4>
                    {selectedUserTodayAlert.show && (
                      <span
                        className={[
                          "inline-block h-2.5 w-2.5 rounded-full bg-brand-orange",
                          selectedUserTodayAlert.blink ? "animate-pulse" : "",
                        ].join(" ")}
                        title={
                          selectedUserTodayAlert.nextSession?.time
                            ? `Sessão hoje às ${selectedUserTodayAlert.nextSession.time}${selectedUserTodayAlert.blink ? " (próxima do horário)" : ""}`
                            : "Sessão hoje"
                        }
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">Agenda</div>
                    {selectedAgenda.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sem sessões agendadas.</div>
                    ) : (
                      <div className="space-y-3">
                        {selectedAgenda.map((s) => (
                          <div key={s.id} className="rounded-lg border border-border p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground">Sessão</div>
                                <div className="text-sm text-muted-foreground capitalize">{formatDate(s.date)}</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {s.time} • {s.professional}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleMarkSelectedAppointmentCompleted(s.id)}
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Realizada
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">Histórico</div>
                    {selectedHistory.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sem sessões no histórico.</div>
                    ) : (
                      <div className="space-y-3">
                        {selectedHistory.map((s) => (
                          <div key={s.id} className="rounded-lg border border-border p-4 bg-muted/20">
                            <div className="font-semibold text-foreground">Sessão</div>
                            <div className="text-sm text-muted-foreground capitalize">{formatDate(s.date)}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {s.time} • {s.professional} • {s.status === "realizada" ? "Realizada" : "Cancelada"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: criar/editar pacote personalizado */}
        <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPackage ? "Editar pacote" : "Criar pacote"}</DialogTitle>
              <DialogDescription>
                Este pacote aparecerá no catálogo do paciente selecionado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pkg-sessions">Quantidade de sessões</Label>
                <Input
                  id="pkg-sessions"
                  type="number"
                  min="1"
                  step="1"
                  value={packageForm.sessions_count}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, sessions_count: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pkg-title">Título</Label>
                <Input
                  id="pkg-title"
                  value={packageForm.title}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Pacote especial de férias"
                />
              </div>
              <div>
                <Label htmlFor="pkg-price-session">Valor por sessão</Label>
                <Input
                  id="pkg-price-session"
                  type="number"
                  min="0"
                  step="0.01"
                  value={packageForm.price_per_session}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, price_per_session: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pkg-total">Valor total</Label>
                <Input
                  id="pkg-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={packageForm.total_price}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, total_price: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pkg-link">Link do Mercado Pago</Label>
                <Input
                  id="pkg-link"
                  value={packageForm.payment_url}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, payment_url: e.target.value }))}
                  placeholder="https://mpago.li/..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPackageDialogOpen(false)} disabled={savingPackage}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleSavePackage()} disabled={savingPackage}>
                  {savingPackage ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: novo relatório dentro do perfil do usuário */}
        {selectedUser && (
          <ReportFormModal
            open={reportOpen}
            mode="create"
            initial={null}
            fixedUser={{ id: selectedUser.id, name: selectedUser.name }}
            onOpenChange={setReportOpen}
            onSubmit={async (payload) => {
              await api.adminCreateReport(payload as unknown as {
                user_id: number;
                patient_name: string;
                professional_name: string;
                title: string;
                report_date: string;
                type: ReportType;
                content: string;
              });
              toast({ title: "Relatório criado", description: "Relatório salvo e disponível para o paciente." });
            }}
          />
        )}

        {selectedUser && (
          <BrandedConfirmDialog
            open={deleteAppointmentsOpen}
            onOpenChange={setDeleteAppointmentsOpen}
            title="Excluir todos os horários deste usuário?"
            description={`Isso vai remover permanentemente TODOS os horários agendados de "${selectedUser.name}".`}
            cancelLabel="Cancelar"
            confirmLabel={deletingAppointments ? "Excluindo..." : "Excluir tudo"}
            variant="danger"
            onConfirm={() => {
              if (deletingAppointments) return;
              setDeletingAppointments(true);
              void adminDeleteAllAppointmentsForUser(selectedUser.id)
                .then((res) => {
                  toast({
                    title: "Horários excluídos",
                    description: `${res.deleted} horário(s) removido(s) com sucesso.`,
                  });
                  emitAdminDataChanged();
                })
                .catch((e) => {
                  const msg =
                    isApiError(e) && e.status === 403
                      ? "Ação não permitida."
                      : "Não foi possível excluir os horários agora.";
                  toast({ title: "Erro", description: msg, variant: "destructive" });
                })
                .finally(() => setDeletingAppointments(false));
            }}
          />
        )}

        {/* Modal: excluir usuário (deve existir fora do perfil para funcionar na lista e no perfil) */}
        <BrandedConfirmDialog
          open={deleteUserOpen}
          onOpenChange={(open) => {
            setDeleteUserOpen(open);
            if (!open) setDeleteUserTarget(null);
          }}
          title="Excluir usuário?"
          description={
            deleteUserTarget
              ? `Excluir o usuário "${deleteUserTarget.name}"? Esta ação é permanente e removerá também os horários/sessões desse usuário.`
              : "Esta ação é permanente e removerá também os horários/sessões desse usuário."
          }
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={() => void confirmDeleteUser()}
        />
      </div>
    </div>
  );
};

export default AdminUsers;



