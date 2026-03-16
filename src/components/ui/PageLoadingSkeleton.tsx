import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';

interface PageLoadingSkeletonProps {
  message?: string;
}

export function PageLoadingSkeleton({ message = 'Carregando...' }: PageLoadingSkeletonProps) {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(120,53,15,0.05),transparent_28%),linear-gradient(180deg,rgba(255,251,235,0.72),rgba(255,255,255,1))] p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header skeleton */}
        <section className="py-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 bg-amber-200/40" />
            <Skeleton className="h-7 w-56 bg-amber-100/60" />
            <Skeleton className="h-4 w-72 bg-muted" />
          </div>
        </section>

        {/* Cards skeleton */}
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-xl bg-amber-50" />
                  <Skeleton className="h-5 w-28 bg-muted" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-3 bg-amber-100/50" />
                <Skeleton className="h-4 w-full bg-muted" />
                <Skeleton className="h-4 w-3/4 mt-2 bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 bg-muted" />
              <Skeleton className="h-9 w-28 rounded-lg bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32 bg-muted" />
                <Skeleton className="h-4 flex-1 bg-muted/60" />
                <Skeleton className="h-4 w-20 bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <LoadingIndicator show={true} message={message} />
    </div>
  );
}
