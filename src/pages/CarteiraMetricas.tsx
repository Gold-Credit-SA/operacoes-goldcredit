import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw, TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle,
  Activity, Target, BarChart3, ShieldAlert, Lightbulb, Award, ArrowUpRight,
  ArrowDownRight, Minus, ChevronRight, CalendarDays,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart, Cell,
  PieChart as RechartsPie, Pie, Legend,
} from 'recharts';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';
import { PageLoadingSkeleton } from '@/components/ui/PageLoadingSkeleton';

// Types
interface Resumo {
  totalCedentes: number;
  cedentesAtivos: number;
  cedentesInativos: number;
  totalVolume: number;
  totalOps: number;
  totalRisco: number;
  totalLimite: number;
  totalDisponivel: number;
  ticketMedio: number;
  variacaoVolume: number;
  variacaoOps: number;
  concentracaoHHI: number;
  taxaAtividade: number;
}

interface CedenteMetrica {
  cpf_cnpj: string;
  nome: string;
  limite: number;
  risco: number;
  volume: number;
  qtd: number;
  volumePrev: number;
  qtdPrev: number;
  variacaoVolume: number;
  variacaoQtd: number;
  diasInativo: number;
  uf: string;
  setor: string;
  percentualCarteira?: number;
}

interface EvolucaoMensal {
  mes: string;
  qtd: number;
  volume: number;
  cedentes_ativos: number;
}

interface Recomendacao {
  tipo: string;
  titulo: string;
  descricao: string;
  cedentes: string[];
}

interface MetricsData {
  resumo: Resumo;
  rankingVolume: CedenteMetrica[];
  rankingOps: CedenteMetrica[];
  rankingRisco: CedenteMetrica[];
  rankingInativos: CedenteMetrica[];
  concentracaoRisco: CedenteMetrica[];
  evolucaoMensal: EvolucaoMensal[];
  recomendacoes: Recomendacao[];
}

const CHART_COLORS = {
  gold: 'hsl(38, 67%, 67%)',
  goldDark: 'hsl(38, 67%, 50%)',
  green: 'hsl(142, 71%, 45%)',
  red: 'hsl(0, 72%, 51%)',
  blue: 'hsl(220, 70%, 55%)',
  purple: 'hsl(280, 60%, 55%)',
  teal: 'hsl(180, 60%, 45%)',
  orange: 'hsl(25, 80%, 55%)',
};

const PIE_COLORS = [
  CHART_COLORS.gold, CHART_COLORS.blue, CHART_COLORS.green,
  CHART_COLORS.purple, CHART_COLORS.teal, CHART_COLORS.orange,
  CHART_COLORS.red, CHART_COLORS.goldDark,
];

export default function CarteiraMetricas() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [periodo, setPeriodo] = useState('6');
  const [rankingTab, setRankingTab] = useState('volume');
  const { toast } = useToast();

  // Month-based period filter
  const now = new Date();
  const defaultMesInicio = `${now.getFullYear()}-${String(now.getMonth() - 5 < 1 ? now.getMonth() + 7 : now.getMonth() - 5).padStart(2, '0')}`;
  const [mesInicio, setMesInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [mesFim, setMesFim] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generate month options (last 36 months)
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 36; i++) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const val = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${String(m).padStart(2, '0')}/${y}`;
      opts.push({ value: val, label });
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, []);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fmtShort = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return fmt(v);
  };

  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data_inicio = `${mesInicio}-01`;
      // End of mesFim month
      const [y, m] = mesFim.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const data_fim = `${mesFim}-${String(lastDay).padStart(2, '0')}`;

      const { data: result, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'portfolio-advanced-metrics', periodo_meses: parseInt(periodo), data_inicio, data_fim },
      });
      if (error) throw error;
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      toast({ title: 'Erro ao carregar métricas', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [mesInicio, mesFim, periodo, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const r = data?.resumo;

  const VariationBadge = ({ value }: { value: number }) => {
    if (value === 0) return <span className="text-muted-foreground text-xs flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0%</span>;
    return value > 0
      ? <span className="text-emerald-600 text-xs font-medium flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{fmtPct(value)}</span>
      : <span className="text-destructive text-xs font-medium flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />{fmtPct(value)}</span>;
  };

  const concentracaoLabel = (hhi: number) => {
    if (hhi < 1000) return { label: 'Baixa', color: 'bg-emerald-100 text-emerald-800' };
    if (hhi < 2500) return { label: 'Moderada', color: 'bg-amber-100 text-amber-800' };
    return { label: 'Alta', color: 'bg-red-100 text-red-800' };
  };

  const evolucaoFormatted = useMemo(() => {
    if (!data?.evolucaoMensal) return [];
    return data.evolucaoMensal.map(e => ({
      ...e,
      mes: e.mes.substring(5) + '/' + e.mes.substring(2, 4),
      volume: parseFloat(String(e.volume)) || 0,
      qtd: parseInt(String(e.qtd)) || 0,
      cedentes_ativos: parseInt(String(e.cedentes_ativos)) || 0,
    }));
  }, [data]);

  const currentRanking = useMemo(() => {
    if (!data) return [];
    if (rankingTab === 'volume') return data.rankingVolume;
    if (rankingTab === 'operacoes') return data.rankingOps;
    return data.rankingVolume.sort((a, b) => b.variacaoVolume - a.variacaoVolume);
  }, [data, rankingTab]);

  const maxRankingValue = useMemo(() => {
    if (!currentRanking.length) return 1;
    if (rankingTab === 'volume') return currentRanking[0]?.volume || 1;
    if (rankingTab === 'operacoes') return currentRanking[0]?.qtd || 1;
    return Math.max(...currentRanking.map(c => Math.abs(c.variacaoVolume)), 1);
  }, [currentRanking, rankingTab]);

  const LoadingBlock = ({ h = 'h-[300px]' }: { h?: string }) => <Skeleton className={`${h} w-full rounded-lg`} />;

  return (
    <MainLayout title="Métricas da Carteira" subtitle="Painel analítico avançado de desempenho e risco">
      <LoadingIndicator show={isLoading} message="Carregando métricas..." />
      <div className="space-y-6">
        {/* Header: Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-3 -mt-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">De:</Label>
              <Select value={mesInicio} onValueChange={setMesInicio}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Até:</Label>
              <Select value={mesFim} onValueChange={setMesFim}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.filter(o => o.value >= mesInicio).map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mesInicio && mesFim && (
              <Badge variant="outline" className="text-xs">
                {monthOptions.find(o => o.value === mesInicio)?.label} → {monthOptions.find(o => o.value === mesFim)?.label}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* === RESUMO EXECUTIVO === */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : r ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={DollarSign} label="Volume Operado" value={fmtShort(r.totalVolume)} variation={<VariationBadge value={r.variacaoVolume} />} />
            <KPICard icon={Activity} label="Total Operações" value={r.totalOps.toLocaleString('pt-BR')} variation={<VariationBadge value={r.variacaoOps} />} />
            <KPICard icon={Users} label="Cedentes Ativos" value={`${r.cedentesAtivos} / ${r.totalCedentes}`} sub={`Taxa: ${r.taxaAtividade.toFixed(0)}%`} />
            <KPICard icon={Target} label="Ticket Médio" value={fmtShort(r.ticketMedio)} />
            <KPICard icon={ShieldAlert} label="Risco Total" value={fmtShort(r.totalRisco)} accent="destructive" />
            <KPICard icon={TrendingUp} label="Limite Disponível" value={fmtShort(r.totalDisponivel)} accent="success" />
            <KPICard icon={BarChart3} label="Concentração (HHI)" value={r.concentracaoHHI.toLocaleString('pt-BR')} badge={concentracaoLabel(r.concentracaoHHI)} />
            <KPICard icon={Users} label="Inativos" value={`${r.cedentesInativos}`} sub={`${r.totalCedentes - r.cedentesInativos} operando`} accent={r.cedentesInativos > r.cedentesAtivos ? 'destructive' : undefined} />
          </div>
        ) : null}

        {/* === EVOLUÇÃO MENSAL === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução do Volume Mensal</CardTitle>
              <CardDescription>Volume operado e operações por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : evolucaoFormatted.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={evolucaoFormatted}>
                    <defs>
                      <linearGradient id="gradVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => fmtShort(v)} tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="volume" name="Volume" stroke={CHART_COLORS.gold} fill="url(#gradVolume)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cedentes Ativos por Mês</CardTitle>
              <CardDescription>Evolução da base ativa e taxa de ativação</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : evolucaoFormatted.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolucaoFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="cedentes_ativos" name="Cedentes Ativos" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS.blue }} />
                    <Line type="monotone" dataKey="qtd" name="Operações" stroke={CHART_COLORS.gold} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </CardContent>
          </Card>
        </div>

        {/* === RANKING DE CEDENTES === */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Ranking de Cedentes</CardTitle>
                <CardDescription>Quem está operando mais e quem está operando menos</CardDescription>
              </div>
              <Tabs value={rankingTab} onValueChange={setRankingTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="volume" className="text-xs">Volume</TabsTrigger>
                  <TabsTrigger value="operacoes" className="text-xs">Operações</TabsTrigger>
                  <TabsTrigger value="crescimento" className="text-xs">Crescimento</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingBlock h="h-[400px]" /> : currentRanking.length > 0 ? (
              <div className="space-y-2">
                {currentRanking.slice(0, 10).map((c, i) => {
                  const val = rankingTab === 'volume' ? c.volume : rankingTab === 'operacoes' ? c.qtd : c.variacaoVolume;
                  const displayVal = rankingTab === 'volume' ? fmtShort(c.volume)
                    : rankingTab === 'operacoes' ? `${c.qtd} ops`
                    : fmtPct(c.variacaoVolume);
                  const pct = rankingTab === 'crescimento'
                    ? Math.min(Math.abs(val) / (maxRankingValue || 1) * 100, 100)
                    : (val / maxRankingValue) * 100;
                  const pctOfTotal = data?.resumo.totalVolume ? (c.volume / data.resumo.totalVolume) * 100 : 0;

                  return (
                    <div key={c.cpf_cnpj} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate max-w-[200px]">{c.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{pctOfTotal.toFixed(1)}%</span>
                            <span className="text-sm font-semibold">{displayVal}</span>
                            {rankingTab !== 'crescimento' && <VariationBadge value={c.variacaoVolume} />}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: rankingTab === 'crescimento'
                                ? (val >= 0 ? CHART_COLORS.green : CHART_COLORS.red)
                                : CHART_COLORS.gold,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        {/* === INATIVIDADE & RISCO === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inativos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Cedentes com Baixa Atividade
              </CardTitle>
              <CardDescription>Cedentes sem operação há mais de 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : (data?.rankingInativos || []).length > 0 ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                  {data!.rankingInativos.slice(0, 15).map(c => (
                    <div key={c.cpf_cnpj} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.uf || ''}</p>
                      </div>
                      <Badge variant={c.diasInativo > 90 ? 'destructive' : 'secondary'} className="shrink-0 ml-2">
                        {c.diasInativo >= 999 ? 'Sem operação' : `${c.diasInativo}d inativo`}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Todos os cedentes estão ativos 🎉</p>
              )}
            </CardContent>
          </Card>

          {/* Concentração de Risco */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" /> Concentração de Risco
              </CardTitle>
              <CardDescription>Maiores exposições e participação no risco total</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : (data?.concentracaoRisco || []).length > 0 ? (
                <div className="space-y-3">
                  {data!.concentracaoRisco.slice(0, 8).map((c, i) => (
                    <div key={c.cpf_cnpj}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate max-w-[200px]">{c.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{(c.percentualCarteira || 0).toFixed(1)}%</span>
                          <span className="text-sm font-semibold">{fmtShort(c.risco)}</span>
                        </div>
                      </div>
                      <Progress
                        value={c.percentualCarteira || 0}
                        className="h-2"
                      />
                      {(c.percentualCarteira || 0) > 25 && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Exposição elevada
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : <EmptyState />}
            </CardContent>
          </Card>
        </div>

        {/* === DISTRIBUIÇÃO POR FAIXA DE RISCO === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribuição por Faixa de Risco</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : data ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={getRiskBands(data.rankingRisco)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {getRiskBands(data.rankingRisco).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: number) => `${v} cedentes`} />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </CardContent>
          </Card>

          {/* Campeões de Operações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Campeões de Operações
              </CardTitle>
              <CardDescription>Cedentes com maior número e regularidade operacional</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingBlock /> : (data?.rankingOps || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data!.rankingOps.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }}
                      tickFormatter={(v: string) => v.length > 15 ? v.substring(0, 15) + '…' : v} />
                    <RechartsTooltip formatter={(v: number, name: string) => name === 'Operações' ? `${v} ops` : fmt(v)} />
                    <Bar dataKey="qtd" name="Operações" fill={CHART_COLORS.gold} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </CardContent>
          </Card>
        </div>

        {/* === RECOMENDAÇÕES === */}
        {!isLoading && data?.recomendacoes && data.recomendacoes.length > 0 && (
          <Card className="border-primary/30 bg-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" /> Recomendações Inteligentes
              </CardTitle>
              <CardDescription>Sugestões baseadas na análise da carteira — apoio analítico, não decisão automática</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recomendacoes.map((rec, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-card rounded-lg border border-border/50">
                    <div className="shrink-0 mt-0.5">
                      {rec.tipo === 'concentracao' && <ShieldAlert className="h-5 w-5 text-amber-500" />}
                      {rec.tipo === 'inatividade' && <TrendingDown className="h-5 w-5 text-destructive" />}
                      {rec.tipo === 'utilizacao' && <Target className="h-5 w-5 text-blue-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{rec.titulo}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{rec.descricao}</p>
                      {rec.cedentes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rec.cedentes.map(n => (
                            <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

// === Sub-components ===

function KPICard({ icon: Icon, label, value, variation, sub, accent, badge }: {
  icon: any;
  label: string;
  value: string;
  variation?: React.ReactNode;
  sub?: string;
  accent?: 'destructive' | 'success';
  badge?: { label: string; color: string };
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${
            accent === 'destructive' ? 'bg-destructive/10' :
            accent === 'success' ? 'bg-emerald-50' :
            'bg-accent'
          }`}>
            <Icon className={`h-4 w-4 ${
              accent === 'destructive' ? 'text-destructive' :
              accent === 'success' ? 'text-emerald-600' :
              'text-primary'
            }`} />
          </div>
          {variation}
          {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>}
        </div>
        <p className="text-xl font-bold mt-3 truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return <p className="text-center text-muted-foreground py-8 text-sm">Sem dados para o período selecionado</p>;
}

function getRiskBands(cedentes: CedenteMetrica[]) {
  const bands = [
    { name: 'Até R$100K', min: 0, max: 100000 },
    { name: 'R$100K-500K', min: 100000, max: 500000 },
    { name: 'R$500K-1M', min: 500000, max: 1000000 },
    { name: 'R$1M-5M', min: 1000000, max: 5000000 },
    { name: 'Acima R$5M', min: 5000000, max: Infinity },
  ];
  return bands
    .map(b => ({
      name: b.name,
      value: cedentes.filter(c => c.risco >= b.min && c.risco < b.max).length,
    }))
    .filter(b => b.value > 0);
}
