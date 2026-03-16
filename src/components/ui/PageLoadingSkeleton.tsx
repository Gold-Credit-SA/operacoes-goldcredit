import { DashboardSkeleton } from '@/components/painel/DashboardSkeleton';

interface PageLoadingSkeletonProps {
  message?: string;
}

export function PageLoadingSkeleton({ message = 'Carregando...' }: PageLoadingSkeletonProps) {
  return <DashboardSkeleton message={message} />;
}
