import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DtbEntry, Operacao } from './scr-types';
import { CATEGORY_LABELS, CategoryKey, VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP, getModalidadeCategory, getModalidadeLabel } from './scr-constants';
import { formatCurrency, calcTotalVenc, formatDtb, isLimiteOp } from './scr-utils';

interface SCRDetalhamentoProps {
  latestDtb: DtbEntry;
}

function getVencLabel(key: string): string {
  return VENCIMENTO_AVENCER_MAP[key] || VENCIMENTO_VENCIDO_MAP[key] || key;
}

export function SCRDetalhamento({ latestDtb }: SCRDetalhamentoProps) {
  // Group non-limite operations by category
  const opsByCategory: Record<CategoryKey, { ops: Operacao[]; total: number }> = {
    emprestimos: { ops: [], total: 0 },
    titulos_descontados: { ops: [], total: 0 },
    financiamentos: { ops: [], total: 0 },
    outros_creditos: { ops: [], total: 0 },
    limite: { ops: [], total: 0 },
  };

  latestDtb.lsOp.forEach(op => {
    const cat = getModalidadeCategory(op.mod);
    opsByCategory[cat].ops.push(op);
    opsByCategory[cat].total += calcTotalVenc(op.resVenc);
  });

  // Filter categories with data
  const activeCats = (Object.entries(opsByCategory) as [CategoryKey, { ops: Operacao[]; total: number }][])
    .filter(([, { ops }]) => ops.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Detalhamento das Operações - {formatDtb(latestDtb.dtb)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeCats.map(([catKey, { ops, total }]) => (
          <div key={catKey}>
            {/* Category header */}
            <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md mb-2">
              <span className="font-semibold text-sm">{CATEGORY_LABELS[catKey]}</span>
              <span className="font-mono font-bold text-sm">{formatCurrency(total)}</span>
            </div>
            
            {/* Operations within category */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.map((op, i) => {
                  const opTotal = calcTotalVenc(op.resVenc);
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm pl-6">
                        <p className="font-medium">{getModalidadeLabel(op.mod)}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                        {formatCurrency(opTotal)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-0.5">
                          {Object.entries(op.resVenc)
                            .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')))
                            .map(([key, val]) => (
                              <div key={key} className="flex justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">{getVencLabel(key)}</span>
                                <span className="font-mono whitespace-nowrap">{formatCurrency(val)}</span>
                              </div>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
