import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { LIMITE_SUB_LABELS, getModalidadeLabel } from './scr-constants';
import { formatCurrency, calcTotalVenc, isLimiteOp } from './scr-utils';

interface SCRLimitesCreditoProps {
  latestDtb: DtbEntry;
}

export function SCRLimitesCredito({ latestDtb }: SCRLimitesCreditoProps) {
  const limiteOps = (latestDtb.lsOp || []).filter(op => isLimiteOp(op));
  if (limiteOps.length === 0) return null;

  const totalLimite = limiteOps.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Limites de Crédito — {formatCurrency(totalLimite)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modalidade</TableHead>
              <TableHead className="text-right">Limite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const grouped: Record<string, number> = {};
              limiteOps.forEach(op => {
                const label = LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod);
                grouped[label] = (grouped[label] || 0) + calcTotalVenc(op.resVenc);
              });
              return Object.entries(grouped).map(([label, value], i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{label}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(value)}</TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
