import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';

interface LimitesCardProps {
  limites: {
    global: number;
    disponivel: number;
    risco: number;
    saldo: number;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function LimitesCard({ limites }: LimitesCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="border-l-4 border-l-green-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Limite Global</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(limites.global)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Limite Disponível</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(limites.disponivel)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Risco Atual</p>
              <p className="text-xl font-bold text-amber-600">
                {formatCurrency(limites.risco)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-emerald-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatCurrency(limites.saldo)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
