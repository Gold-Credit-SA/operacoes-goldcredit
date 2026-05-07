import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Users, DollarSign, Briefcase, AlertTriangle, Calendar, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProximosAniversariantesCard } from '@/components/painel/ProximosAniversariantesCard';
import { AlertasInadimplenciaCard } from '@/components/painel/AlertasInadimplenciaCard';
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

type FilterPreset = 'hoje' | 'semana' | '30dias' | 'mes' | '3meses' | '6meses' | '12meses' | 'custom' | '';

function getPresetDates(preset: FilterPreset): { inicio: string; fim: string } {
  const hoje = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const fimStr = fmt(hoje);

  switch (preset) {
    case 'hoje': return { inicio: fimStr, fim: fimStr };
    case 'semana': {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 7);
      return { inicio: fmt(d), fim: fimStr };
    }
    case '30dias': {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 30);
      return { inicio: fmt(d), fim: fimStr };
    }
    case 'mes': {
      return { inicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`, fim: fimStr };
    }
    case '3meses': {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() - 3);
      return { inicio: fmt(d), fim: fimStr };
    }
    case '6meses': {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() - 6);
      return { inicio: fmt(d), fim: fimStr };
    }
    case '12meses': {
      const d = new Date(hoje);
      d.setFullYear(d.getFullYear() - 1);
      return { inicio: fmt(d), fim: fimStr };
    }
    default: return { inicio: '', fim: '' };
  }
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
  const [preset, setPreset] = useState<FilterPreset>('30dias');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');

  const filterDates = useMemo(() => {
    if (preset === 'custom') return { inicio: customInicio, fim: customFim };
    if (preset) return getPresetDates(preset);
    return { inicio: '', fim: '' };
  }, [preset, customInicio, customFim]);

  const hasFilter = preset !== '';

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gestor-dashboard', filterDates.inicio, filterDates.fim],
    queryFn: async () => {
      const body: Record<string, string> = { action: 'gestor-dashboard' };
      if (filterDates.inicio) body.data_inicio = filterDates.inicio;
      if (filterDates.fim) body.data_fim = filterDates.fim;

      const { data: result, error } = await supabase.functions.invoke('portfolio-data', { body });
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
        alertasInadimplencia: Array<{
          cedente: string;
          sacado: string;
          valor: number;
          vencimento: string;
          diasAtraso: number;
        }>;
        metricas: DashboardMetricas;
      };
    },
  });

  const aniversariantes = data?.proximosAniversariantes || [];
  const alertasInadimplencia = data?.alertasInadimplencia || [];
  const metricas = data?.metricas;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = profile?.name?.split(' ')[0] || 'Gestor';
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const clearFilters = () => {
    setPreset('');
    setCustomInicio('');
    setCustomFim('');
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const receitaLabel = hasFilter ? 'Receita no período' : 'Receita do mês atual';

  const kpis = [
    {
      label: 'Clientes ativos',
      value: metricas?.clientesAtivos?.toString() || '0',
      icon: Users,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
    },
    {
      label: receitaLabel,
      value: formatCurrency(metricas?.receitaMesAtual || 0),
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Carteira',
      value: formatCurrency(metricas?.carteiraTotal || 0),
      icon: Briefcase,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Inadimplência',
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

        {/* Filters */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filtro de período</span>
              {hasFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-xs h-7">
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs">Período rápido</Label>
                <Select value={preset} onValueChange={(v) => setPreset(v as FilterPreset)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="semana">Últimos 7 dias</SelectItem>
                    <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                    <SelectItem value="mes">Mês atual</SelectItem>
                    <SelectItem value="3meses">Últimos 3 meses</SelectItem>
                    <SelectItem value="6meses">Últimos 6 meses</SelectItem>
                    <SelectItem value="12meses">Últimos 12 meses</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preset === 'custom' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data início</Label>
                    <Input
                      type="date"
                      value={customInicio}
                      onChange={(e) => setCustomInicio(e.target.value)}
                      className="h-9 w-[160px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data fim</Label>
                    <Input
                      type="date"
                      value={customFim}
                      onChange={(e) => setCustomFim(e.target.value)}
                      className="h-9 w-[160px]"
                    />
                  </div>
                </>
              )}

              {hasFilter && filterDates.inicio && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs text-amber-800">
                    {filterDates.inicio === filterDates.fim
                      ? new Date(filterDates.inicio + 'T12:00:00').toLocaleDateString('pt-BR')
                      : `${new Date(filterDates.inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — ${new Date(filterDates.fim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                    }
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
              <CardTitle className="text-base font-semibold">Receita por mês</CardTitle>
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
              <CardTitle className="text-base font-semibold">Volume operado</CardTitle>
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
          <AlertasInadimplenciaCard
            alertas={alertasInadimplencia}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
