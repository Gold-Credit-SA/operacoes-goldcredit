import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { formatCurrency, formatDtb, calcCarteiraAtiva } from './scr-utils';

interface SCRHistoricoProps {
  lsDtb: DtbEntry[];
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function SCRHistorico({ lsDtb }: SCRHistoricoProps) {
  if (lsDtb.length <= 1) return null;

  const chartData = lsDtb.map(dtb => ({
    name: formatDtb(dtb.dtb),
    total: calcCarteiraAtiva(dtb),
    instituicoes: dtb.qtdIfs,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Histórico Mensal de Endividamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} width={80} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Carteira Ativa</TableHead>
              <TableHead className="text-right">Instituições</TableHead>
              <TableHead className="text-right">Doc. Proc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lsDtb.map((dtb) => (
              <TableRow key={dtb.dtb}>
                <TableCell className="font-medium">{formatDtb(dtb.dtb)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(calcCarteiraAtiva(dtb))}</TableCell>
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
