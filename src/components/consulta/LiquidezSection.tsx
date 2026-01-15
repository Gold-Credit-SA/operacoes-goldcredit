import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, CheckCircle, Clock, AlertTriangle, RotateCcw } from 'lucide-react';

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
    <Card className="border-t-4 border-t-emerald-600">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Liquidez
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Período</TableHead>
                <TableHead className="text-right font-semibold">Liquidado</TableHead>
                <TableHead className="text-right font-semibold">Pontual</TableHead>
                <TableHead className="text-right font-semibold">Atraso</TableHead>
                <TableHead className="text-right font-semibold">Cartório</TableHead>
                <TableHead className="text-right font-semibold">Recompra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Histórico</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(liquidez.valorQuitado)}
                </TableCell>
                <TableCell className="text-right text-green-600 font-semibold">
                  {liquidez.percentualPontual.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-amber-600 font-semibold">
                  {liquidez.percentualAtraso.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  -
                </TableCell>
                <TableCell className="text-right text-destructive font-semibold">
                  {liquidez.percentualRecompra.toFixed(2)}%
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableCell className="font-medium">Últimos 360 dias</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(liquidez.valorQuitado)}
                </TableCell>
                <TableCell className="text-right text-green-600 font-semibold">
                  {liquidez.percentualPontual.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-amber-600 font-semibold">
                  {liquidez.percentualAtraso.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  -
                </TableCell>
                <TableCell className="text-right text-destructive font-semibold">
                  {liquidez.percentualRecompra.toFixed(2)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pontual</p>
              <p className="text-2xl font-bold text-green-600">
                {liquidez.percentualPontual.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
            <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atraso</p>
              <p className="text-2xl font-bold text-amber-600">
                {liquidez.percentualAtraso.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 dark:bg-red-950">
            <div className="rounded-full bg-red-100 p-2 dark:bg-red-900">
              <RotateCcw className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recompra</p>
              <p className="text-2xl font-bold text-destructive">
                {liquidez.percentualRecompra.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Títulos</p>
              <p className="text-2xl font-bold text-blue-600">
                {totalHistorico.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
