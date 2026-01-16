import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CedenteConsulta from "./pages/CedenteConsulta";
import CedenteDetailPage from "./pages/CedenteDetailPage";
import GiroCarteira from "./pages/GiroCarteira";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background flex">
          <AppSidebar />
          <div className="flex-1 ml-64">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/consulta" element={<CedenteConsulta />} />
              <Route path="/cedente/:id" element={<CedenteDetailPage />} />
              <Route path="/giro-carteira" element={<GiroCarteira />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
