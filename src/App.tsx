import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIDBPersister, CACHE_VERSION } from "@/lib/queryPersister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, useSidebarState } from "@/contexts/SidebarContext";
import { DashboardSkeleton } from "@/components/painel/DashboardSkeleton";
import Login from "./pages/Login";

// Lazy-loaded pages – each becomes its own chunk
const GestorDashboard = lazy(() => import("./pages/GestorDashboard"));
const CedenteConsulta = lazy(() => import("./pages/CedenteConsulta"));
const CedenteDetailPage = lazy(() => import("./pages/CedenteDetailPage"));
const CarteiraGiro = lazy(() => import("./pages/CarteiraGiro"));
const CarteiraMetricas = lazy(() => import("./pages/CarteiraMetricas"));
const CarteiraGestao = lazy(() => import("./pages/CarteiraGestao"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteDetail = lazy(() => import("./pages/ClienteDetail"));
const Consultas = lazy(() => import("./pages/Consultas"));
const HistoricoSerasa = lazy(() => import("./pages/HistoricoSerasa"));
const HistoricoSCR = lazy(() => import("./pages/HistoricoSCR"));
const HistoricoAgrisk = lazy(() => import("./pages/HistoricoAgrisk"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Contratos = lazy(() => import("./pages/Documentos"));
const DocumentoDetalhe = lazy(() => import("./pages/DocumentoDetalhe"));
const AssinaturaDigital = lazy(() => import("./pages/AssinaturaDigital"));
const AssinaturaToken = lazy(() => import("./pages/AssinaturaToken"));
const AssinaturaOperacao = lazy(() => import("./pages/AssinaturaOperacao"));
const AnaliseCredito = lazy(() => import("./pages/AnaliseCredito"));
const NovaAnaliseCredito = lazy(() => import("./pages/NovaAnaliseCredito"));
const HistoricoAnaliseCredito = lazy(() => import("./pages/HistoricoAnaliseCredito"));
const SacadosExternos = lazy(() => import("./pages/SacadosExternos"));
const MonitoramentoNFe = lazy(() => import("./pages/MonitoramentoNFe"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // staleTime: dados ficam "frescos" por 5min — sem refetch automático
      staleTime: 5 * 60 * 1000,
      // gcTime: cache em memória/persistido por 24h
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const persister = createIDBPersister();

function PageFallback() {
  return <DashboardSkeleton message="Carregando..." />;
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState();
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className={`flex-1 transition-[margin] duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Cache válido por 24h; novas versões da app invalidam tudo automaticamente
        maxAge: 24 * 60 * 60 * 1000,
        buster: CACHE_VERSION,
        // Não persistir queries com erro
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unsubscribe" element={<Suspense fallback={<PageFallback />}><Unsubscribe /></Suspense>} />
              {/* Public signing route – no auth required */}
              <Route path="/assinar/:token" element={<Suspense fallback={<PageFallback />}><AssinaturaToken /></Suspense>} />
              <Route path="/assinar-operacao/:token" element={<Suspense fallback={<PageFallback />}><AssinaturaOperacao /></Suspense>} />
              <Route path="/alterar-senha" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><ChangePassword /></Suspense></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/painel" replace /></ProtectedRoute>} />
              <Route path="/painel" element={<ProtectedRoute><AppLayout><GestorDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/consulta" element={<ProtectedRoute><AppLayout><CedenteConsulta /></AppLayout></ProtectedRoute>} />
              <Route path="/cedente/:id" element={<ProtectedRoute><AppLayout><CedenteDetailPage /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/giro" element={<ProtectedRoute><AppLayout><CarteiraGiro /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/metricas" element={<ProtectedRoute><AppLayout><CarteiraMetricas /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/gestao" element={<ProtectedRoute><AppLayout><CarteiraGestao /></AppLayout></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><AppLayout><Clientes /></AppLayout></ProtectedRoute>} />
              <Route path="/clientes/:id" element={<ProtectedRoute><AppLayout><ClienteDetail /></AppLayout></ProtectedRoute>} />
              <Route path="/consultas" element={<ProtectedRoute><AppLayout><Consultas /></AppLayout></ProtectedRoute>} />
              <Route path="/historico-serasa" element={<ProtectedRoute><AppLayout><HistoricoSerasa /></AppLayout></ProtectedRoute>} />
              <Route path="/historico-scr" element={<ProtectedRoute><AppLayout><HistoricoSCR /></AppLayout></ProtectedRoute>} />
              <Route path="/historico-agrisk" element={<ProtectedRoute><AppLayout><HistoricoAgrisk /></AppLayout></ProtectedRoute>} />
              <Route path="/analise-operacao" element={<Navigate to="/consultas" replace />} />
              <Route path="/analise-consulta" element={<Navigate to="/consultas" replace />} />
              <Route path="/perfil" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
              <Route path="/contratos/documentos" element={<ProtectedRoute><AppLayout><Contratos /></AppLayout></ProtectedRoute>} />
              <Route path="/contratos/documentos/:token" element={<ProtectedRoute><AppLayout><DocumentoDetalhe /></AppLayout></ProtectedRoute>} />
              <Route path="/contratos/assinatura-digital" element={<ProtectedRoute><AppLayout><AssinaturaDigital /></AppLayout></ProtectedRoute>} />
              <Route path="/analise-credito/novo" element={<ProtectedRoute><AppLayout><NovaAnaliseCredito /></AppLayout></ProtectedRoute>} />
              <Route path="/analise-credito/historico" element={<ProtectedRoute><AppLayout><HistoricoAnaliseCredito /></AppLayout></ProtectedRoute>} />
              <Route path="/analise-credito/:sessionId" element={<ProtectedRoute><AppLayout><AnaliseCredito /></AppLayout></ProtectedRoute>} />
              <Route path="/sacados" element={<ProtectedRoute><AppLayout><SacadosExternos /></AppLayout></ProtectedRoute>} />
              <Route path="/nfe" element={<ProtectedRoute><AppLayout><MonitoramentoNFe /></AppLayout></ProtectedRoute>} />

              <Route path="/admin" element={<ProtectedRoute requireAdmin><AppLayout><AdminSettings /></AppLayout></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/giro-carteira" element={<Navigate to="/carteira/giro" replace />} />
              <Route path="/carteira" element={<Navigate to="/carteira/giro" replace />} />
              <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
