import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SaldoTrustee {
  cpf_cnpj: string;
  nome: string;
  saldo_trustee: number;
}

interface Props {
  saldoTrustee: SaldoTrustee[];
  loading?: boolean;
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
  'hsl(217, 91%, 60%)',
  'hsl(217, 80%, 68%)',
  'hsl(217, 70%, 74%)',
  'hsl(217, 60%, 78%)',
  'hsl(217, 50%, 82%)',
  'hsl(217, 40%, 86%)',
  'hsl(217, 30%, 88%)',
  'hsl(217, 25%, 90%)',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium mb-1">{d.nome}</p>
      <p className="text-muted-foreground">{formatCurrency(d.saldo_trustee)}</p>
    </div>
  );
};

export function SaldosCard({ saldoTrustee, loading }: Props) {
  const total = saldoTrustee.reduce((sum, s) => sum + s.saldo_trustee, 0);

  // Prepare chart data: top 8, rest grouped
  const sorted = [...saldoTrustee].sort((a, b) => b.saldo_trustee - a.saldo_trustee);
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8);
  const restTotal = rest.reduce((s, x) => s + x.saldo_trustee, 0);

  const chartData = top.map(s => ({
    ...s,
    label: s.nome.length > 18 ? s.nome.slice(0, 16) + '…' : s.nome,
  }));
  if (rest.length > 0) {
    chartData.push({
      cpf_cnpj: '__others__',
      nome: `+ ${rest.length} outros`,
      saldo_trustee: restTotal,
      label: `+ ${rest.length} outros`,
    });
  }

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            Saldo Trustee
          </CardTitle>
          {!loading && saldoTrustee.length > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              {formatCompact(total)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-48 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : saldoTrustee.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum saldo trustee encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <span className="text-xs text-muted-foreground">Total consolidado · {saldoTrustee.length} cedente(s)</span>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Chart */}
            <div style={{ width: '100%', height: Math.max(180, chartData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                  <Bar dataKey="saldo_trustee" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
