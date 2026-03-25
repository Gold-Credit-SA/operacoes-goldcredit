import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { DtbEntry, Operacao } from './scr-types';
import {
  CATEGORY_LABELS, CategoryKey, VENCIMENTO_DETALHE_MAP, VENCIMENTO_AVENCER_MAP,
  VENCIMENTO_LIMITE_MAP, LIMITE_SUB_LABELS,
  getDisplayCategory, getModalidadeLabel, sortOpsByPriority,
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

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  emprestimos: <TrendingUp className="h-5 w-5 text-primary" />,
  titulos_descontados: <BarChart3 className="h-5 w-5 text-chart-2" />,
  financiamentos: <DollarSign className="h-5 w-5 text-chart-3" />,
  outros_creditos: <BarChart3 className="h-5 w-5 text-chart-4" />,
};

const BUCKET_AVENCER_ORDER = ['v110', 'v120', 'v130', 'v140', 'v150', 'v160', 'v165', 'v170', 'v175', 'v180', 'v190', 'v200'];
const BUCKET_VENCIDO_ORDER = ['v20', 'v30', 'v40', 'v50', 'v60', 'v70', 'v80', 'v90', 'v100'];
const BUCKET_SHORT: Record<string, string> = {
  v20: '≤15d', v30: '1-30d', v40: '31-60d', v50: '61-90d', v60: '91-180d',
  v70: '241-300d', v80: '301-360d', v90: '361-720d', v100: '+720d',
  v110: '30', v120: '60', v130: '90', v140: '180', v150: '360',
  v160: '720', v165: '+720', v170: '1080', v175: '1440', v180: '1800', v190: '5400', v200: '+5400',
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

export function SCRDetalhamento({ latestDtb }: SCRDetalhamentoProps) {
  const categoryOrder: CategoryKey[] = ['emprestimos', 'titulos_descontados', 'financiamentos', 'outros_creditos', 'limite'];

  const opsByCategory: Record<CategoryKey, Operacao[]> = {
    emprestimos: [], titulos_descontados: [], financiamentos: [], outros_creditos: [], limite: [],
  };

  (latestDtb.lsOp || []).forEach(op => {
    const limite = isLimiteOp(op);
    const cat = getDisplayCategory(op.mod, limite);
    opsByCategory[cat].push(op);
  });

  (Object.keys(opsByCategory) as CategoryKey[]).forEach(cat => {
    opsByCategory[cat] = sortOpsByPriority(groupByMod(opsByCategory[cat]));
  });

  const nonLimiteCats = categoryOrder.filter(c => c !== 'limite');
  const activeCats = nonLimiteCats.filter(c => opsByCategory[c].length > 0);

  // Build chart data for a-vencer buckets
  const aVencerChartData = BUCKET_AVENCER_ORDER.map(bucket => {
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

  // Build chart data for vencido buckets
  const vencidoChartData = BUCKET_VENCIDO_ORDER.map(bucket => {
    const point: Record<string, any> = { bucket, name: BUCKET_SHORT[bucket] || bucket };
    activeCats.forEach(cat => {
      let sum = 0;
      opsByCategory[cat].forEach(op => {
        const { vencidos } = separateVencBuckets(op.resVenc);
        sum += vencidos[bucket] || 0;
      });
      point[cat] = sum;
    });
    return point;
  }).filter(p => activeCats.some(c => (p[c] || 0) > 0));

  const hasAVencerChart = aVencerChartData.length > 0;
  const hasVencidoChart = vencidoChartData.length > 0;

  const totalGeral = (latestDtb.lsOp || []).filter(op => !isLimiteOp(op)).reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
  const dtbLabel = formatDtb(latestDtb.dtb);

  // Use whichever chart has data; prefer a-vencer, fallback to vencido
  const chartData = hasAVencerChart ? aVencerChartData : vencidoChartData;
  const hasChart = chartData.length > 0;

  return (
    <div className="space-y-6">
      {/* Detalhamento dos registros - Chart + Summary side by side */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Detalhamento dos registros — {dtbLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            {/* Chart */}
            <div>
              {hasChart ? (
                <div className="space-y-2">
                  {!hasAVencerChart && hasVencidoChart && (
                    <p className="text-xs font-medium text-destructive uppercase tracking-wide">Créditos Vencidos</p>
                  )}
                  {hasAVencerChart && (
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">Créditos a Vencer</p>
                  )}
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} width={80} />
                      <Tooltip content={<ChartTooltip />} />
                      {activeCats.map(cat => (
                        <Area
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          name={CATEGORY_LABELS[cat]}
                          stroke={hasAVencerChart ? CHART_COLORS[cat] : 'hsl(var(--destructive))'}
                          fill={hasAVencerChart ? CHART_COLORS[cat] : 'hsl(var(--destructive))'}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  Sem dados para exibir no gráfico.
                </div>
              )}
            </div>

            {/* Summary panel on the right */}
            <div className="flex flex-col justify-center space-y-5">
              <div>
                <p className="font-mono text-2xl font-bold">{formatCurrency(totalGeral)}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              {nonLimiteCats.map(cat => {
                const catTotal = opsByCategory[cat].reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CHART_COLORS[cat]}20` }}>
                      {CATEGORY_ICONS[cat] || <BarChart3 className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold">{formatCurrency(catTotal)}</p>
                      <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryOrder.map(catKey => {
            const ops = opsByCategory[catKey];
            if (ops.length === 0) return null;

            const isLimiteCat = catKey === 'limite';

            return (
              <div key={catKey} className="mb-6 last:mb-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/10 border-b border-primary/20">
                      <TableHead className="text-primary font-semibold">Modalidade</TableHead>
                      <TableHead className="text-right text-primary font-semibold">Valor</TableHead>
                      <TableHead className="text-center text-primary font-semibold w-[80px]">Cambial</TableHead>
                      <TableHead className="text-primary font-semibold">A vencer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ops.map((op, i) => {
                      const total = calcTotalVenc(op.resVenc);
                      const label = isLimiteCat
                        ? (LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod))
                        : getModalidadeLabel(op.mod);

                      const { aVencer, vencidos } = separateVencBuckets(op.resVenc);
                      const totalAVencer = Object.values(aVencer).reduce((s, v) => s + v, 0);
                      const totalVencido = Object.values(vencidos).reduce((s, v) => s + v, 0);

                      const sortedAVencer = Object.entries(aVencer)
                        .filter(([, v]) => v > 0)
                        .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

                      const sortedVencidos = Object.entries(vencidos)
                        .filter(([, v]) => v > 0)
                        .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

                      const cambial = op.varCamb === 'S' ? 'Sim' : 'Não';

                      // Category label row
                      const catLabel = isLimiteCat
                        ? CATEGORY_LABELS.limite
                        : CATEGORY_LABELS[catKey];

                      return (
                        <>
                          {i === 0 && (
                            <TableRow key={`header-${catKey}`} className="bg-muted/30">
                              <TableCell colSpan={4} className="text-sm font-semibold text-primary">
                                {catLabel}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow key={i} className="align-top">
                            <TableCell className="text-sm font-medium align-top pl-6">{label}</TableCell>
                            <TableCell className="text-right font-mono text-sm align-top whitespace-nowrap">
                              {formatCurrency(total)}
                            </TableCell>
                            <TableCell className="text-center text-sm align-top">{cambial}</TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-0.5">
                                {sortedAVencer.map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">{getVencLabel(k, isLimiteCat)}</span>
                                    <span className="font-mono ml-4">{formatCurrency(v)}</span>
                                  </div>
                                ))}
                                {sortedVencidos.map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-xs">
                                    <span className="text-destructive/80">{getVencLabel(k, isLimiteCat)}</span>
                                    <span className="font-mono ml-4">{formatCurrency(v)}</span>
                                  </div>
                                ))}
                                {/* Totals */}
                                {totalAVencer > 0 && (
                                  <div className="flex justify-between text-xs font-semibold border-t border-border/50 pt-1 mt-1">
                                    <span>Total A Vencer</span>
                                    <span className="font-mono ml-4">{formatCurrency(totalAVencer)}</span>
                                  </div>
                                )}
                                {totalVencido > 0 && (
                                  <div className="flex justify-between text-xs font-semibold text-destructive border-t border-border/50 pt-1 mt-0.5">
                                    <span>Total Vencido</span>
                                    <span className="font-mono ml-4">{formatCurrency(totalVencido)}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
