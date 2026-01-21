import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "@/auth/AuthContext";
import { RequireAdmin, RequireProfessional, RequireUser } from "@/auth/RequireRole";
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
import ProfessionalLayout from "./components/ProfessionalLayout";
import ProfessionalHome from "./pages/professional/ProfessionalHome";
import ProfessionalDashboard from "./pages/professional/ProfessionalDashboard";
import ProfessionalActivities from "./pages/professional/ProfessionalActivities";
import ProfessionalReports from "./pages/professional/ProfessionalReports";
import ProfessionalSessions from "./pages/professional/ProfessionalSessions";
import ProfessionalPatients from "./pages/professional/ProfessionalPatients";
import ProfessionalGamesHub from "./pages/professional/ProfessionalGamesHub";
import ProfessionalHistory from "./pages/professional/ProfessionalHistory";
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
import AdminMemoryGames2 from "./pages/admin/AdminMemoryGames2";
import AdminMemoryGame2Create from "./pages/admin/AdminMemoryGame2Create";
import AdminMemoryGame2Edit from "./pages/admin/AdminMemoryGame2Edit";
import AdminPhonemeGames from "./pages/admin/AdminPhonemeGames";
import AdminPhonemeGameCreate from "./pages/admin/AdminPhonemeGameCreate";
import AdminPhonemeGameEdit from "./pages/admin/AdminPhonemeGameEdit";
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
import PhonemeGameView from "./pages/PhonemeGameView";
import AdminWordSearchGames from "./pages/admin/AdminWordSearchGames";
import AdminWordSearchGameCreate from "./pages/admin/AdminWordSearchGameCreate";
import AdminWordSearchGameEdit from "./pages/admin/AdminWordSearchGameEdit";
import WordSearchGameView from "./pages/WordSearchGameView";
import AdminCardGames from "./pages/admin/AdminCardGames";
import AdminCardGameCreate from "./pages/admin/AdminCardGameCreate";
import AdminCardGameEdit from "./pages/admin/AdminCardGameEdit";
import CardGameView from "./pages/CardGameView";
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

              {/* Professional Routes (novo ambiente) */}
              <Route
                path="/profissional"
                element={
                  <RequireProfessional>
                    <ProfessionalLayout />
                  </RequireProfessional>
                }
              >
                <Route index element={<ProfessionalDashboard />} />
                <Route path="pacientes" element={<ProfessionalPatients />} />
                <Route path="atividades" element={<ProfessionalActivities />} />
                <Route path="jogos" element={<ProfessionalGamesHub />} />
                <Route path="jogos/memoria" element={<AdminMemoryGames />} />
                <Route path="jogos/memoria/novo" element={<AdminMemoryGameCreate />} />
                <Route path="jogos/memoria/:id/editar" element={<AdminMemoryGameEdit />} />
                <Route path="jogos/memoria2" element={<AdminMemoryGames2 />} />
                <Route path="jogos/memoria2/novo" element={<AdminMemoryGame2Create />} />
                <Route path="jogos/memoria2/:id/editar" element={<AdminMemoryGame2Edit />} />
                <Route path="jogos/fonema" element={<AdminPhonemeGames />} />
                <Route path="jogos/fonema/novo" element={<AdminPhonemeGameCreate />} />
                <Route path="jogos/fonema/:id/editar" element={<AdminPhonemeGameEdit />} />
                <Route path="jogos/auditivo" element={<AdminAuditoryGames />} />
                <Route path="jogos/auditivo/novo" element={<AdminAuditoryStimulationCreate />} />
                <Route path="jogos/auditivo/:id/editar" element={<AdminAuditoryGameEdit />} />
                <Route path="jogos/forca" element={<AdminHangmanGames />} />
                <Route path="jogos/forca/novo" element={<AdminHangmanGameCreate />} />
                <Route path="jogos/forca/:id/editar" element={<AdminHangmanGameEdit />} />
                <Route path="jogos/roleta" element={<AdminSpinWheelGames />} />
                <Route path="jogos/roleta/novo" element={<AdminSpinWheelGameCreate />} />
                <Route path="jogos/roleta/:id/editar" element={<AdminSpinWheelGameEdit />} />
                <Route path="jogos/caca-palavras" element={<AdminWordSearchGames />} />
                <Route path="jogos/caca-palavras/novo" element={<AdminWordSearchGameCreate />} />
                <Route path="jogos/caca-palavras/:id/editar" element={<AdminWordSearchGameEdit />} />
                <Route path="jogos/cartas" element={<AdminCardGames />} />
                <Route path="jogos/cartas/novo" element={<AdminCardGameCreate />} />
                <Route path="jogos/cartas/:id/editar" element={<AdminCardGameEdit />} />
                <Route path="horarios" element={<ProfessionalSessions />} />
                <Route path="historico" element={<ProfessionalHistory />} />
                <Route path="relatorios" element={<ProfessionalReports />} />
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
                <Route path="jogos/memoria2" element={<AdminMemoryGames2 />} />
                <Route path="jogos/memoria2/novo" element={<AdminMemoryGame2Create />} />
                <Route path="jogos/memoria2/:id/editar" element={<AdminMemoryGame2Edit />} />
                <Route path="jogos/fonema" element={<AdminPhonemeGames />} />
                <Route path="jogos/fonema/novo" element={<AdminPhonemeGameCreate />} />
                <Route path="jogos/fonema/:id/editar" element={<AdminPhonemeGameEdit />} />
                <Route path="jogos/auditivo" element={<AdminAuditoryGames />} />
                <Route path="jogos/auditivo/novo" element={<AdminAuditoryStimulationCreate />} />
                <Route path="jogos/auditivo/:id/editar" element={<AdminAuditoryGameEdit />} />
                <Route path="jogos/forca" element={<AdminHangmanGames />} />
                <Route path="jogos/forca/novo" element={<AdminHangmanGameCreate />} />
                <Route path="jogos/forca/:id/editar" element={<AdminHangmanGameEdit />} />
                <Route path="jogos/roleta" element={<AdminSpinWheelGames />} />
                <Route path="jogos/roleta/novo" element={<AdminSpinWheelGameCreate />} />
                <Route path="jogos/roleta/:id/editar" element={<AdminSpinWheelGameEdit />} />
                <Route path="jogos/caca-palavras" element={<AdminWordSearchGames />} />
                <Route path="jogos/caca-palavras/novo" element={<AdminWordSearchGameCreate />} />
                <Route path="jogos/caca-palavras/:id/editar" element={<AdminWordSearchGameEdit />} />
                <Route path="jogos/cartas" element={<AdminCardGames />} />
                <Route path="jogos/cartas/novo" element={<AdminCardGameCreate />} />
                <Route path="jogos/cartas/:id/editar" element={<AdminCardGameEdit />} />
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
              <Route path="/jogos/memoria/:id" element={<MemoryGameView />} />
              <Route path="/jogos/memoria2/:id" element={<MemoryGameView />} />
              <Route path="/jogos/fonema/:id" element={<PhonemeGameView />} />
              <Route path="/jogos/auditivo/:id" element={<AuditoryGameView />} />
              <Route path="/jogos/forca/:id" element={<HangmanGameView />} />
              <Route path="/jogos/roleta/:id" element={<SpinWheelGameView />} />
              <Route path="/jogos/caca-palavras/:id" element={<WordSearchGameView />} />
              <Route path="/jogos/cartas/:id" element={<CardGameView />} />
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
