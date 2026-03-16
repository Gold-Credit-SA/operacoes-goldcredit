import { TrendingUp, Wallet2 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SaldoTrustee {
  cpf_cnpj: string;
  nome: string;
  saldo_trustee: number;
}

interface Props {
  saldoTrustee: SaldoTrustee[];
  loading?: boolean;
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

const COLORS = [
  '#A77128',
  '#C08A3D',
  '#D8A85A',
  '#E3B76E',
  '#EEC780',
  '#F4D795',
  '#FBDC99',
  '#FFF6D9',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{d.nome}</p>
      <p className="text-muted-foreground">{formatCurrency(d.saldo_trustee)}</p>
    </div>
  );
};

const TrendTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{d.label}</p>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
    </div>
  );
};

export function SaldosCard({ saldoTrustee, loading, className }: Props) {
  const total = saldoTrustee.reduce((sum, item) => sum + item.saldo_trustee, 0);
  const sorted = [...saldoTrustee].sort((a, b) => b.saldo_trustee - a.saldo_trustee);
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8);
  const restTotal = rest.reduce((sum, item) => sum + item.saldo_trustee, 0);
  const average = saldoTrustee.length > 0 ? total / saldoTrustee.length : 0;
  const highest = sorted[0]?.saldo_trustee || 0;
  const concentration = total > 0 ? (highest / total) * 100 : 0;

  const chartData = top.map((item) => ({
    ...item,
    label: item.nome.length > 20 ? `${item.nome.slice(0, 18)}...` : item.nome,
  }));

  if (rest.length > 0) {
    chartData.push({
      cpf_cnpj: '__others__',
      nome: `+ ${rest.length} outros`,
      saldo_trustee: restTotal,
      label: `+ ${rest.length} outros`,
    });
  }

  const trendData = chartData.map((item) => ({
    label: item.label,
    value: item.saldo_trustee,
  }));

  return (
    <Card className={cn('overflow-hidden border-slate-200/80 shadow-sm', className)}>
      <CardHeader className="border-b border-[#EEC780]/20 bg-[linear-gradient(135deg,#3f2615,#8B5A22_52%,#D49F56_100%)] pb-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-base text-white">
            Saldo Trustee
          </CardTitle>
          {!loading && saldoTrustee.length > 0 && (
            <Badge className="border-[#FFF6D9]/40 bg-[#FFF6D9]/10 font-mono text-xs text-white hover:bg-[#FFF6D9]/10">
              {formatCompact(total)}
            </Badge>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#FFF6D9]/24 bg-[linear-gradient(135deg,rgba(63,38,21,0.32),rgba(139,90,34,0.22))] px-4 py-3 backdrop-blur">
            <span className="text-[11px] uppercase tracking-[0.24em] text-[#FFF6D9]/88">Total consolidado</span>
            <p className="mt-2 text-2xl font-semibold tracking-tight truncate" title={loading ? '' : formatCurrency(total)}>
              {loading ? '...' : formatCurrency(total)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#FFF6D9]/24 bg-[linear-gradient(135deg,rgba(91,52,24,0.30),rgba(170,113,40,0.20))] px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[#FFF6D9]/88">
              <Wallet2 className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-[0.24em]">Ticket medio</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{loading ? '...' : formatCompact(average)}</p>
          </div>

          <div className="rounded-2xl border border-[#FFF6D9]/24 bg-[linear-gradient(135deg,rgba(106,67,28,0.34),rgba(212,159,86,0.14))] px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[#FFF6D9]/88">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-[0.24em]">Maior concentracao</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{loading ? '...' : `${concentration.toFixed(1)}%`}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 bg-[linear-gradient(180deg,rgba(248,250,252,0.78),rgba(255,255,255,1))] p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : saldoTrustee.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum saldo trustee encontrado</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Leitura de concentracao</p>
                    <p className="text-xs text-muted-foreground">
                      Curva dos maiores saldos da carteira atual
                    </p>
                  </div>
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        {saldoTrustee.length} cedente(s)
                      </Badge>
                </div>

                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="saldoTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#A77128" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#A77128" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#A77128"
                        strokeWidth={3}
                        fill="url(#saldoTrendFill)"
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Maior saldo</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(highest)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{sorted[0]?.nome || 'Sem dados'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Participacao do lider</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{concentration.toFixed(1)}%</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#A77128,#EEC780)]"
                      style={{ width: `${Math.min(concentration, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#AA7128]/60 bg-[linear-gradient(135deg,#1c1917,#AA7128)] p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">Leitura rapida</p>
                  <p className="mt-2 text-sm leading-6 text-white/82">
                    {sorted[0]?.nome
                      ? `${sorted[0].nome} lidera a carteira de saldo trustee e define a principal concentracao do painel atual.`
                      : 'Nenhuma leitura disponivel no momento.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Ranking de cedentes</p>
                <p className="text-xs text-muted-foreground">
                  Comparativo dos maiores saldos individuais e agrupamento dos demais
                </p>
              </div>

              <div style={{ width: '100%', height: Math.max(220, chartData.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 18, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={132}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.42)' }} />
                    <Bar dataKey="saldo_trustee" radius={[0, 8, 8, 0]} barSize={22}>
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
