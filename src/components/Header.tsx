import { Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="container-app py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Database className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Consulta Cedentes</h1>
            <p className="text-sm text-muted-foreground">Sistema de consulta MySQL</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
