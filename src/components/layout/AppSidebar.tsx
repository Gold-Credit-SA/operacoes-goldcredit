import { Link, useLocation } from 'react-router-dom';
import { Upload, LayoutDashboard, Search, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.svg';

const navItems = [
  { path: '/', label: 'Importação', icon: Upload },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/consulta', label: 'Consulta', icon: Search },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
          <img src={logo} alt="Gold Credit" className="h-6 w-6" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
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
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
            GC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              Gold Credit
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              Sistema de Gestão
            </p>
          </div>
          <button className="p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
