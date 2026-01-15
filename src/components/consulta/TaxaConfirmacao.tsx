import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CheckCircle2 } from 'lucide-react';

interface TaxaConfirmacaoProps {
  confirmacao: {
    confirmado: { qtd: number; valor: number; percentual: number };
    parcial: { qtd: number; valor: number; percentual: number };
    pendente: { qtd: number; valor: number; percentual: number };
    semConfirmacao: { qtd: number; valor: number; percentual: number };
    total: { qtd: number; valor: number };
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const COLORS = {
  confirmado: '#16a34a',     // green-600
  parcial: '#eab308',        // yellow-500
  pendente: '#f97316',       // orange-500
  semConfirmacao: '#94a3b8', // slate-400
};

export function TaxaConfirmacao({ confirmacao }: TaxaConfirmacaoProps) {
  const chartData = [
    { name: 'Confirmado', value: confirmacao.confirmado.qtd, color: COLORS.confirmado },
    { name: 'Parcial', value: confirmacao.parcial.qtd, color: COLORS.parcial },
    { name: 'Pendente', value: confirmacao.pendente.qtd, color: COLORS.pendente },
    { name: 'Sem Confirmação', value: confirmacao.semConfirmacao.qtd, color: COLORS.semConfirmacao },
  ].filter(d => d.value > 0);

  const total = confirmacao.total.qtd;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Taxa de Confirmação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Gráfico de Pizza */}
          <div className="h-[200px]">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value} títulos`,
                      name
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Sem títulos em aberto
              </div>
            )}
          </div>

          {/* Tabela de Detalhes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                <span className="text-sm font-medium">Confirmado (C)</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">
                  {confirmacao.confirmado.percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {confirmacao.confirmado.qtd} | {formatCurrency(confirmacao.confirmado.valor)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm font-medium">Parcial (CI)</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-yellow-600">
                  {confirmacao.parcial.percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {confirmacao.parcial.qtd} | {formatCurrency(confirmacao.parcial.valor)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm font-medium">Pendente (P)</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-600">
                  {confirmacao.pendente.percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {confirmacao.pendente.qtd} | {formatCurrency(confirmacao.pendente.valor)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                <span className="text-sm font-medium">Sem Confirmação</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-600">
                  {confirmacao.semConfirmacao.percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {confirmacao.semConfirmacao.qtd} | {formatCurrency(confirmacao.semConfirmacao.valor)}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total</span>
                <span className="font-bold">
                  {confirmacao.total.qtd} títulos | {formatCurrency(confirmacao.total.valor)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
