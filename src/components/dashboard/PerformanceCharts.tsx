import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';

interface MonthlyData {
  mes: string;
  bruto: number;
  liquido: number;
  receita: number;
  count: number;
  meta?: number;
}

interface TopCedente {
  nome: string;
  valor: number;
  operacoes: number;
}

interface PerformanceChartsProps {
  monthlyData: MonthlyData[];
  topCedentes: TopCedente[];
  titulosDistribution: {
    aberto: number;
    quitado: number;
    prorrogado: number;
    recomprado: number;
  };
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

const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export function PerformanceCharts({ monthlyData, topCedentes, titulosDistribution }: PerformanceChartsProps) {
  const chartData = [...monthlyData].reverse().slice(-12);
  
  // Calculate average for goal line
  const avgBruto = chartData.reduce((acc, d) => acc + d.bruto, 0) / chartData.length;
  const chartDataWithGoal = chartData.map(d => ({ ...d, meta: avgBruto * 1.1 }));

  const pieData = [
    { name: 'Quitados', value: titulosDistribution.quitado, color: '#10b981' },
    { name: 'Em Aberto', value: titulosDistribution.aberto, color: '#f59e0b' },
    { name: 'Prorrogados', value: titulosDistribution.prorrogado, color: '#8b5cf6' },
    { name: 'Recomprados', value: titulosDistribution.recomprado, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Volume vs Meta */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Volume Operado vs Meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartDataWithGoal}>
                <defs>
                  <linearGradient id="gradientBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrencyFull(value),
                    name === 'bruto' ? 'Volume Bruto' : name === 'meta' ? 'Meta' : name
                  ]}
                  labelFormatter={formatMonth}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="bruto" 
                  name="Volume Bruto"
                  stroke="hsl(221, 83%, 53%)" 
                  fill="url(#gradientBruto)"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="meta" 
                  name="Meta (+10%)"
                  stroke="#ef4444" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Receita Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução da Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradientReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrencyFull(value), 'Receita']}
                  labelFormatter={formatMonth}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="receita" 
                  stroke="#10b981" 
                  fill="url(#gradientReceita)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Títulos Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Títulos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Cedentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Cedentes por Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={topCedentes.slice(0, 10)} 
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis 
                  type="number"
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 10 }}
                  width={100}
                  tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrencyFull(value), 'Volume']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Operations Count Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quantidade de Operações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Operações']}
                  labelFormatter={formatMonth}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
