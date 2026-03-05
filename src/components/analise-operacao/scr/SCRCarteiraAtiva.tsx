import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP } from './scr-constants';
import { formatCurrency, separateVencBuckets, calcTotalVenc, isLimiteOp } from './scr-utils';

interface SCRCarteiraAtivaProps {
  latestDtb: DtbEntry;
}

export function SCRCarteiraAtiva({ latestDtb }: SCRCarteiraAtivaProps) {
  // Aggregate buckets across non-limite operations
  const aVencerBuckets: Record<string, number> = {};
  const vencidoBuckets: Record<string, number> = {};

  latestDtb.lsOp.filter(op => !isLimiteOp(op)).forEach(op => {
    const { vencidos, aVencer } = separateVencBuckets(op.resVenc);
    Object.entries(aVencer).forEach(([key, val]) => {
      aVencerBuckets[key] = (aVencerBuckets[key] || 0) + val;
    });
    Object.entries(vencidos).forEach(([key, val]) => {
      vencidoBuckets[key] = (vencidoBuckets[key] || 0) + val;
    });
  });

  const totalAVencer = Object.values(aVencerBuckets).reduce((s, v) => s + v, 0);
  const totalVencido = Object.values(vencidoBuckets).reduce((s, v) => s + v, 0);
  const totalCarteira = totalAVencer + totalVencido;

  const sortBuckets = (entries: [string, number][]) =>
    entries.sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

  return (
    <div className="space-y-4">
      {/* Créditos a Vencer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Créditos a Vencer
            </span>
            <span className="text-lg text-primary font-bold">{formatCurrency(totalAVencer)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortBuckets(Object.entries(aVencerBuckets)).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell className="text-sm">{VENCIMENTO_AVENCER_MAP[key] || key}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {totalAVencer > 0 ? ((val / totalAVencer) * 100).toFixed(2) : '0'}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell>A Vencer</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totalAVencer)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Créditos Vencidos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              {totalVencido > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              Créditos Vencidos
            </span>
            <span className={`text-lg font-bold ${totalVencido > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(totalVencido)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalVencido === 0 ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Não possui créditos vencidos</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortBuckets(Object.entries(vencidoBuckets)).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="text-sm">{VENCIMENTO_VENCIDO_MAP[key] || key}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {totalVencido > 0 ? ((val / totalVencido) * 100).toFixed(2) : '0'}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total Vencido</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalVencido)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
