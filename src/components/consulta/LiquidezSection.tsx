import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, CheckCircle, Clock, RotateCcw } from 'lucide-react';

interface LiquidezProps {
  liquidez: {
    totalQuitados: number;
    valorQuitado: number;
    totalRecomprados: number;
    valorRecomprado: number;
    percentualPontual: number;
    percentualAtraso: number;
    percentualRecompra: number;
    percentualLiquidado: number;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function LiquidezSection({ liquidez }: LiquidezProps) {
  const totalHistorico = liquidez.totalQuitados + liquidez.totalRecomprados;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Liquidez
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barras de Progresso */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Pontual</span>
              </div>
              <span className="text-sm font-bold text-green-600">
                {liquidez.percentualPontual.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={liquidez.percentualPontual} 
              className="h-2 bg-muted [&>div]:bg-green-600" 
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Atraso</span>
              </div>
              <span className="text-sm font-bold text-amber-600">
                {liquidez.percentualAtraso.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={liquidez.percentualAtraso} 
              className="h-2 bg-muted [&>div]:bg-amber-500" 
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Recompra</span>
              </div>
              <span className="text-sm font-bold text-destructive">
                {liquidez.percentualRecompra.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={liquidez.percentualRecompra} 
              className="h-2 bg-muted [&>div]:bg-destructive" 
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total Quitados</p>
            <p className="text-lg font-bold">{liquidez.totalQuitados.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(liquidez.valorQuitado)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total Recomprados</p>
            <p className="text-lg font-bold text-destructive">{liquidez.totalRecomprados.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(liquidez.valorRecomprado)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
