import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP } from './scr-constants';
import { formatCurrency, separateVencBuckets, isLimiteOp } from './scr-utils';

interface SCRCarteiraAtivaProps {
  latestDtb: DtbEntry;
}

const sortBuckets = (entries: [string, number][]) =>
  entries.sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

export function SCRCreditosAVencer({ latestDtb }: SCRCarteiraAtivaProps) {
  const aVencerBuckets: Record<string, number> = {};

  latestDtb.lsOp.filter(op => !isLimiteOp(op)).forEach(op => {
    const { aVencer } = separateVencBuckets(op.resVenc);
    Object.entries(aVencer).forEach(([key, val]) => {
      aVencerBuckets[key] = (aVencerBuckets[key] || 0) + val;
    });
  });

  const totalAVencer = Object.values(aVencerBuckets).reduce((s, v) => s + v, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Créditos a Vencer — {formatCurrency(totalAVencer)}
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
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SCRCreditosVencidos({ latestDtb }: SCRCarteiraAtivaProps) {
  const vencidoBuckets: Record<string, number> = {};

  latestDtb.lsOp.filter(op => !isLimiteOp(op)).forEach(op => {
    const { vencidos } = separateVencBuckets(op.resVenc);
    Object.entries(vencidos).forEach(([key, val]) => {
      vencidoBuckets[key] = (vencidoBuckets[key] || 0) + val;
    });
  });

  const totalVencido = Object.values(vencidoBuckets).reduce((s, v) => s + v, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {totalVencido > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          Créditos Vencidos — {formatCurrency(totalVencido)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalVencido === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm py-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>O documento consultado não possui créditos vencidos.</span>
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
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
