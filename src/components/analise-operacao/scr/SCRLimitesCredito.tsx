import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { LIMITE_SUB_LABELS, getModalidadeLabel, VENCIMENTO_LIMITE_MAP } from './scr-constants';
import { formatCurrency, calcTotalVenc, isLimiteOp, separateVencBuckets } from './scr-utils';

interface SCRLimitesCreditoProps {
  latestDtb: DtbEntry;
}

export function SCRLimitesCredito({ latestDtb }: SCRLimitesCreditoProps) {
  const limiteOps = (latestDtb.lsOp || []).filter(op => isLimiteOp(op));
  if (limiteOps.length === 0) return null;

  const totalLimite = limiteOps.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);

  // Group by modalidade label, aggregating a-vencer and vencido buckets
  const grouped: Record<string, { total: number; aVencer: Record<string, number>; vencidos: Record<string, number>; indeterminado: Record<string, number> }> = {};
  limiteOps.forEach(op => {
    const label = LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod);
    if (!grouped[label]) grouped[label] = { total: 0, aVencer: {}, vencidos: {}, indeterminado: {} };
    grouped[label].total += calcTotalVenc(op.resVenc);
    const { aVencer, vencidos, indeterminado } = separateVencBuckets(op.resVenc);
    Object.entries(aVencer).forEach(([k, v]) => { grouped[label].aVencer[k] = (grouped[label].aVencer[k] || 0) + v; });
    Object.entries(vencidos).forEach(([k, v]) => { grouped[label].vencidos[k] = (grouped[label].vencidos[k] || 0) + v; });
    Object.entries(indeterminado).forEach(([k, v]) => { grouped[label].indeterminado[k] = (grouped[label].indeterminado[k] || 0) + v; });
  });

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
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Cambial</TableHead>
              <TableHead>A vencer</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([label, data], i) => {
              const totalAVencer = Object.values(data.aVencer).reduce((s, v) => s + v, 0);
              const totalVencido = Object.values(data.vencidos).reduce((s, v) => s + v, 0);
              const totalIndeterminado = Object.values(data.indeterminado).reduce((s, v) => s + v, 0);

              // Build detail lines
              const lines: { label: string; value: number; style?: string }[] = [];
              // A vencer buckets
              const sortedAVencer = Object.entries(data.aVencer)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));
              sortedAVencer.forEach(([k, v]) => {
                lines.push({ label: VENCIMENTO_LIMITE_MAP[k] || `Venc. ${k}`, value: v });
              });
              // Indeterminado buckets (prazo indeterminado)
              const sortedIndet = Object.entries(data.indeterminado)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));
              sortedIndet.forEach(([k, v]) => {
                lines.push({ label: VENCIMENTO_LIMITE_MAP[k] || `Prazo indet. ${k}`, value: v });
              });
              // Vencido buckets removed — in limits, "vencido" means expired validity, not delinquency

              return (
                <TableRow key={i} className="align-top">
                  <TableCell className="text-sm font-medium">{label}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(data.total)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">Não</TableCell>
                  <TableCell colSpan={2} className="p-0">
                    <div className="space-y-0.5 py-2 px-3">
                      {lines.map((line, j) => (
                        <div key={j} className={`flex justify-between text-sm ${line.label === 'Total Vencido' ? 'font-semibold text-destructive pt-1 border-t border-border' : 'text-muted-foreground'}`}>
                          <span>{line.label}</span>
                          <span className="font-mono ml-4">{formatCurrency(line.value)}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}