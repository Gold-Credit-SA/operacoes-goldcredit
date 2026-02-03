import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Building2, TrendingUp, Wallet, FileText, Users, BarChart3 } from 'lucide-react';

export function LoadingPlaceholder() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header do Cedente */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary/40 animate-pulse" />
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-72 bg-primary/10" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-40 bg-muted" />
                <Skeleton className="h-6 w-20 rounded-full bg-muted" />
              </div>
              <div className="flex gap-6 pt-2">
                <Skeleton className="h-4 w-32 bg-muted" />
                <Skeleton className="h-4 w-28 bg-muted" />
                <Skeleton className="h-4 w-36 bg-muted" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Wallet, label: 'Limite Global' },
          { icon: TrendingUp, label: 'Risco Atual' },
          { icon: FileText, label: 'Total Operações' },
          { icon: BarChart3, label: 'Receita Total' },
        ].map((item, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20 bg-muted" />
                  <Skeleton className="h-6 w-28 bg-primary/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seção de Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados da Empresa */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded bg-muted" />
              <Skeleton className="h-5 w-32 bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-20 bg-muted" />
                <Skeleton className="h-4 w-32 bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Gráfico/Concentração */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
              <Skeleton className="h-5 w-44 bg-muted" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-28 bg-muted" />
                  <div className="flex-1">
                    <Skeleton 
                      className="h-6 rounded-full bg-gradient-to-r from-primary/20 to-primary/5" 
                      style={{ width: `${100 - i * 15}%` }}
                    />
                  </div>
                  <Skeleton className="h-4 w-16 bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Títulos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground/50 animate-pulse" />
              <Skeleton className="h-5 w-36 bg-muted" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md bg-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            {/* Header da tabela */}
            <div className="border-b bg-muted/30 p-3 flex gap-4">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-32 bg-muted" />
              <Skeleton className="h-4 w-28 bg-muted" />
              <Skeleton className="h-4 w-20 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
            </div>
            {/* Linhas da tabela */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b last:border-0 p-3 flex gap-4 items-center">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-4 w-32 bg-muted" />
                <Skeleton className="h-4 w-28 bg-muted" />
                <Skeleton className="h-4 w-20 bg-muted" />
                <Skeleton className="h-6 w-20 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Indicador de carregamento central */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <div className="h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
          <span className="text-sm font-medium">Carregando dados...</span>
        </div>
      </div>
    </div>
  );
}
