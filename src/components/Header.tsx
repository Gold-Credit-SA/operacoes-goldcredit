import { LayoutDashboard, Upload, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.svg';

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Importação', icon: Upload },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/consulta', label: 'Consulta', icon: Search },
  ];

  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="container-app py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Gold Credit" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Consulta Cedentes</h1>
              <p className="text-sm text-muted-foreground">Gold Credit</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
