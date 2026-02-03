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
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background flex">
                    <AppSidebar />
                    <div className="flex-1 ml-64">
                      <Routes>
                        <Route path="/" element={<Navigate to="/consulta" replace />} />
                        <Route path="/consulta" element={<CedenteConsulta />} />
                        <Route path="/cedente/:id" element={<CedenteDetailPage />} />
                        <Route path="/giro-carteira" element={<GiroCarteira />} />
                        <Route path="/analise-consulta" element={<AnaliseConsulta />} />
                        <Route
                          path="/admin"
                          element={
                            <ProtectedRoute requireAdmin>
                              <AdminSettings />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
