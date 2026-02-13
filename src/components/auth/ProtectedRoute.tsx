import { ReactNode, forwardRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = forwardRef<HTMLDivElement, ProtectedRouteProps>(
  function ProtectedRoute({ children, requireAdmin = false }, ref) {
    const { user, isMaster, mustChangePassword, loading } = useAuth();
    const location = useLocation();

    if (loading) {
      return (
        <div ref={ref} className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (mustChangePassword && location.pathname !== '/alterar-senha') {
      return <Navigate to="/alterar-senha" replace />;
    }

    if (requireAdmin && !isMaster) {
      return <Navigate to="/consulta" replace />;
    }

    return <div ref={ref}>{children}</div>;
  }
);
