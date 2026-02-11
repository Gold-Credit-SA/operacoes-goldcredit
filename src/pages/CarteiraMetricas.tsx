import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw, Users, DollarSign, AlertCircle, TrendingUp, Activity,
  BarChart3, PieChart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';

interface Metricas {
  total_cedentes: number;
  total_limite: number;
  total_risco: number;
  total_disponivel: number;
  total_operacoes_30d: number;
}

interface CedenteCarteira {
  cpf_cnpj: string;
  nome?: string;
  limite_global?: number;
  limite_disponivel?: number;
  risco_atual?: number;
  bloqueado?: string;
  dias_inativo?: number;
  setor?: string;
  uf?: string;
}

const COLORS = [
  'hsl(38, 67%, 67%)', 'hsl(142, 71%, 45%)', 'hsl(0, 72%, 51%)',
  'hsl(220, 70%, 55%)', 'hsl(280, 60%, 55%)', 'hsl(180, 60%, 45%)',
];

export default function CarteiraMetricas() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [cedentes, setCedentes] = useState<CedenteCarteira[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatCurrencyShort = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
    return formatCurrency(value);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'my-portfolio' },
      });
      if (error) throw error;
      if (data.success) {
        setMetricas(data.metricas);
        setCedentes(data.cedentes);
      }
    } catch (error) {
      toast({ title: "Erro ao carregar métricas", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Derived data for charts
  const utilizacao = metricas ? [
    { name: 'Risco Atual', value: metricas.total_risco },
    { name: 'Disponível', value: metricas.total_disponivel },
  ] : [];

  const inatividade = [
    { faixa: 'Ativos (≤7d)', count: cedentes.filter(c => c.dias_inativo != null && c.dias_inativo <= 7).length },
    { faixa: '8-30 dias', count: cedentes.filter(c => c.dias_inativo != null && c.dias_inativo > 7 && c.dias_inativo <= 30).length },
    { faixa: '31-60 dias', count: cedentes.filter(c => c.dias_inativo != null && c.dias_inativo > 30 && c.dias_inativo <= 60).length },
    { faixa: '60+ dias', count: cedentes.filter(c => c.dias_inativo != null && c.dias_inativo > 60).length },
    { faixa: 'Sem operação', count: cedentes.filter(c => c.dias_inativo == null).length },
  ].filter(f => f.count > 0);

  // Top cedentes by risco
  const topRisco = [...cedentes]
    .sort((a, b) => (b.risco_atual || 0) - (a.risco_atual || 0))
    .slice(0, 8)
    .map(c => ({
      nome: (c.nome || 'Sem nome').substring(0, 20),
      risco: c.risco_atual || 0,
      limite: c.limite_global || 0,
    }));

  // By UF
  const byUf: Record<string, number> = {};
  cedentes.forEach(c => {
    const uf = c.uf || 'N/A';
    byUf[uf] = (byUf[uf] || 0) + 1;
  });
  const ufData = Object.entries(byUf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  return (
    <MainLayout title="Métricas da Carteira" subtitle="Indicadores de performance e acompanhamento da sua carteira">
      <div className="space-y-6">
        {/* Refresh */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Cedentes', value: metricas?.total_cedentes ?? '-', icon: Users, color: 'text-primary' },
            { label: 'Limite Total', value: metricas ? formatCurrency(metricas.total_limite) : '-', icon: DollarSign, color: 'text-primary' },
            { label: 'Risco Atual', value: metricas ? formatCurrency(metricas.total_risco) : '-', icon: AlertCircle, color: 'text-destructive' },
            { label: 'Disponível', value: metricas ? formatCurrency(metricas.total_disponivel) : '-', icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Operações (30d)', value: metricas?.total_operacoes_30d ?? '-', icon: Activity, color: 'text-primary' },
          ].map(m => (
            <Card key={m.label}>
              <CardContent className="p-4 flex items-center gap-3">
                {isLoading ? <Skeleton className="h-12 w-full" /> : (
                  <>
                    <m.icon className={`h-6 w-6 shrink-0 ${m.color}`} />
                    <div className="min-w-0">
                      <p className="text-lg font-bold truncate">{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Utilização de Limite */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4" /> Utilização de Limite
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[250px] w-full" /> : utilizacao.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={utilizacao}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {utilizacao.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? 'hsl(0, 72%, 51%)' : 'hsl(142, 71%, 45%)'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Inatividade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Inatividade dos Cedentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[250px] w-full" /> : inatividade.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={inatividade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                    <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Cedentes" fill="hsl(38, 67%, 67%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Risco */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Maiores Exposições (Risco)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[280px] w-full" /> : topRisco.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topRisco} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="risco" name="Risco" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* By UF */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4" /> Distribuição por UF
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[280px] w-full" /> : ufData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={ufData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {ufData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
