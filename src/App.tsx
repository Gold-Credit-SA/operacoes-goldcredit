import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppSidebar } from "@/components/layout/AppSidebar";
import Login from "./pages/Login";
import CedenteConsulta from "./pages/CedenteConsulta";
import CedenteDetailPage from "./pages/CedenteDetailPage";
import CarteiraGiro from "./pages/CarteiraGiro";
import CarteiraMetricas from "./pages/CarteiraMetricas";
import CarteiraGestao from "./pages/CarteiraGestao";
import AnaliseOperacao from "./pages/AnaliseOperacao";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";
import GestorDashboard from "./pages/GestorDashboard";
import Consultas from "./pages/Consultas";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 ml-64">{children}</div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/alterar-senha" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/painel" replace /></ProtectedRoute>} />
              <Route path="/painel" element={<ProtectedRoute><AppLayout><GestorDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/consulta" element={<ProtectedRoute><AppLayout><CedenteConsulta /></AppLayout></ProtectedRoute>} />
              <Route path="/cedente/:id" element={<ProtectedRoute><AppLayout><CedenteDetailPage /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/giro" element={<ProtectedRoute><AppLayout><CarteiraGiro /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/metricas" element={<ProtectedRoute><AppLayout><CarteiraMetricas /></AppLayout></ProtectedRoute>} />
              <Route path="/carteira/gestao" element={<ProtectedRoute><AppLayout><CarteiraGestao /></AppLayout></ProtectedRoute>} />
              <Route path="/consultas" element={<ProtectedRoute><AppLayout><Consultas /></AppLayout></ProtectedRoute>} />
              <Route path="/analise-operacao" element={<Navigate to="/consultas" replace />} />
              <Route path="/analise-consulta" element={<Navigate to="/consultas" replace />} />
              <Route path="/perfil" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AppLayout><AdminSettings /></AppLayout></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/giro-carteira" element={<Navigate to="/carteira/giro" replace />} />
              <Route path="/carteira" element={<Navigate to="/carteira/giro" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
