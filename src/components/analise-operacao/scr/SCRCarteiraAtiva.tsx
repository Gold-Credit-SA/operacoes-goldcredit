import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, CheckCircle2 } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP } from './scr-constants';
import { formatCurrency, separateVencBuckets, isLimiteOp } from './scr-utils';

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          CARTEIRA ATIVA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Carteira Ativa header */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="font-bold text-primary">CARTEIRA ATIVA (A)</TableCell>
              <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCarteira)}</TableCell>
              <TableCell className="text-right font-bold">100%</TableCell>
            </TableRow>

            {/* A Vencer section */}
            <TableRow className="font-semibold">
              <TableCell className="text-primary">A Vencer</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalAVencer)}</TableCell>
              <TableCell className="text-right">
                {totalCarteira > 0 ? ((totalAVencer / totalCarteira) * 100).toFixed(2) : '0'}%
              </TableCell>
            </TableRow>
            {sortBuckets(Object.entries(aVencerBuckets)).map(([key, val]) => (
              <TableRow key={key}>
                <TableCell className="text-sm pl-6">{VENCIMENTO_AVENCER_MAP[key] || key}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {totalCarteira > 0 ? ((val / totalCarteira) * 100).toFixed(2) : '0'}%
                </TableCell>
              </TableRow>
            ))}

            {/* Vencidos section */}
            <TableRow className="font-semibold border-t-2">
              <TableCell className={totalVencido > 0 ? 'text-destructive' : 'text-green-600'}>
                Vencidos
              </TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalVencido)}</TableCell>
              <TableCell className="text-right">
                {totalCarteira > 0 ? ((totalVencido / totalCarteira) * 100).toFixed(2) : '0'}%
              </TableCell>
            </TableRow>
            {totalVencido === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <div className="flex items-center gap-2 text-green-600 text-sm py-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>O documento consultado não possui créditos vencidos.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortBuckets(Object.entries(vencidoBuckets)).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell className="text-sm pl-6">{VENCIMENTO_VENCIDO_MAP[key] || key}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {totalCarteira > 0 ? ((val / totalCarteira) * 100).toFixed(2) : '0'}%
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
