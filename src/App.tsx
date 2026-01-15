import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "@/auth/AuthContext";
import { RequireAdmin, RequireUser } from "@/auth/RequireRole";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Cadastro from "./pages/Cadastro";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import NotFound from "./pages/NotFound";
import PatientLayout from "./components/PatientLayout";
import PatientHome from "./pages/patient/PatientHome";
import PatientActivities from "./pages/patient/PatientActivities";
import PatientSessions from "./pages/patient/PatientSessions";
import PatientReports from "./pages/patient/PatientReports";
import PatientPackages from "./pages/patient/PatientPackages";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminActivities from "./pages/admin/AdminActivities";
import AdminSessions from "./pages/admin/AdminSessions";
import AdminReports from "./pages/admin/AdminReports";
import ActivityView from "./pages/ActivityView";
import AdminMemoryGameCreate from "./pages/admin/AdminMemoryGameCreate";
import AdminMemoryGames from "./pages/admin/AdminMemoryGames";
import AdminMemoryGameEdit from "./pages/admin/AdminMemoryGameEdit";
import AdminAuditoryStimulationCreate from "./pages/admin/AdminAuditoryStimulationCreate";
import AdminAuditoryGames from "./pages/admin/AdminAuditoryGames";
import AdminAuditoryGameEdit from "./pages/admin/AdminAuditoryGameEdit";
import AdminGamesHub from "./pages/admin/AdminGamesHub";
import PatientMemoryGames from "./pages/patient/PatientMemoryGames";
import MemoryGameView from "./pages/MemoryGameView";
import AuditoryGameView from "./pages/AuditoryGameView";
import AdminHangmanGames from "./pages/admin/AdminHangmanGames";
import AdminHangmanGameCreate from "./pages/admin/AdminHangmanGameCreate";
import AdminHangmanGameEdit from "./pages/admin/AdminHangmanGameEdit";
import HangmanGameView from "./pages/HangmanGameView";
import AdminSpinWheelGames from "./pages/admin/AdminSpinWheelGames";
import AdminSpinWheelGameCreate from "./pages/admin/AdminSpinWheelGameCreate";
import AdminSpinWheelGameEdit from "./pages/admin/AdminSpinWheelGameEdit";
import SpinWheelGameView from "./pages/SpinWheelGameView";
import RouteChangeLoader from "./components/RouteChangeLoader";
import GameplayBackground from "./components/GameplayBackground";
import { installSfxUnlock } from "@/lib/sfx";
import { useOneSignal } from "@/hooks/use-onesignal";

const queryClient = new QueryClient();

const SessionCall = lazyWithRetry(() => import("./pages/session/SessionCall"), "SessionCall");

function SessionCallRedirect(): JSX.Element {
  const { id } = useParams();
  const n = Number(id);
  if (!Number.isFinite(n)) return <Navigate to="/" replace />;
  return <Navigate to={`/sessao/${n}/chamada`} replace />;
}

// Componente interno para inicializar OneSignal
function OneSignalInit() {
  useOneSignal();
  return null;
}

const App = () => {
  // garante que no mobile o áudio é desbloqueado no primeiro toque/tecla
  installSfxUnlock();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <OneSignalInit />
          <BrowserRouter>
            <ErrorBoundary>
              <GameplayBackground />
              <div className="relative z-10 min-h-[100svh]">
                <RouteChangeLoader minDurationMs={1200} />
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/entrar" element={<Index />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              
              {/* Patient Routes (usuário comum) */}
              <Route
                path="/paciente"
                element={
                  <RequireUser>
                    <PatientLayout />
                  </RequireUser>
                }
              >
                <Route index element={<PatientHome />} />
                <Route path="atividades" element={<PatientActivities />} />
                <Route path="jogos" element={<PatientMemoryGames />} />
                <Route path="sessoes" element={<PatientSessions />} />
                <Route path="relatorios" element={<PatientReports />} />
                <Route path="pacotes" element={<PatientPackages />} />
              </Route>

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="usuarios" element={<AdminUsers />} />
                <Route path="atividades" element={<AdminActivities />} />
                <Route path="jogos" element={<AdminGamesHub />} />
                <Route path="jogos/memoria" element={<AdminMemoryGames />} />
                <Route path="jogos/memoria/novo" element={<AdminMemoryGameCreate />} />
                <Route path="jogos/memoria/:id/editar" element={<AdminMemoryGameEdit />} />
                <Route path="jogos/auditivo" element={<AdminAuditoryGames />} />
                <Route path="jogos/auditivo/novo" element={<AdminAuditoryStimulationCreate />} />
                <Route path="jogos/auditivo/:id/editar" element={<AdminAuditoryGameEdit />} />
                <Route path="jogos/forca" element={<AdminHangmanGames />} />
                <Route path="jogos/forca/novo" element={<AdminHangmanGameCreate />} />
                <Route path="jogos/forca/:id/editar" element={<AdminHangmanGameEdit />} />
                <Route path="jogos/roleta" element={<AdminSpinWheelGames />} />
                <Route path="jogos/roleta/novo" element={<AdminSpinWheelGameCreate />} />
                <Route path="jogos/roleta/:id/editar" element={<AdminSpinWheelGameEdit />} />
                <Route path="horarios" element={<AdminSessions />} />
                <Route path="relatorios" element={<AdminReports />} />
              </Route>
              
              {/* Preview Admin (sem autenticação - apenas para visualização) */}
              <Route path="/preview-admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="usuarios" element={<AdminUsers />} />
                <Route path="atividades" element={<AdminActivities />} />
                <Route path="jogos" element={<AdminGamesHub />} />
                <Route path="horarios" element={<AdminSessions />} />
                <Route path="relatorios" element={<AdminReports />} />
              </Route>

              {/* Preview Paciente (sem autenticação - apenas para visualização) */}
              <Route path="/preview-paciente" element={<PatientLayout />}>
                <Route index element={<PatientHome />} />
                <Route path="atividades" element={<PatientActivities />} />
                <Route path="jogos" element={<PatientMemoryGames />} />
                <Route path="sessoes" element={<PatientSessions />} />
                <Route path="relatorios" element={<PatientReports />} />
              </Route>
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route
                path="/sessao/:id/chamada"
                element={
                  <Suspense fallback={<FullScreenLogoLoader label="Carregando chamada..." />}>
                    <SessionCall />
                  </Suspense>
                }
              />
              {/* Compatibilidade: links antigos sem /chamada (ex.: cache/PWA no Windows) */}
              <Route path="/sessao/:id" element={<SessionCallRedirect />} />
              <Route path="/atividades/:id" element={<ActivityView />} />
              <Route path="/jogos/:id" element={<MemoryGameView />} />
              <Route path="/jogos/auditivo/:id" element={<AuditoryGameView />} />
              <Route path="/jogos/forca/:id" element={<HangmanGameView />} />
              <Route path="/jogos/roleta/:id" element={<SpinWheelGameView />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
              </div>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
