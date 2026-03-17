import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, Settings, Briefcase, ChevronDown, RefreshCw, BarChart3, Settings2, LayoutDashboard, Users, FileSignature, PenTool, FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import logoGoldCredit from '@/assets/logo-gold-credit.png';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isMaster, signOut } = useAuth();
  const [carteiraOpen, setCarteiraOpen] = useState(
    location.pathname.startsWith('/carteira')
  );
  const queryClient = useQueryClient();

  const carteiraItems = [
    { path: '/carteira/giro', label: 'Giro de Carteira', icon: RefreshCw },
    { path: '/carteira/metricas', label: 'Métricas da Carteira', icon: BarChart3 },
    { path: '/carteira/gestao', label: 'Gestão de Carteira', icon: Settings2 },
  ];

  const [contratosOpen, setContratosOpen] = useState(
    location.pathname.startsWith('/contratos')
  );

  const contratosItems = [
    { path: '/contratos/assinatura-digital', label: 'Assinatura Digital', icon: PenTool },
  ];

  const navItemsAfter = [
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/consulta', label: 'Cedentes', icon: Search },
    ...(isMaster ? [{ path: '/admin', label: 'Configurações', icon: Settings }] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userInitial = profile?.name?.charAt(0).toUpperCase() || 'U';
  const isCarteiraActive = location.pathname.startsWith('/carteira');

  // ── Prefetch helpers ──────────────────────────────────────────────
  const prefetchDashboard = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['gestor-dashboard'],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('portfolio-data', {
          body: { action: 'gestor-dashboard' },
        });
        if (error) throw error;
        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  const prefetchCedentes = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['cedentes-list-portfolio'],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('external-db', {
          body: { action: 'cedentes-list', filters: {} },
        });
        if (error) throw error;
        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  const prefetchPortfolio = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['portfolio-carteira'],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('portfolio-data', {
          body: { action: 'my-portfolio' },
        });
        if (error) throw error;
        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  const prefetchClientes = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['consulta-clients'],
      queryFn: async () => {
        const { data } = await supabase
          .from('consulta_clients')
          .select('*')
          .order('created_at', { ascending: false });
        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  const getPrefetchFn = (path: string) => {
    if (path === '/consulta') return prefetchCedentes;
    if (path === '/clientes') return prefetchClientes;
    return undefined;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      <div className="flex items-center justify-center px-4 py-5 border-b border-sidebar-border">
        <img src={logoGoldCredit} alt="Gold Credit" className="w-40 h-auto" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Painel */}
        <Link
          to="/painel"
          onMouseEnter={prefetchDashboard}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
            location.pathname === '/painel'
              ? "text-sidebar-foreground bg-sidebar-accent"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <LayoutDashboard className={cn("h-5 w-5", location.pathname === '/painel' ? "text-primary" : "text-sidebar-foreground/50")} />
          Painel
        </Link>

        {/* Carteira dropdown */}
        <button
          onClick={() => setCarteiraOpen(!carteiraOpen)}
          onMouseEnter={prefetchPortfolio}
          className={cn(
            "flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
            isCarteiraActive
              ? "text-sidebar-foreground bg-sidebar-accent"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <span className="flex items-center gap-3">
            <Briefcase className={cn("h-5 w-5", isCarteiraActive ? "text-primary" : "text-sidebar-foreground/50")} />
            Carteira
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", carteiraOpen ? "rotate-180" : "")} />
        </button>

        {carteiraOpen && (
          <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
            {carteiraItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={prefetchPortfolio}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                    isActive
                      ? "text-sidebar-foreground bg-sidebar-accent font-medium"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Contratos dropdown */}
        <button
          onClick={() => setContratosOpen(!contratosOpen)}
          className={cn(
            "flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
            location.pathname.startsWith('/contratos')
              ? "text-sidebar-foreground bg-sidebar-accent"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <span className="flex items-center gap-3">
            <FileSignature className={cn("h-5 w-5", location.pathname.startsWith('/contratos') ? "text-primary" : "text-sidebar-foreground/50")} />
            Contratos
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", contratosOpen ? "rotate-180" : "")} />
        </button>

        {contratosOpen && (
          <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
            {contratosItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                    isActive
                      ? "text-sidebar-foreground bg-sidebar-accent font-medium"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}


        {navItemsAfter.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={getPrefetchFn(item.path)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "text-sidebar-foreground bg-sidebar-accent"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {userInitial}
          </div>
          <Link to="/perfil" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.name || 'Usuário'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile?.email || ''}</p>
          </Link>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
