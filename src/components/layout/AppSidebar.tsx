import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, Settings, Briefcase, ChevronDown, RefreshCw, BarChart3, Settings2, LayoutDashboard, Users, FileSignature, PenTool, FileText, Brain, UserCheck, type LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import logoGoldCredit from '@/assets/logo-gold-credit.png';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  prefetch?: () => void;
};

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isMaster, signOut } = useAuth();
  const [carteiraOpen, setCarteiraOpen] = useState(
    location.pathname.startsWith('/carteira')
  );
  const [contratosOpen, setContratosOpen] = useState(
    location.pathname.startsWith('/contratos')
  );
  const queryClient = useQueryClient();

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

  const carteiraItems: NavItem[] = [
    { path: '/carteira/giro', label: 'Giro de Carteira', icon: RefreshCw, prefetch: prefetchPortfolio },
    { path: '/carteira/metricas', label: 'Métricas da Carteira', icon: BarChart3, prefetch: prefetchPortfolio },
    { path: '/carteira/gestao', label: 'Gestão de Carteira', icon: Settings2, prefetch: prefetchPortfolio },
  ];

  const contratosItems: NavItem[] = [
    { path: '/contratos/documentos', label: 'Documentos', icon: FileText },
    { path: '/contratos/assinatura-digital', label: 'Assinatura Digital', icon: PenTool },
  ];

  const menuItems: NavItem[] = [
    { path: '/painel', label: 'Painel', icon: LayoutDashboard, prefetch: prefetchDashboard },
    { path: '/clientes', label: 'Clientes', icon: Users, prefetch: prefetchClientes },
    { path: '/sacados', label: 'Sacados', icon: UserCheck },
    { path: '/consulta', label: 'Cedentes', icon: Search, prefetch: prefetchCedentes },
    { path: '/analise-credito/novo', label: 'Análise de Crédito', icon: Brain },
  ];

  const othersItems: NavItem[] = [
    ...(isMaster ? [{ path: '/admin', label: 'Configurações', icon: Settings } as NavItem] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userInitial = profile?.name?.charAt(0).toUpperCase() || 'U';
  const isCarteiraActive = location.pathname.startsWith('/carteira');
  const isContratosActive = location.pathname.startsWith('/contratos');

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  // ── Render helpers ───────────────────────────────────────────────
  const NavPill = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onMouseEnter={item.prefetch}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-card shadow-card text-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
            active
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground group-hover:bg-card'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
      {children}
    </p>
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo + user */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <img src={logoGoldCredit} alt="Gold Credit" className="w-32 h-auto mx-auto mb-4" />
        <Link
          to="/perfil"
          className="flex items-center gap-3 p-2 rounded-2xl hover:bg-sidebar-accent transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profile?.name || 'Usuário'}</p>
            <p className="text-xs text-muted-foreground truncate">{isMaster ? 'Master Admin' : 'Gestor'}</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <SectionTitle>Menu</SectionTitle>
        {menuItems.map((item) => <NavPill key={item.path} item={item} />)}

        {/* Carteira (collapsible) */}
        <button
          onClick={() => setCarteiraOpen(!carteiraOpen)}
          onMouseEnter={prefetchPortfolio}
          className={cn(
            'group flex items-center justify-between w-full px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150',
            isCarteiraActive
              ? 'bg-card shadow-card text-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-xl',
                isCarteiraActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground group-hover:bg-card'
              )}
            >
              <Briefcase className="h-4 w-4" />
            </span>
            Carteira
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', carteiraOpen && 'rotate-180')} />
        </button>
        {carteiraOpen && (
          <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5 my-1">
            {carteiraItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={item.prefetch}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all',
                    active
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : '')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* GoldSign (collapsible) */}
        <button
          onClick={() => setContratosOpen(!contratosOpen)}
          className={cn(
            'group flex items-center justify-between w-full px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150',
            isContratosActive
              ? 'bg-card shadow-card text-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <span
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-xl',
                isContratosActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground group-hover:bg-card'
              )}
            >
              <FileSignature className="h-4 w-4" />
            </span>
            GoldSign
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', contratosOpen && 'rotate-180')} />
        </button>
        {contratosOpen && (
          <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5 my-1">
            {contratosItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all',
                    active
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : '')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {othersItems.length > 0 && (
          <>
            <SectionTitle>Outros</SectionTitle>
            {othersItems.map((item) => <NavPill key={item.path} item={item} />)}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-secondary">
            <LogOut className="h-4 w-4" />
          </span>
          Sair
        </button>
      </div>
    </aside>
  );
}
