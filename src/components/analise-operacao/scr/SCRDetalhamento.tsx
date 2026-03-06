import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DtbEntry, Operacao } from './scr-types';
import {
  CATEGORY_LABELS, CategoryKey, VENCIMENTO_DETALHE_MAP, VENCIMENTO_AVENCER_MAP,
  VENCIMENTO_LIMITE_MAP, LIMITE_SUB_LABELS,
  getDisplayCategory, getModalidadeLabel,
} from './scr-constants';
import { formatCurrency, calcTotalVenc, formatDtb, isLimiteOp, separateVencBuckets } from './scr-utils';

interface SCRDetalhamentoProps {
  latestDtb: DtbEntry;
}

function getVencLabel(key: string, isLimite: boolean): string {
  if (isLimite) return VENCIMENTO_LIMITE_MAP[key] || key;
  return VENCIMENTO_DETALHE_MAP[key] || key;
}

const CHART_COLORS: Record<CategoryKey, string> = {
  emprestimos: 'hsl(var(--primary))',
  titulos_descontados: 'hsl(var(--chart-2))',
  financiamentos: 'hsl(var(--chart-3))',
  outros_creditos: 'hsl(var(--chart-4))',
  limite: 'hsl(var(--chart-5))',
};

const BUCKET_ORDER = ['v110', 'v120', 'v130', 'v140', 'v150', 'v160', 'v165', 'v170', 'v180', 'v190', 'v200'];
const BUCKET_SHORT: Record<string, string> = {
  v110: '30', v120: '60', v130: '90', v140: '180', v150: '360',
  v160: '720', v165: '+720', v170: '1080', v180: '1440', v190: '1800', v200: '+1800',
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)} K`;
  return `R$ ${value.toFixed(0)}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{VENCIMENTO_AVENCER_MAP[label] || label}</p>
      {payload.filter((p: any) => p.value > 0).map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function SCRDetalhamento({ latestDtb }: SCRDetalhamentoProps) {
  const categoryOrder: CategoryKey[] = ['emprestimos', 'titulos_descontados', 'financiamentos', 'outros_creditos', 'limite'];

  const opsByCategory: Record<CategoryKey, Operacao[]> = {
    emprestimos: [], titulos_descontados: [], financiamentos: [], outros_creditos: [], limite: [],
  };

  // Group operations by mod within each category
  const groupByMod = (ops: Operacao[]): Operacao[] => {
    const grouped: Record<string, Operacao> = {};
    ops.forEach(op => {
      if (!grouped[op.mod]) {
        grouped[op.mod] = { ...op, resVenc: { ...op.resVenc } };
      } else {
        Object.entries(op.resVenc).forEach(([k, v]) => {
          grouped[op.mod].resVenc[k] = (grouped[op.mod].resVenc[k] || 0) + v;
        });
        if (op.varCamb === 'S') grouped[op.mod].varCamb = 'S';
      }
    });
    return Object.values(grouped);
  };

  latestDtb.lsOp.forEach(op => {
    const limite = isLimiteOp(op);
    const cat = getDisplayCategory(op.mod, limite);
    opsByCategory[cat].push(op);
  });

  // Apply grouping per category
  (Object.keys(opsByCategory) as CategoryKey[]).forEach(cat => {
    opsByCategory[cat] = groupByMod(opsByCategory[cat]);
  });

  // Build chart data: for each a-vencer bucket, sum values per non-limite category
  const nonLimiteCats = categoryOrder.filter(c => c !== 'limite');
  const activeCats = nonLimiteCats.filter(c => opsByCategory[c].length > 0);

  const chartData = BUCKET_ORDER.map(bucket => {
    const point: Record<string, any> = { bucket, name: BUCKET_SHORT[bucket] || bucket };
    activeCats.forEach(cat => {
      let sum = 0;
      opsByCategory[cat].forEach(op => {
        const { aVencer } = separateVencBuckets(op.resVenc);
        sum += aVencer[bucket] || 0;
      });
      point[cat] = sum;
    });
    return point;
  }).filter(p => activeCats.some(c => (p[c] || 0) > 0));

  const totalGeral = latestDtb.lsOp.filter(op => !isLimiteOp(op)).reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
  const dtbLabel = formatDtb(latestDtb.dtb);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Detalhamento dos Registros — {dtbLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary chart + legend */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} />
                  {activeCats.map(cat => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      name={CATEGORY_LABELS[cat]}
                      stroke={CHART_COLORS[cat]}
                      fill={CHART_COLORS[cat]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 min-w-[180px]">
              <div className="text-right">
                <p className="font-mono text-lg font-bold">{formatCurrency(totalGeral)}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              {activeCats.map(cat => {
                const catTotal = opsByCategory[cat].reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[cat] }} />
                    <div className="text-right flex-1">
                      <p className="font-mono text-sm font-semibold">{formatCurrency(catTotal)}</p>
                      <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detail table */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide mb-4">Detalhamento</h3>
          {categoryOrder.map(catKey => {
            const ops = opsByCategory[catKey];
            if (ops.length === 0) return null;

            const isLimiteCat = catKey === 'limite';
            const catTotal = ops.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);

            return (
              <div key={catKey} className="mb-6">
                <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md mb-2">
                  <span className="font-semibold text-sm text-primary">{CATEGORY_LABELS[catKey]}</span>
                  <span className="font-mono font-semibold text-sm">{formatCurrency(catTotal)}</span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">{isLimiteCat ? 'Tipo' : CATEGORY_LABELS[catKey]}</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center w-[80px]">Cambial</TableHead>
                      <TableHead>A vencer</TableHead>
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

                      const cambial = op.varCamb === 'S' ? 'Sim' : 'Não';

                      return (
                        <TableRow key={i} className="align-top">
                          <TableCell className="text-sm font-medium align-top">{label}</TableCell>
                          <TableCell className="text-right font-mono text-sm align-top whitespace-nowrap">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell className="text-center text-sm align-top">{cambial}</TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-0.5">
                              {sortedBuckets.map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">{getVencLabel(k, isLimiteCat)}</span>
                                  <span className="font-mono ml-4">{formatCurrency(v)}</span>
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
