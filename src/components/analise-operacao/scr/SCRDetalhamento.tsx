import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DtbEntry, Operacao } from './scr-types';
import {
  CATEGORY_LABELS, CategoryKey, VENCIMENTO_DETALHE_AVENCER_MAP,
  VENCIMENTO_VENCIDO_MAP, VENCIMENTO_LIMITE_MAP, LIMITE_SUB_LABELS,
  getDisplayCategory, getModalidadeLabel,
} from './scr-constants';
import { formatCurrency, calcTotalVenc, formatDtb, isLimiteOp } from './scr-utils';

interface SCRDetalhamentoProps {
  latestDtb: DtbEntry;
}

function getVencLabel(key: string, isLimite: boolean): string {
  if (isLimite) return VENCIMENTO_LIMITE_MAP[key] || key;
  return VENCIMENTO_DETALHE_AVENCER_MAP[key] || VENCIMENTO_VENCIDO_MAP[key] || key;
}

interface GroupedOp {
  op: Operacao;
  isLimite: boolean;
  category: CategoryKey;
  categoryLabel: string;
  subLabel: string;
}

export function SCRDetalhamento({ latestDtb }: SCRDetalhamentoProps) {
  // Build grouped operations list matching HBI order
  const groupedOps: GroupedOp[] = [];
  const categoryOrder: CategoryKey[] = ['emprestimos', 'titulos_descontados', 'financiamentos', 'outros_creditos', 'limite'];

  // Group ops by category
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

  // Build flat list with category info
  categoryOrder.forEach(catKey => {
    const ops = opsByCategory[catKey];
    if (ops.length === 0) return;

    ops.forEach(op => {
      const limite = catKey === 'limite';
      const categoryLabel = limite ? 'Limite' : CATEGORY_LABELS[catKey];
      const subLabel = limite
        ? (LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod))
        : getModalidadeLabel(op.mod);

      groupedOps.push({ op, isLimite: limite, category: catKey, categoryLabel, subLabel });
    });
  });

  // Calculate totals per category for the Limite Total header
  const limiteOps = opsByCategory.limite;
  const totalLimite = limiteOps.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">DETALHAMENTO</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Modalidade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center w-[80px]">Cambial</TableHead>
              <TableHead>A vencer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedOps.map((item, i) => {
              const { op, isLimite, category, categoryLabel, subLabel } = item;
              const total = calcTotalVenc(op.resVenc);

              // Check if this is the first limite op to insert "Limite Total" header row
              const isFirstLimite = isLimite && (i === 0 || !groupedOps[i - 1].isLimite);

              const sortedBuckets = Object.entries(op.resVenc)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

              return (
                <> 
                  {isFirstLimite && (
                    <TableRow key={`limite-header-${i}`} className="bg-muted/50 font-semibold">
                      <TableCell className="text-primary font-bold">Limite Total</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(totalLimite)}</TableCell>
                      <TableCell className="text-center text-sm">Não</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      <div>
                        <span className="text-primary font-medium text-sm">{categoryLabel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{subLabel}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm align-top whitespace-nowrap">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell className="text-center text-sm align-top">
                      {op.varCamb === 'S' ? 'Sim' : 'Não'}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        {sortedBuckets.map(([key, val]) => (
                          <div key={key} className="flex justify-between gap-4 text-xs">
                            <span className="text-muted-foreground">{getVencLabel(key, isLimite)}</span>
                            <span className="font-mono whitespace-nowrap">{formatCurrency(val)}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
