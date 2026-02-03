import { Link, useLocation } from 'react-router-dom';
import { Search, LogOut, RefreshCw, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoGoldCredit from '@/assets/logo-gold-credit.png';

const navItems = [
  { path: '/consulta', label: 'Consulta', icon: Search },
  { path: '/giro-carteira', label: 'Giro de Carteira', icon: RefreshCw },
  { path: '/analise-consulta', label: 'Análise de Consulta', icon: FileSearch },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo Header */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-sidebar-border">
        <img src={logoGoldCredit} alt="Gold Credit" className="w-40 h-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "text-sidebar-foreground bg-sidebar-accent"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "text-primary" : "text-sidebar-foreground/50"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            R
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              Renan Ramos
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              renan@goldcreditsa.com.br
            </p>
          </div>
          <button className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
