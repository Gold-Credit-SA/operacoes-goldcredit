import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, CheckCircle, Clock, AlertTriangle, XCircle, RotateCcw, ArrowRightLeft, Scale } from 'lucide-react';

interface ComportamentoItem {
  valor: number;
  qtd: number;
  percentualValor: number;
  percentualQtd: number;
}

interface Comportamento90DiasProps {
  comportamento: {
    pontual: ComportamentoItem;
    atraso5: ComportamentoItem;
    atraso15: ComportamentoItem;
    atraso30: ComportamentoItem;
    atrasoMais30: ComportamentoItem;
    recompra: ComportamentoItem;
    repasse: ComportamentoItem;
    cartorio: ComportamentoItem;
    totalPago: { valor: number; qtd: number };
    emAtraso: ComportamentoItem;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function ComportamentoPagamento90Dias({ comportamento }: Comportamento90DiasProps) {
  const rows = [
    {
      label: 'Pago pontualmente',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      progressColor: 'bg-green-500',
      data: comportamento.pontual,
    },
    {
      label: 'Pago em atraso (até 5 dias)',
      icon: Clock,
      color: 'text-lime-600',
      bgColor: 'bg-lime-100',
      progressColor: 'bg-lime-500',
      data: comportamento.atraso5,
    },
    {
      label: 'Pago em atraso (6 a 15 dias)',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      progressColor: 'bg-yellow-500',
      data: comportamento.atraso15,
    },
    {
      label: 'Pago em atraso (16 a 30 dias)',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      progressColor: 'bg-orange-500',
      data: comportamento.atraso30,
    },
    {
      label: 'Pago em atraso (+ de 30 dias)',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      progressColor: 'bg-red-500',
      data: comportamento.atrasoMais30,
    },
    {
      label: 'Recompra',
      icon: RotateCcw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      progressColor: 'bg-purple-500',
      data: comportamento.recompra,
    },
    {
      label: 'Repasse / Pendência',
      icon: ArrowRightLeft,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      progressColor: 'bg-slate-500',
      data: comportamento.repasse,
    },
    {
      label: 'Pago em cartório',
      icon: Scale,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100',
      progressColor: 'bg-rose-500',
      data: comportamento.cartorio,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Comportamento de Títulos nos Últimos 90 Dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[280px]">Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right w-[100px]">% (Valor)</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right w-[100px]">% (Qtd)</TableHead>
                <TableHead className="w-[120px]">Distribuição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const Icon = row.icon;
                return (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${row.bgColor}`}>
                          <Icon className={`h-3.5 w-3.5 ${row.color}`} />
                        </div>
                        <span className="text-sm font-medium">{row.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.data.valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={row.color}>{formatPercent(row.data.percentualValor)}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.data.qtd}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={row.color}>{formatPercent(row.data.percentualQtd)}</span>
                    </TableCell>
                <TableCell>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full ${row.progressColor} transition-all`}
                          style={{ width: `${Math.min(row.data.percentualValor, 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Linha de Total Pago */}
              <TableRow className="bg-primary/5 font-semibold border-t-2">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-primary/20">
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-bold">Total Pago</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatCurrency(comportamento.totalPago.valor)}
                </TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {comportamento.totalPago.qtd}
                </TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Linha de Em Atraso */}
              <TableRow className="bg-destructive/5 font-semibold">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-destructive/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <span className="text-sm font-bold text-destructive">Em Atraso (Aberto)</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-destructive">
                  {formatCurrency(comportamento.emAtraso.valor)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-destructive font-semibold">
                    {formatPercent(comportamento.emAtraso.percentualValor)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-bold text-destructive">
                  {comportamento.emAtraso.qtd}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-destructive font-semibold">
                    {formatPercent(comportamento.emAtraso.percentualQtd)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-destructive transition-all"
                      style={{ width: `${Math.min(comportamento.emAtraso.percentualValor, 100)}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
