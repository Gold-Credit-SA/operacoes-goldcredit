import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Building2,
  CreditCard,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
  consulted_by_name: string | null;
}

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  agrisk_client_id: string | null;
  basic_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AICompilation {
  alertaCritico: string | null;
  smart: {
    disponivel: boolean;
    ultimasOperacoes: string;
    resumoFinanceiro: string;
    limite: string;
    concentracao: string;
    liquidez: string;
    taxaConfirmacao?: string;
    comportamentoPagamento?: string;
  };
  serasa: {
    disponivel: boolean;
    mensagem: string | null;
    tipoRelatorio?: string;
    liminarJudicial: boolean;
    alertaLiminar: string | null;
    identificacao?: string;
    score: string;
    limiteCreditoSugerido?: string;
    anotacoesNegativas?: string;
    acoesFalencias?: string;
    chequesSustados?: string;
    ultimasConsultas: string;
    qsa?: string;
    historicoPagamento: string;
    relacionamentoMercado?: string;
    evolucaoCompromissos?: string;
    resumoDividas?: string;
  };
  scr: {
    disponivel: boolean;
    mensagem: string | null;
    resumoGeral: string;
    creditosAVencer?: string;
    creditosVencidos?: string;
    modalidades?: string;
    limitesCredito?: string;
    classificacaoRisco?: string;
    discordanciaSubJudice?: string;
  };
  analiseCruzada?: {
    consistenciaEndividamento?: string;
    capacidadePagamento?: string;
    sinaisAlerta?: string;
  };
  parecerFinal: {
    parecer: 'FAVORAVEL' | 'FAVORAVEL_COM_RESTRICOES' | 'ATENCAO' | 'DESFAVORAVEL';
    justificativa: string;
    recomendacoes?: string[];
  };
}

interface Props {
  client: ClientRecord;
  history: HistoryEntry[];
  agriskOverview: HistoryEntry | null;
}

const GOLD = '#e5b970';
const GOLD_DARK = '#a07d2a';

function latestByPlatform(entries: HistoryEntry[], platform: string) {
  return entries
    .filter((e) => e.platform === platform)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] || null;
}

const PARECER_CONFIG = {
  FAVORAVEL: { label: 'Favorável', color: 'text-emerald-700', bar: 'bg-emerald-500', light: 'bg-emerald-50' },
  FAVORAVEL_COM_RESTRICOES: { label: 'Favorável c/ restrições', color: 'text-amber-700', bar: 'bg-amber-500', light: 'bg-amber-50' },
  ATENCAO: { label: 'Atenção', color: 'text-orange-700', bar: 'bg-orange-500', light: 'bg-orange-50' },
  DESFAVORAVEL: { label: 'Desfavorável', color: 'text-red-700', bar: 'bg-red-500', light: 'bg-red-50' },
} as const;

function isEmpty(v?: string | null): boolean {
  if (!v) return true;
  const s = v.toLowerCase().trim();
  return s.startsWith('sem dados') || s.startsWith('não houve') || s.startsWith('dados insuficientes') || s.startsWith('não disponível') || s === '—';
}

function extractKPI(text?: string): string | null {
  if (!text || isEmpty(text)) return null;
  const money = text.match(/R\$\s*[\d.,]+\s*(mil|milhões|milhão|bilhões|bilhão)?/i);
  if (money) return money[0];
  const pct = text.match(/[\d.,]+\s*%/);
  if (pct) return pct[0];
  const num = text.match(/\b\d{2,4}\b/);
  if (num) return num[0];
  return null;
}

// Quebra texto em primeira frase + resto
function splitFirstSentence(text?: string): { lead: string; rest: string } {
  if (!text) return { lead: '', rest: '' };
  const m = text.match(/^([^.!?\n]{10,180}[.!?])\s*(.*)$/s);
  if (m) return { lead: m[1].trim(), rest: m[2].trim() };
  return { lead: text.trim(), rest: '' };
}

export function ClienteAICompilationCard({ client, history }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AICompilation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compiledPayload = useMemo(() => {
    const latestSmart = latestByPlatform(history, 'smart');
    const latestSerasa = latestByPlatform(history, 'serasa');
    const latestScr = latestByPlatform(history, 'scr');
    return {
      clientProfile: {
        id: client.id,
        nome: client.name,
        cpfCnpj: client.cpf_cnpj,
        atualizadoEm: client.updated_at,
        basicData: client.basic_data,
      },
      sourceData: {
        smart: latestSmart ? { sourceType: 'interna', consultaLabel: latestSmart.consulta_label, createdAt: latestSmart.created_at, data: latestSmart.result_data } : null,
        serasa: latestSerasa ? { sourceType: 'externa', consultaLabel: latestSerasa.consulta_label, createdAt: latestSerasa.created_at, data: latestSerasa.result_data } : null,
        scr: latestScr ? { sourceType: 'externa', consultaLabel: latestScr.consulta_label, createdAt: latestScr.created_at, data: latestScr.result_data } : null,
      },
    };
  }, [client, history]);

  const hasAnySource = Object.values(compiledPayload.sourceData).some(Boolean);

  const runCompilation = async () => {
    if (!hasAnySource) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-client-summary', { body: compiledPayload });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      toast.success('Análise concluída.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao compilar dados.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis) {
    return (
      <Card className="mt-8 overflow-hidden border-border bg-gradient-to-br from-white via-white to-[#fdf6e3]/30">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
          <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl ring-1" style={{ background: `${GOLD}20`, color: GOLD_DARK, borderColor: `${GOLD}40` }}>
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_DARK }}>Parecer Executivo</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Análise inteligente do cliente</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Memorando de crédito consolidando Smart, Serasa e SCR em narrativa executiva.
                </p>
              </div>
            </div>
            <Button
              onClick={runCompilation}
              disabled={isLoading || !hasAnySource}
              size="lg"
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando…</> : <><Sparkles className="h-4 w-4" /> Gerar parecer</>}
            </Button>
          </div>
          {!hasAnySource && (
            <div className="border-t border-border bg-muted/30 px-7 py-3 text-sm text-muted-foreground">
              Execute pelo menos uma consulta (Smart, Serasa ou SCR) antes de gerar o parecer.
            </div>
          )}
          {error && (
            <div className="border-t border-destructive/20 bg-destructive/5 px-7 py-3 text-sm text-destructive">{error}</div>
          )}
        </div>
      </Card>
    );
  }

  return <ParecerExecutivo analysis={analysis} clientName={client.name} onRefresh={runCompilation} isLoading={isLoading} />;
}

/* ════════════════════════════ PARECER EXECUTIVO ════════════════════════════ */

function ParecerExecutivo({
  analysis,
  clientName,
  onRefresh,
  isLoading,
}: {
  analysis: AICompilation;
  clientName: string | null;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const cfg = PARECER_CONFIG[analysis.parecerFinal?.parecer] || PARECER_CONFIG.ATENCAO;
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // 3 parágrafos do memorando
  const paragrafos = useMemo(() => {
    const just = analysis.parecerFinal?.justificativa || '';
    const parts = just.split(/\n\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).filter((p) => p.trim().length > 20);
    if (parts.length >= 3) return [parts[0], parts[1], parts.slice(2).join(' ')];
    if (parts.length === 2) return [parts[0], parts[1], ''];
    return [just, '', ''];
  }, [analysis.parecerFinal?.justificativa]);

  return (
    <div className="mt-8 space-y-5 animate-fade-in">
      {/* ═══ HERO MEMORANDO ═══ */}
      <Card className="overflow-hidden border-border bg-white shadow-sm">
        {/* Top stripe gold */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD}, ${GOLD_DARK})` }} />

        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          {/* Coluna esquerda: narrativa */}
          <div className="space-y-5 p-7 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD_DARK }}>
                <FileText className="h-3 w-3" />
                Memorando de Crédito · {today}
              </div>
              <Button
                onClick={onRefresh}
                disabled={isLoading}
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Reanalisar
              </Button>
            </div>

            {/* Veredito */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className={cn('inline-block h-2.5 w-2.5 rounded-full', cfg.bar)} />
                <p className={cn('text-xs font-bold uppercase tracking-[0.18em]', cfg.color)}>Parecer · {cfg.label}</p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                {clientName || 'Cliente'}
              </h2>
            </div>

            {/* 3 parágrafos narrativos */}
            <div className="space-y-4 border-l-2 pl-5" style={{ borderColor: GOLD }}>
              {paragrafos[0] && (
                <p className="text-[15px] leading-[1.7] text-foreground/90 first-letter:text-2xl first-letter:font-semibold first-letter:mr-1" style={{ ['--tw-first-letter-color' as never]: GOLD_DARK }}>
                  {paragrafos[0]}
                </p>
              )}
              {paragrafos[1] && (
                <p className="text-[15px] leading-[1.7] text-foreground/85">{paragrafos[1]}</p>
              )}
              {paragrafos[2] && (
                <p className="text-[15px] leading-[1.7] text-foreground/85">{paragrafos[2]}</p>
              )}
            </div>
          </div>

          {/* Sidebar: KPIs */}
          <aside className="border-t border-border bg-[#fafafa] p-6 lg:border-l lg:border-t-0">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Indicadores-chave</p>
            <div className="space-y-3">
              <KpiSidebar
                label="Score Serasa"
                value={extractKPI(analysis.serasa?.score)}
                hint={firstWords(analysis.serasa?.score, 12)}
                icon={<Shield className="h-3.5 w-3.5" />}
              />
              <KpiSidebar
                label="Carteira SCR"
                value={extractKPI(analysis.scr?.resumoGeral)}
                hint={firstWords(analysis.scr?.resumoGeral, 12)}
                icon={<CreditCard className="h-3.5 w-3.5" />}
              />
              <KpiSidebar
                label="Volume Smart"
                value={extractKPI(analysis.smart?.resumoFinanceiro) || extractKPI(analysis.smart?.ultimasOperacoes)}
                hint={firstWords(analysis.smart?.resumoFinanceiro, 12)}
                icon={<Building2 className="h-3.5 w-3.5" />}
              />
              <KpiSidebar
                label="Vencidos SCR"
                value={extractKPI(analysis.scr?.creditosVencidos)}
                hint={firstWords(analysis.scr?.creditosVencidos, 12)}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                alert
              />
              <KpiSidebar
                label="Concentração"
                value={extractKPI(analysis.smart?.concentracao)}
                hint={firstWords(analysis.smart?.concentracao, 12)}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              />
            </div>
          </aside>
        </div>
      </Card>

      {/* ═══ ALERTAS ═══ */}
      {(analysis.alertaCritico || (analysis.serasa?.liminarJudicial && analysis.serasa.alertaLiminar)) && (
        <Card className="border-red-200 bg-red-50/60">
          <div className="flex items-start gap-3 p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                {analysis.alertaCritico ? 'Alerta crítico' : 'Liminar judicial detectada'}
              </p>
              <p className="text-sm leading-relaxed text-red-800">
                {analysis.alertaCritico || analysis.serasa?.alertaLiminar}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ TABS DE FONTES ═══ */}
      <FontesTabs analysis={analysis} />

      {/* ═══ ANÁLISE CRUZADA + RECOMENDAÇÕES ═══ */}
      <div className="grid gap-5 lg:grid-cols-2">
        {analysis.analiseCruzada && (
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: GOLD_DARK }} />
                <h4 className="text-sm font-semibold tracking-tight">Análise cruzada</h4>
              </div>
              <div className="space-y-3.5">
                <CrossRow label="Endividamento" value={analysis.analiseCruzada.consistenciaEndividamento} />
                <CrossRow label="Capacidade de pagamento" value={analysis.analiseCruzada.capacidadePagamento} />
                <CrossRow label="Sinais de alerta" value={analysis.analiseCruzada.sinaisAlerta} alert />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.parecerFinal?.recomendacoes && analysis.parecerFinal.recomendacoes.length > 0 && (
          <Card className="overflow-hidden border-border">
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD})` }} />
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" style={{ color: GOLD_DARK }} />
                <h4 className="text-sm font-semibold tracking-tight">Recomendações</h4>
              </div>
              <ol className="space-y-2.5">
                {analysis.parecerFinal.recomendacoes.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-background"
                      style={{ backgroundColor: GOLD_DARK }}
                    >
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════ TABS FONTES ════════════════════════════ */

function FontesTabs({ analysis }: { analysis: AICompilation }) {
  const tabs = [
    { key: 'smart', label: 'Smart', icon: Building2, available: analysis.smart?.disponivel },
    { key: 'serasa', label: 'Serasa', icon: Shield, available: analysis.serasa?.disponivel },
    { key: 'scr', label: 'SCR Bacen', icon: CreditCard, available: analysis.scr?.disponivel },
  ];
  const firstAvailable = tabs.find((t) => t.available)?.key || 'smart';

  return (
    <Card className="overflow-hidden border-border">
      <Tabs defaultValue={firstAvailable}>
        <div className="border-b border-border bg-[#fafafa] px-2">
          <TabsList className="h-auto bg-transparent p-0">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className={cn(
                    'relative gap-2 rounded-none border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground',
                    'data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
                  )}
                  style={{
                    ['--tw-border-color' as never]: 'transparent',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {!t.available && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      —
                    </span>
                  )}
                  {t.available && (
                    <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="smart" className="m-0 p-6">
          {analysis.smart?.disponivel ? (
            <FonteContent
              metrics={[
                { label: 'Volume', text: analysis.smart.resumoFinanceiro },
                { label: 'Últimas operações', text: analysis.smart.ultimasOperacoes },
                { label: 'Limite', text: analysis.smart.limite },
                { label: 'Concentração', text: analysis.smart.concentracao },
                { label: 'Liquidez', text: analysis.smart.liquidez },
                { label: 'Taxa de confirmação', text: analysis.smart.taxaConfirmacao },
                { label: 'Comportamento 90d', text: analysis.smart.comportamentoPagamento },
              ]}
            />
          ) : (
            <Empty msg="Sem consulta Smart para este cliente." />
          )}
        </TabsContent>

        <TabsContent value="serasa" className="m-0 p-6">
          {analysis.serasa?.disponivel ? (
            <>
              {analysis.serasa.tipoRelatorio && (
                <Badge variant="outline" className="mb-4 text-[10px] uppercase tracking-wider" style={{ borderColor: GOLD, color: GOLD_DARK }}>
                  {analysis.serasa.tipoRelatorio}
                </Badge>
              )}
              <FonteContent
                metrics={[
                  { label: 'Score', text: analysis.serasa.score },
                  { label: 'Limite sugerido', text: analysis.serasa.limiteCreditoSugerido },
                  { label: 'Identificação', text: analysis.serasa.identificacao },
                  { label: 'Anotações negativas', text: analysis.serasa.anotacoesNegativas || analysis.serasa.resumoDividas, alert: true },
                  { label: 'Ações judiciais', text: analysis.serasa.acoesFalencias, alert: true },
                  { label: 'Cheques sustados', text: analysis.serasa.chequesSustados, alert: true },
                  { label: 'Consultas recentes', text: analysis.serasa.ultimasConsultas },
                  { label: 'QSA', text: analysis.serasa.qsa },
                  { label: 'Histórico de pagamento', text: analysis.serasa.historicoPagamento },
                  { label: 'Relacionamento', text: analysis.serasa.relacionamentoMercado },
                  { label: 'Evolução de compromissos', text: analysis.serasa.evolucaoCompromissos },
                ]}
              />
            </>
          ) : (
            <Empty msg={analysis.serasa?.mensagem || 'Sem consulta Serasa.'} />
          )}
        </TabsContent>

        <TabsContent value="scr" className="m-0 p-6">
          {analysis.scr?.disponivel ? (
            <FonteContent
              metrics={[
                { label: 'Carteira ativa', text: analysis.scr.resumoGeral },
                { label: 'A vencer', text: analysis.scr.creditosAVencer },
                { label: 'Vencidos', text: analysis.scr.creditosVencidos, alert: true },
                { label: 'Modalidades', text: analysis.scr.modalidades },
                { label: 'Limites', text: analysis.scr.limitesCredito },
                { label: 'Classificação', text: analysis.scr.classificacaoRisco },
                { label: 'Sub judice', text: analysis.scr.discordanciaSubJudice, alert: true },
              ]}
            />
          ) : (
            <Empty msg={analysis.scr?.mensagem || 'Sem consulta SCR.'} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function FonteContent({ metrics }: { metrics: { label: string; text?: string; alert?: boolean }[] }) {
  const visible = metrics.filter((m) => !isEmpty(m.text));
  if (visible.length === 0) return <Empty msg="Sem métricas extraídas." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((m) => (
        <KpiBlock key={m.label} label={m.label} text={m.text!} alert={m.alert} />
      ))}
    </div>
  );
}

function KpiBlock({ label, text, alert }: { label: string; text: string; alert?: boolean }) {
  const kpi = extractKPI(text);
  const { lead, rest } = splitFirstSentence(text);
  // microtexto: lead se não tiver KPI, ou lead+rest se tiver
  const micro = kpi ? lead : rest || '';
  const display = kpi || lead;

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-white p-4 transition-colors',
        alert ? 'border-red-200 hover:border-red-300' : 'border-border hover:border-foreground/20',
      )}
    >
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-[0.14em]',
        alert ? 'text-red-600' : 'text-muted-foreground',
      )}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 truncate font-semibold tracking-tight',
          kpi ? 'text-2xl' : 'text-base leading-snug',
          alert ? 'text-red-700' : 'text-foreground',
        )}
        title={display}
      >
        {display}
      </p>
      {micro && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {micro}
        </p>
      )}
    </div>
  );
}

function KpiSidebar({
  label,
  value,
  hint,
  icon,
  alert,
}: {
  label: string;
  value: string | null;
  hint?: string | null;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-2.5">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          alert && value ? 'bg-red-50 text-red-600' : 'text-foreground',
        )}
        style={!alert || !value ? { backgroundColor: `${GOLD}1a`, color: GOLD_DARK } : undefined}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn(
          'truncate text-base font-semibold leading-tight',
          alert && value ? 'text-red-700' : 'text-foreground',
        )}>
          {value || <span className="text-muted-foreground/50">—</span>}
        </p>
        {hint && !isEmpty(hint) && value && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}

function CrossRow({ label, value, alert }: { label: string; value?: string; alert?: boolean }) {
  if (!value || isEmpty(value)) return null;
  return (
    <div>
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-[0.14em]',
        alert ? 'text-orange-600' : 'text-muted-foreground',
      )}>
        {label}
      </p>
      <p className={cn(
        'mt-1 text-sm leading-relaxed whitespace-pre-line',
        alert ? 'text-orange-800' : 'text-foreground/85',
      )}>
        {value}
      </p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm italic text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 opacity-50" />
      {msg}
    </div>
  );
}

function firstWords(text?: string, n = 12): string {
  if (!text || isEmpty(text)) return '';
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length <= n) return words.join(' ');
  return words.slice(0, n).join(' ') + '…';
}
