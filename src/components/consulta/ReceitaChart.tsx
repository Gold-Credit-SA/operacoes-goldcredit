import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign } from 'lucide-react';

interface ReceitaChartProps {
  receitaMensal: Array<{
    mes: string;
    valor: number;
  }>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatMonth = (mes: string) => {
  const [year, month] = mes.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
};

export function ReceitaChart({ receitaMensal }: ReceitaChartProps) {
  const chartData = [...receitaMensal].reverse();
  const totalReceita = receitaMensal.reduce((acc, r) => acc + r.valor, 0);
  const mediaReceita = receitaMensal.length > 0 ? totalReceita / receitaMensal.length : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-green-600" />
          Receita Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhum dado de receita disponível
          </div>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="mes" 
                    tickFormatter={formatMonth}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                    width={60}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrencyFull(value), 'Receita']}
                    labelFormatter={formatMonth}
                  />
                  <Bar dataKey="valor" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-950">
                <p className="text-xs text-muted-foreground">Total no Período</p>
                <p className="text-lg font-bold text-green-600">{formatCurrencyFull(totalReceita)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950">
                <p className="text-xs text-muted-foreground">Média Mensal</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrencyFull(mediaReceita)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
