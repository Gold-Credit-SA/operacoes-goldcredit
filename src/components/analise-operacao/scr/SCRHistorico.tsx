import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { formatCurrency, formatDtb, calcTotalAVencer } from './scr-utils';

interface SCRHistoricoProps {
  lsDtb: DtbEntry[];
}

export function SCRHistorico({ lsDtb }: SCRHistoricoProps) {
  if (lsDtb.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Histórico Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Instituições</TableHead>
              <TableHead className="text-right">Doc. Proc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lsDtb.map((dtb) => (
              <TableRow key={dtb.dtb}>
                <TableCell className="font-medium">{formatDtb(dtb.dtb)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(calcTotalAVencer(dtb))}</TableCell>
                <TableCell className="text-right">{dtb.qtdIfs}</TableCell>
                <TableCell className="text-right">{dtb.docProc}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
