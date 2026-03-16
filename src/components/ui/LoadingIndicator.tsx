interface LoadingIndicatorProps {
  show: boolean;
  message?: string;
}

export function LoadingIndicator({ show, message = 'Carregando...' }: LoadingIndicatorProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
        <div className="h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
