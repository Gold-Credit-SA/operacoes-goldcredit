import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Wallet2, Cake, AlertTriangle } from 'lucide-react';

export function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(120,53,15,0.05),transparent_28%),linear-gradient(180deg,rgba(255,251,235,0.72),rgba(255,255,255,1))] p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <section className="py-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 bg-amber-200/40" />
            <Skeleton className="h-8 w-64 bg-amber-100/60" />
            <Skeleton className="h-4 w-48 bg-muted" />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-12">
          {/* Saldos Card */}
          <Card className="xl:col-span-7 border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl p-2 bg-amber-50">
                  <Wallet2 className="h-4 w-4 text-amber-600/40 animate-pulse" />
                </div>
                <Skeleton className="h-5 w-32 bg-muted" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 bg-amber-100/50" />
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-28 bg-muted" />
                    <Skeleton className="h-8 rounded bg-amber-100/30" style={{ width: `${90 - i * 10}%` }} />
                    <Skeleton className="h-4 w-16 bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:col-span-5">
            {/* Aniversariantes */}
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl p-2 bg-amber-50">
                    <Cake className="h-4 w-4 text-amber-600/40 animate-pulse" />
                  </div>
                  <Skeleton className="h-5 w-44 bg-muted" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between rounded-2xl border border-transparent bg-slate-50/70 p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl bg-muted" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28 bg-muted" />
                        <Skeleton className="h-3 w-20 bg-muted" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cheques */}
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl p-2 bg-slate-100">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground/40 animate-pulse" />
                  </div>
                  <Skeleton className="h-5 w-36 bg-muted" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32 bg-muted" />
                      <Skeleton className="h-3 w-20 bg-muted" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Indicador de carregamento no canto */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <div className="h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
          <span className="text-sm font-medium">Carregando painel...</span>
        </div>
      </div>
    </div>
  );
}
