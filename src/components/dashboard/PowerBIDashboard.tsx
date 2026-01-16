import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from './KPICard';
import { InsightsPanel } from './InsightsPanel';
import { GoalsProgress } from './GoalsProgress';
import { PerformanceCharts } from './PerformanceCharts';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Percent,
  Target
} from 'lucide-react';

interface DashboardData {
  stats: {
    counts: {
      cedentes: number;
      operacoes: number;
      receitas: number;
      titulosAberto: number;
      titulosQuitados: number;
      titulosProrrogados: number;
      titulosRecomprados: number;
    };
    totals: {
      receita: number;
      operacoesBruto: number;
      operacoesLiquido: number;
      operacoesReceita: number;
    };
  };
  monthlyData: Array<{
    mes: string;
    bruto: number;
    liquido: number;
    receita: number;
    count: number;
  }>;
  topCedentes: Array<{
    nome: string;
    valor: number;
    operacoes: number;
  }>;
  previousPeriod?: {
    receita: number;
    operacoes: number;
    bruto: number;
  };
}

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  metric?: string;
  icon?: 'trend-up' | 'trend-down' | 'users' | 'dollar' | 'clock' | 'check' | 'x';
}

export function PowerBIDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all data in parallel
        const [statsRes, resumoRes, topRes] = await Promise.all([
          supabase.functions.invoke('dashboard-data', { body: { action: 'stats' } }),
          supabase.functions.invoke('dashboard-data', { body: { action: 'resumo-por-periodo' } }),
          supabase.functions.invoke('dashboard-data', { body: { action: 'top-cedentes' } }),
        ]);

        const stats = statsRes.data?.success ? statsRes.data.data : null;
        const monthlyData = resumoRes.data?.success ? resumoRes.data.data : [];
        const topCedentes = topRes.data?.success ? topRes.data.data : [];

        // Calculate previous period comparison
        let previousPeriod = undefined;
        if (monthlyData.length >= 2) {
          const sortedData = [...monthlyData].sort((a, b) => b.mes.localeCompare(a.mes));
          const current = sortedData[0];
          const previous = sortedData[1];
          if (current && previous) {
            previousPeriod = {
              receita: previous.receita,
              operacoes: previous.count,
              bruto: previous.bruto,
            };
          }
        }

        if (stats) {
          setData({
            stats,
            monthlyData: monthlyData || [],
            topCedentes: topCedentes || [],
            previousPeriod,
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[400px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  const { stats, monthlyData, topCedentes, previousPeriod } = data;

  // Calculate trends
  const sortedMonthly = [...monthlyData].sort((a, b) => b.mes.localeCompare(a.mes));
  const currentMonth = sortedMonthly[0];
  const lastMonth = sortedMonthly[1];

  const receitaTrend = lastMonth && currentMonth 
    ? ((currentMonth.receita - lastMonth.receita) / lastMonth.receita) * 100 
    : 0;
  const operacoesTrend = lastMonth && currentMonth
    ? ((currentMonth.count - lastMonth.count) / lastMonth.count) * 100
    : 0;
  const brutoTrend = lastMonth && currentMonth
    ? ((currentMonth.bruto - lastMonth.bruto) / lastMonth.bruto) * 100
    : 0;

  // Calculate metrics
  const taxaLiquidacao = stats.counts.titulosQuitados / 
    (stats.counts.titulosAberto + stats.counts.titulosQuitados) * 100 || 0;
  const taxaRecompra = stats.counts.titulosRecomprados / 
    (stats.counts.titulosAberto + stats.counts.titulosQuitados + stats.counts.titulosRecomprados) * 100 || 0;
  const spreadMedio = stats.totals.operacoesBruto > 0
    ? ((stats.totals.operacoesBruto - stats.totals.operacoesLiquido) / stats.totals.operacoesBruto) * 100
    : 0;
  const ticketMedio = stats.counts.operacoes > 0
    ? stats.totals.operacoesBruto / stats.counts.operacoes
    : 0;

  // Generate insights
  const insights: Insight[] = [];

  if (taxaLiquidacao >= 90) {
    insights.push({
      id: '1',
      type: 'success',
      title: 'Excelente Taxa de Liquidação',
      description: `Taxa de liquidação de ${taxaLiquidacao.toFixed(1)}% indica boa qualidade de carteira.`,
      metric: `${taxaLiquidacao.toFixed(1)}%`,
      icon: 'check',
    });
  } else if (taxaLiquidacao < 70) {
    insights.push({
      id: '1',
      type: 'danger',
      title: 'Atenção: Taxa de Liquidação Baixa',
      description: `Taxa de ${taxaLiquidacao.toFixed(1)}% está abaixo do esperado. Revisar critérios de análise.`,
      metric: `${taxaLiquidacao.toFixed(1)}%`,
      icon: 'x',
    });
  }

  if (taxaRecompra > 5) {
    insights.push({
      id: '2',
      type: 'warning',
      title: 'Taxa de Recompra Elevada',
      description: `${taxaRecompra.toFixed(1)}% de recompras. Avaliar concentração por cedente.`,
      metric: `${taxaRecompra.toFixed(1)}%`,
      icon: 'trend-down',
    });
  }

  if (receitaTrend > 10) {
    insights.push({
      id: '3',
      type: 'success',
      title: 'Crescimento de Receita',
      description: `Receita cresceu ${receitaTrend.toFixed(1)}% em relação ao mês anterior.`,
      metric: `+${receitaTrend.toFixed(1)}%`,
      icon: 'trend-up',
    });
  } else if (receitaTrend < -10) {
    insights.push({
      id: '3',
      type: 'danger',
      title: 'Queda na Receita',
      description: `Receita caiu ${Math.abs(receitaTrend).toFixed(1)}% em relação ao mês anterior.`,
      metric: `${receitaTrend.toFixed(1)}%`,
      icon: 'trend-down',
    });
  }

  if (stats.counts.titulosProrrogados > stats.counts.titulosAberto * 0.2) {
    insights.push({
      id: '4',
      type: 'warning',
      title: 'Alto Volume de Prorrogações',
      description: 'Mais de 20% dos títulos estão prorrogados. Verificar situação dos cedentes.',
      icon: 'clock',
    });
  }

  // Dynamic goals based on average performance
  const avgBruto = monthlyData.length > 0
    ? monthlyData.reduce((acc, d) => acc + d.bruto, 0) / monthlyData.length
    : 0;
  const avgReceita = monthlyData.length > 0
    ? monthlyData.reduce((acc, d) => acc + d.receita, 0) / monthlyData.length
    : 0;
  const avgOperacoes = monthlyData.length > 0
    ? monthlyData.reduce((acc, d) => acc + d.count, 0) / monthlyData.length
    : 0;

  const goals = [
    {
      id: '1',
      name: 'Volume Operado Mensal',
      current: currentMonth?.bruto || 0,
      target: avgBruto * 1.1,
      format: 'currency' as const,
      period: 'Meta: +10% sobre média',
    },
    {
      id: '2',
      name: 'Receita Mensal',
      current: currentMonth?.receita || 0,
      target: avgReceita * 1.1,
      format: 'currency' as const,
      period: 'Meta: +10% sobre média',
    },
    {
      id: '3',
      name: 'Operações Mensais',
      current: currentMonth?.count || 0,
      target: Math.ceil(avgOperacoes * 1.1),
      format: 'number' as const,
      period: 'Meta: +10% sobre média',
    },
    {
      id: '4',
      name: 'Taxa de Liquidação',
      current: taxaLiquidacao,
      target: 95,
      format: 'percent' as const,
      period: 'Meta: 95%',
    },
  ];

  const titulosDistribution = {
    aberto: stats.counts.titulosAberto,
    quitado: stats.counts.titulosQuitados,
    prorrogado: stats.counts.titulosProrrogados,
    recomprado: stats.counts.titulosRecomprados,
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Volume Bruto"
          value={stats.totals.operacoesBruto}
          format="currency"
          icon={DollarSign}
          color="primary"
          trend={brutoTrend > 0 ? 'up' : brutoTrend < 0 ? 'down' : 'neutral'}
          trendValue={`${brutoTrend > 0 ? '+' : ''}${brutoTrend.toFixed(1)}%`}
        />
        <KPICard
          title="Receita Total"
          value={stats.totals.receita}
          format="currency"
          icon={TrendingUp}
          color="success"
          trend={receitaTrend > 0 ? 'up' : receitaTrend < 0 ? 'down' : 'neutral'}
          trendValue={`${receitaTrend > 0 ? '+' : ''}${receitaTrend.toFixed(1)}%`}
        />
        <KPICard
          title="Total de Operações"
          value={stats.counts.operacoes}
          format="number"
          icon={FileText}
          color="info"
          trend={operacoesTrend > 0 ? 'up' : operacoesTrend < 0 ? 'down' : 'neutral'}
          trendValue={`${operacoesTrend > 0 ? '+' : ''}${operacoesTrend.toFixed(1)}%`}
        />
        <KPICard
          title="Cedentes Ativos"
          value={stats.counts.cedentes}
          format="number"
          icon={Users}
          color="warning"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Taxa de Liquidação"
          value={taxaLiquidacao}
          format="percent"
          icon={CheckCircle}
          color={taxaLiquidacao >= 85 ? 'success' : taxaLiquidacao >= 70 ? 'warning' : 'danger'}
          target={95}
          current={taxaLiquidacao}
        />
        <KPICard
          title="Taxa de Recompra"
          value={taxaRecompra}
          format="percent"
          icon={AlertTriangle}
          color={taxaRecompra <= 3 ? 'success' : taxaRecompra <= 5 ? 'warning' : 'danger'}
        />
        <KPICard
          title="Spread Médio"
          value={spreadMedio}
          format="percent"
          icon={Percent}
          color="info"
        />
        <KPICard
          title="Ticket Médio"
          value={ticketMedio}
          format="currency"
          icon={Target}
          color="primary"
        />
      </div>

      {/* Insights and Goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InsightsPanel insights={insights} />
        </div>
        <GoalsProgress goals={goals} />
      </div>

      {/* Charts */}
      <PerformanceCharts
        monthlyData={monthlyData}
        topCedentes={topCedentes}
        titulosDistribution={titulosDistribution}
      />
    </div>
  );
}
