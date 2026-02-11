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
import MinhaCarteira from "./pages/MinhaCarteira";
import CarteiraPendencias from "./pages/CarteiraPendencias";
import AnaliseConsulta from "./pages/AnaliseConsulta";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";

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
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Navigate to="/consulta" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consulta"
                element={
                  <ProtectedRoute>
                    <AppLayout><CedenteConsulta /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cedente/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout><CedenteDetailPage /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carteira"
                element={
                  <ProtectedRoute>
                    <AppLayout><MinhaCarteira /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carteira/metricas"
                element={
                  <ProtectedRoute>
                    <AppLayout><MinhaCarteira /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carteira/gestao"
                element={
                  <ProtectedRoute requireAdmin>
                    <AppLayout><CarteiraPendencias /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analise-consulta"
                element={
                  <ProtectedRoute>
                    <AppLayout><AnaliseConsulta /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AppLayout><AdminSettings /></AppLayout>
                  </ProtectedRoute>
                }
              />
              {/* Legacy redirect */}
              <Route
                path="/giro-carteira"
                element={<Navigate to="/carteira" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
