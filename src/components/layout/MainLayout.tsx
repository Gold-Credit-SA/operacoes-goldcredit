import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      
      <main className="ml-60">
        {(title || subtitle) && (
          <header className="border-b border-border bg-card px-8 py-6">
            {title && (
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </header>
        )}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
