import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ResumoPorMes {
  mes: string;
  bruto: number;
  liquido: number;
  receita: number;
  count: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
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

export function ResumoPeriodo() {
  const [data, setData] = useState<ResumoPorMes[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('dashboard-data', {
          body: { action: 'resumo-por-periodo' }
        });

        if (error) throw error;
        if (result?.success) {
          setData(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching resumo:', err);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum dado de resumo disponível
        </CardContent>
      </Card>
    );
  }

  const chartData = [...data].reverse().slice(-12);

  const totals = data.reduce(
    (acc, item) => ({
      bruto: acc.bruto + item.bruto,
      liquido: acc.liquido + item.liquido,
      receita: acc.receita + item.receita,
      count: acc.count + item.count,
    }),
    { bruto: 0, liquido: 0, receita: 0, count: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Mensal (Últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tickFormatter={formatMonth}
                  className="text-xs"
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrencyFull(value)}
                  labelFormatter={formatMonth}
                />
                <Legend />
                <Bar dataKey="bruto" name="Valor Bruto" fill="hsl(221, 83%, 53%)" />
                <Bar dataKey="liquido" name="Valor Líquido" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="receita" name="Receita" fill="hsl(45, 93%, 47%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Bruto</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyFull(totals.bruto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Líquido</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrencyFull(totals.liquido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Receita</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrencyFull(totals.receita)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Operações</p>
            <p className="text-2xl font-bold">{totals.count.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Operações</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Valor Líquido</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.mes}>
                    <TableCell className="font-medium">{formatMonth(item.mes)}</TableCell>
                    <TableCell className="text-right">{item.count.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{formatCurrencyFull(item.bruto)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrencyFull(item.liquido)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600 font-medium">
                      {formatCurrencyFull(item.receita)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
