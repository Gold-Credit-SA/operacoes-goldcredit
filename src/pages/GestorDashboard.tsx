import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Users, DollarSign, Briefcase, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProximosAniversariantesCard } from '@/components/painel/ProximosAniversariantesCard';
import { ChequesDevolvidosCard } from '@/components/painel/ChequesDevolvidosCard';
import { DashboardSkeleton } from '@/components/painel/DashboardSkeleton';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(0, 72%, 51%)',
  'hsl(25, 95%, 53%)',
  'hsl(45, 93%, 47%)',
  'hsl(142, 71%, 45%)',
  'hsl(199, 89%, 48%)',
  'hsl(262, 83%, 58%)',
  'hsl(330, 81%, 60%)',
  'hsl(0, 0%, 60%)',
  'hsl(0, 0%, 45%)',
];

function formatMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(m)]}/${y?.slice(2)}`;
}

interface DashboardMetricas {
  clientesAtivos: number;
  carteiraTotal: number;
  inadimplencia: number;
  receitaMesAtual: number;
  riscoCedente: Array<{ nome: string; valor: number }>;
  receitaMensal: Array<{ mes: string; receita: number }>;
  volumeMensal: Array<{ mes: string; volume: number }>;
}

export default function GestorDashboard() {
  const { profile } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gestor-dashboard'],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'gestor-dashboard' },
      });
      if (error) throw error;
      return result as {
        proximosAniversariantes: Array<{
          nome: string;
          empresa: string;
          data_nascimento: string;
          dias_faltam: number;
          dia: number;
          mes: number;
          na_carteira: boolean;
        }>;
        chequesDevolvidos: Array<{
          id?: number;
          cpf_cnpj: string;
          cedente: string;
          sacado: string;
          valor: number;
          vencimento?: string | null;
          devolucao?: string | null;
          documento?: string;
        }>;

        metricas: DashboardMetricas;
        reconciliacao?: {
          totalGeralAberto: number;
          totalDocumental: number;
          carteiraConvencional: number;
          inadimplenciaSmart: number;
          breakdown: Array<{ situacao: string; etapa: string | null; qtd: number; valor: number }>;
        };
      };
    },
  });

  const aniversariantes = data?.proximosAniversariantes || [];
  const chequesDevolvidos = data?.chequesDevolvidos || [];
  const metricas = data?.metricas;
  const reconciliacao = data?.reconciliacao;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = profile?.name?.split(' ')[0] || 'Gestor';
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const kpis = [
    {
      label: 'Clientes ativos (30 dias)',
      value: metricas?.clientesAtivos?.toString() || '0',
      icon: Users,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
    },
    {
      label: 'Receita do mês atual',
      value: formatCurrency(metricas?.receitaMesAtual || 0),
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Carteira (Convencional)',
      value: formatCurrency(metricas?.carteiraTotal || 0),
      icon: Briefcase,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Inadimplência (Geral)',
      value: formatCurrency(metricas?.inadimplencia || 0),
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  ];

  const riscoCedente = metricas?.riscoCedente || [];
  const receitaMensal = (metricas?.receitaMensal || []).map(r => ({
    ...r,
    label: formatMesLabel(r.mes),
  }));
  const volumeMensal = (metricas?.volumeMensal || []).map(r => ({
    ...r,
    label: formatMesLabel(r.mes),
  }));

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(120,53,15,0.05),transparent_28%),linear-gradient(180deg,rgba(255,251,235,0.72),rgba(255,255,255,1))] p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <section className="py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-700">Painel geral</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {saudacao}, {firstName}
              </h1>
              <p className="mt-1 text-sm capitalize text-muted-foreground">{dataHoje}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 rounded-xl border-amber-200/80 bg-white/70 px-4 text-amber-900 backdrop-blur"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </section>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-slate-200/80 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${kpi.iconBg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="truncate text-xl font-bold text-foreground">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Risco Cedente - Donut */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Risco Cedente</CardTitle>
            </CardHeader>
            <CardContent>
              {riscoCedente.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={riscoCedente}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {riscoCedente.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend
                      layout="vertical"
                      align="left"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => (
                        <span className="text-xs text-muted-foreground">{value.length > 12 ? value.slice(0, 12) + '...' : value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Sem dados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receita por mês */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Receita por mês (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {receitaMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={receitaMensal}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} width={70} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="receita" fill="hsl(0, 72%, 40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Sem dados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume operado */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Volume operado (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {volumeMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={volumeMensal}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} width={70} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="volume" fill="hsl(0, 72%, 40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Sem dados
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Aniversariantes + Alertas */}
        <div className="grid gap-6 xl:grid-cols-2">
          <ProximosAniversariantesCard
            aniversariantes={aniversariantes}
            loading={isLoading}
          />
          <ChequesDevolvidosCard
            chequesDevolvidos={chequesDevolvidos}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
