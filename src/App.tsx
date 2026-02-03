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
import GiroCarteira from "./pages/GiroCarteira";
import AnaliseConsulta from "./pages/AnaliseConsulta";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 ml-64">{children}</div>
    </div>
  );
}

const App = () => (
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
                  <AppLayout>
                    <CedenteConsulta />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cedente/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CedenteDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/giro-carteira"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <GiroCarteira />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analise-consulta"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnaliseConsulta />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AppLayout>
                    <AdminSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
