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
    <header className="bg-secondary shadow-lg">
      <div className="container-app py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-primary p-2 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
              <img src={logo} alt="Gold Credit" className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-secondary-foreground tracking-tight">
                GOLD CREDIT
              </h1>
              <p className="text-xs text-secondary-foreground/70 font-medium">
                Sistema de Gestão
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
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
