import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DtbEntry } from './scr-types';
import { VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP } from './scr-constants';
import { formatCurrency, separateVencBuckets, isLimiteOp, formatPercentBR } from './scr-utils';

interface SCRCarteiraAtivaProps {
  latestDtb: DtbEntry;
}

const sortBuckets = (entries: [string, number][]) =>
  entries.sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

const SHORT_LABELS: Record<string, string> = {
  'v110': '30',
  'v120': '60',
  'v130': '90',
  'v140': '180',
  'v150': '360',
  'v160': '720',
  'v165': '+720',
  'v170': '1080',
  'v175': '1440',
  'v180': '1800',
  'v190': '5400',
  'v200': '+5400',
};

const SHORT_VENCIDO_LABELS: Record<string, string> = {
  'v10': '+15d',
  'v20': '≤15d',
  'v30': '1-30d',
  'v40': '31-60d',
  'v50': '61-90d',
  'v60': '91-180d',
  'v70': '241-300d',
  'v80': '301-360d',
  'v90': '361-720d',
  'v100': '+720d',
  'v250': 'Indet.',
  'v255': 'Indet.C',
  'v260': 'Indet.L',
};

function formatCompact(value: number): string {
  const fmt = (n: number, frac: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });
  if (value >= 1_000_000) return `R$ ${fmt(value / 1_000_000, 1)} M`;
  if (value >= 1_000) return `R$ ${fmt(value / 1_000, 1)} K`;
  return `R$ ${fmt(value, 0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{payload[0]?.payload?.fullLabel || label}</p>
      <p className="text-primary font-mono">{formatCurrency(payload[0]?.value || 0)}</p>
    </div>
  );
}

function useBuckets(latestDtb: DtbEntry) {
  const aVencerBuckets: Record<string, number> = {};
  const vencidoBuckets: Record<string, number> = {};

  (latestDtb.lsOp || []).filter(op => !isLimiteOp(op)).forEach(op => {
    const { aVencer, vencidos } = separateVencBuckets(op.resVenc);
    // Indeterminado buckets ficam de fora dos dois charts:
    // representam créditos sem vencimento definido, não inadimplência.
    Object.entries(aVencer).forEach(([k, v]) => { aVencerBuckets[k] = (aVencerBuckets[k] || 0) + v; });
    Object.entries(vencidos).forEach(([k, v]) => { vencidoBuckets[k] = (vencidoBuckets[k] || 0) + v; });
  });

  const totalAVencer = Object.values(aVencerBuckets).reduce((s, v) => s + v, 0);
  const totalVencido = Object.values(vencidoBuckets).reduce((s, v) => s + v, 0);

  return { aVencerBuckets, vencidoBuckets, totalAVencer, totalVencido };
}

/** Charts side-by-side: Créditos a Vencer + Créditos Vencidos */
export function SCRCreditosCharts({ latestDtb }: SCRCarteiraAtivaProps) {
  const { aVencerBuckets, vencidoBuckets, totalAVencer, totalVencido } = useBuckets(latestDtb);

  const aVencerData = sortBuckets(Object.entries(aVencerBuckets)).map(([k, v]) => ({
    name: SHORT_LABELS[k] || k,
    fullLabel: VENCIMENTO_AVENCER_MAP[k] || k,
    value: v,
  }));

  const vencidoData = sortBuckets(Object.entries(vencidoBuckets)).map(([k, v]) => ({
    name: SHORT_VENCIDO_LABELS[k] || k,
    fullLabel: VENCIMENTO_VENCIDO_MAP[k] || k,
    value: v,
  }));

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Chart: Créditos a Vencer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">
            Créditos a Vencer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalAVencer === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem créditos a vencer.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aVencerData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {aVencerData.map((_, i) => (
                      <Cell key={i} className="fill-primary" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-sm font-medium mt-2">
                Créditos a vencer | <span className="font-mono">{formatCurrency(totalAVencer)}</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Chart: Créditos Vencidos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-destructive">
            Créditos Vencidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalVencido === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-sm">O documento consultado não possui créditos vencidos.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={vencidoData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {vencidoData.map((_, i) => (
                      <Cell key={i} className="fill-destructive" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-sm font-medium mt-2">
                Créditos vencidos | <span className="font-mono">{formatCurrency(totalVencido)}</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** CARTEIRA ATIVA table combining a vencer + vencidos */
export function SCRCarteiraAtivaTable({ latestDtb }: SCRCarteiraAtivaProps) {
  const { aVencerBuckets, vencidoBuckets, totalAVencer, totalVencido } = useBuckets(latestDtb);
  const totalCarteira = totalAVencer + totalVencido;

  if (totalCarteira === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/10 border-b-2 border-primary/30">
              <TableHead className="font-bold uppercase text-xs text-primary">Carteira Ativa (A)</TableHead>
              <TableHead className="text-right font-bold font-mono text-primary">{formatCurrency(totalCarteira)}</TableHead>
              <TableHead className="text-right font-bold text-primary">100%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* A Vencer subtotal */}
            {totalAVencer > 0 && (
              <>
                <TableRow className="bg-muted/30">
                  <TableCell className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    A Vencer
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(totalAVencer)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {formatPercentBR((totalAVencer / totalCarteira) * 100)}
                  </TableCell>
                </TableRow>
                {sortBuckets(Object.entries(aVencerBuckets)).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="text-sm pl-8">{VENCIMENTO_AVENCER_MAP[key] || key}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatPercentBR((val / totalCarteira) * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            {/* Vencidos subtotal */}
            {totalVencido > 0 && (
              <>
                <TableRow className="bg-destructive/10">
                  <TableCell className="text-sm font-semibold flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Vencido
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-destructive">{formatCurrency(totalVencido)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-destructive">
                    {formatPercentBR((totalVencido / totalCarteira) * 100)}
                  </TableCell>
                </TableRow>
                {sortBuckets(Object.entries(vencidoBuckets)).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="text-sm pl-8 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-destructive/60" />
                      {VENCIMENTO_VENCIDO_MAP[key] || key}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatPercentBR((val / totalCarteira) * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Keep legacy exports for backward compatibility with PDF export
export function SCRCreditosAVencer({ latestDtb }: SCRCarteiraAtivaProps) {
  return null; // Replaced by SCRCreditosCharts
}

export function SCRCreditosVencidos({ latestDtb }: SCRCarteiraAtivaProps) {
  return null; // Replaced by SCRCreditosCharts
}
