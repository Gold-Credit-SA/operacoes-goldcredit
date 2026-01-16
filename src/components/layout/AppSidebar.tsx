import { Link, useLocation } from 'react-router-dom';
import { Upload, LayoutDashboard, Search, LogOut } from 'lucide-react';
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border overflow-hidden">
      {/* Background Logo */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `url(${bannerLogo})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '180%',
        }}
      />

      {/* Logo Header */}
      <div className="relative z-10 flex items-center justify-center px-5 py-8 border-b border-sidebar-border">
        <img src={bannerLogo} alt="Gold Credit" className="h-12 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 px-3 py-6 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30"
                  : "text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="relative z-10 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground text-sm font-bold shadow-lg shadow-sidebar-primary/20">
            GC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              Gold Credit
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              Sistema de Gestão
            </p>
          </div>
          <button className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
