import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DtbEntry } from './scr-types';
import { getModalidadeLabel } from './scr-constants';
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
          <span>Limites de Crédito</span>
          <span className="text-lg text-primary font-bold">{formatCurrency(totalLimite)}</span>
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
            {limiteOps.map((op, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{getModalidadeLabel(op.mod)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(calcTotalVenc(op.resVenc))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
