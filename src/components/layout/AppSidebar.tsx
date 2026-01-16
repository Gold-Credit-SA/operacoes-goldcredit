import { Link, useLocation } from 'react-router-dom';
import { Upload, LayoutDashboard, Search, LogOut, FileText, Sparkles, RefreshCw, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import bannerLogo from '@/assets/banner-gold-credit.png';

const navItems = [
  { path: '/', label: 'Importação', icon: Upload },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/consulta', label: 'Consulta', icon: Search },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
          <span className="text-primary-foreground font-bold text-lg">G</span>
        </div>
        <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">
          Gold Credit
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "text-sidebar-foreground bg-sidebar-accent"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "text-primary" : "text-sidebar-foreground/60"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground text-sm font-semibold">
            R
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              Renan Ramos
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              renan@goldcreditsa.com.br
            </p>
          </div>
          <button className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
