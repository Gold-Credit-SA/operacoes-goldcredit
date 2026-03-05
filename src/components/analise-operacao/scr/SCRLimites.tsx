import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { getModalidadeLabel, VENCIMENTO_LIMITE_MAP } from './scr-constants';
import { formatCurrency, calcTotalVenc, isLimiteOp } from './scr-utils';

interface SCRLimitesProps {
  latestDtb: DtbEntry;
}

export function SCRLimites({ latestDtb }: SCRLimitesProps) {
  const limiteOps = latestDtb.lsOp.filter(isLimiteOp);
  if (limiteOps.length === 0) return null;

  const totalLimite = limiteOps.reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Limite Total
          </span>
          <span className="text-lg text-primary font-bold">{formatCurrency(totalLimite)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modalidade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Detalhamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limiteOps.map((op, i) => {
              const total = calcTotalVenc(op.resVenc);
              const sortedBuckets = Object.entries(op.resVenc)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

              const bucketLabels = sortedBuckets.map(([k, v]) => {
                const label = VENCIMENTO_LIMITE_MAP[k] || k;
                return `${label}: ${formatCurrency(v)}`;
              }).join(', ');

              return (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{getModalidadeLabel(op.mod)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(total)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground max-w-[200px] truncate" title={bucketLabels}>
                    {bucketLabels || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="font-semibold border-t-2">
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(totalLimite)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
