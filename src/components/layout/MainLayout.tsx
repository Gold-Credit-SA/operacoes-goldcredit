import { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Optional element rendered on the right of the header (e.g. search, actions) */
  headerRight?: ReactNode;
  /** Optional element rendered between title and headerRight (e.g. filters) */
  headerCenter?: ReactNode;
}

export function MainLayout({ children, title, subtitle, headerRight, headerCenter }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {(title || subtitle || headerRight || headerCenter) && (
        <header className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              {title && (
                <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {headerCenter && (
              <div className="flex-1 max-w-md">{headerCenter}</div>
            )}
            {headerRight && (
              <div className="flex items-center gap-3">{headerRight}</div>
            )}
          </div>
        </header>
      )}
      <div className="px-8 pb-8">
        {children}
      </div>
    </div>
  );
}
