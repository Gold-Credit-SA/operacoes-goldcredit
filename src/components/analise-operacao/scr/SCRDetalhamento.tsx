import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DtbEntry, Operacao } from './scr-types';
import {
  CATEGORY_LABELS, CategoryKey, VENCIMENTO_DETALHE_MAP,
  VENCIMENTO_LIMITE_MAP, LIMITE_SUB_LABELS,
  getDisplayCategory, getModalidadeLabel,
} from './scr-constants';
import { formatCurrency, calcTotalVenc, formatDtb, isLimiteOp } from './scr-utils';

interface SCRDetalhamentoProps {
  latestDtb: DtbEntry;
}

function getVencLabel(key: string, isLimite: boolean): string {
  if (isLimite) return VENCIMENTO_LIMITE_MAP[key] || key;
  return VENCIMENTO_DETALHE_MAP[key] || key;
}

export function SCRDetalhamento({ latestDtb }: SCRDetalhamentoProps) {
  const categoryOrder: CategoryKey[] = ['emprestimos', 'titulos_descontados', 'financiamentos', 'outros_creditos', 'limite'];

  const opsByCategory: Record<CategoryKey, Operacao[]> = {
    emprestimos: [],
    titulos_descontados: [],
    financiamentos: [],
    outros_creditos: [],
    limite: [],
  };

  latestDtb.lsOp.forEach(op => {
    const limite = isLimiteOp(op);
    const cat = getDisplayCategory(op.mod, limite);
    opsByCategory[cat].push(op);
  });

  const dtbLabel = formatDtb(latestDtb.dtb);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Detalhamento das Operações — {dtbLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categoryOrder.map(catKey => {
          const ops = opsByCategory[catKey];
          if (ops.length === 0) return null;

          const isLimiteCat = catKey === 'limite';
          const catTotal = ops.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
          const catLabel = CATEGORY_LABELS[catKey];

          return (
            <div key={catKey}>
              {/* Category header with total */}
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md mb-2">
                <span className="font-semibold text-sm text-primary">{catLabel}</span>
                <span className="font-mono font-semibold text-sm">{formatCurrency(catTotal)}</span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Modalidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.map((op, i) => {
                    const total = calcTotalVenc(op.resVenc);
                    const label = isLimiteCat
                      ? (LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod))
                      : getModalidadeLabel(op.mod);

                    const sortedBuckets = Object.entries(op.resVenc)
                      .filter(([, v]) => v > 0)
                      .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

                    const vencStr = sortedBuckets
                      .map(([k, v]) => `${getVencLabel(k, isLimiteCat)}: ${formatCurrency(v)}`)
                      .join(' | ');

                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm align-top">{label}</TableCell>
                        <TableCell className="text-right font-mono text-sm align-top whitespace-nowrap">
                          {formatCurrency(total)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          {vencStr}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
