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
  CheckCircle2,
  ChevronDown,
  Gauge,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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

function latestByPlatform(entries: HistoryEntry[], platform: string) {
  return entries
    .filter((entry) => entry.platform === platform)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] || null;
}

const PARECER_CONFIG: Record<string, { label: string; bg: string; ring: string; fg: string; dot: string; severity: number }> = {
  FAVORAVEL: { label: 'Favorável', bg: 'bg-emerald-50', ring: 'ring-emerald-200', fg: 'text-emerald-700', dot: 'bg-emerald-500', severity: 1 },
  FAVORAVEL_COM_RESTRICOES: { label: 'Favorável com Restrições', bg: 'bg-amber-50', ring: 'ring-amber-200', fg: 'text-amber-700', dot: 'bg-amber-500', severity: 2 },
  ATENCAO: { label: 'Atenção', bg: 'bg-orange-50', ring: 'ring-orange-200', fg: 'text-orange-700', dot: 'bg-orange-500', severity: 3 },
  DESFAVORAVEL: { label: 'Desfavorável', bg: 'bg-red-50', ring: 'ring-red-200', fg: 'text-red-700', dot: 'bg-red-500', severity: 4 },
};

function isEmpty(v?: string | null): boolean {
  if (!v) return true;
  const s = v.toLowerCase().trim();
  return s.startsWith('sem dados') || s.startsWith('não houve consulta') || s.startsWith('dados insuficientes') || s.startsWith('não disponível') || s === '—';
}

// Extrai primeira "métrica" relevante de um texto (R$/score/%)
function extractKPI(text?: string): string | null {
  if (!text || isEmpty(text)) return null;
  const moneyMatch = text.match(/R\$\s*[\d.,]+\s*(mil|milhões|milhão|bilhões|bilhão)?/i);
  if (moneyMatch) return moneyMatch[0];
  const scoreMatch = text.match(/\b(\d{2,4})\s*(?:\/\s*\d+)?\b(?=[^%])/);
  if (scoreMatch) return scoreMatch[1];
  const pctMatch = text.match(/[\d.,]+\s*%/);
  if (pctMatch) return pctMatch[0];
  return null;
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
      const { data, error: fnError } = await supabase.functions.invoke('analyze-client-summary', {
        body: compiledPayload,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      toast.success('Análise concluída.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao compilar dados com IA.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Estado vazio / inicial
  if (!analysis) {
    return (
      <Card className="mt-8 overflow-hidden border-border bg-card">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5b970]/15 text-[#a07d2a]">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Análise inteligente do cliente</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Consolida Smart, Serasa e SCR em um parecer executivo com decisão recomendada.
              </p>
            </div>
          </div>
          <Button
            onClick={runCompilation}
            disabled={isLoading || !hasAnySource}
            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : <><Sparkles className="h-4 w-4" /> Gerar análise</>}
          </Button>
        </div>
        {!hasAnySource && (
          <div className="border-t border-border bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
            Execute pelo menos uma consulta (Smart, Serasa ou SCR) antes de gerar a análise.
          </div>
        )}
        {error && (
          <div className="border-t border-destructive/20 bg-destructive/5 px-6 py-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </Card>
    );
  }

  return <AnalysisDashboard analysis={analysis} onRefresh={runCompilation} isLoading={isLoading} />;
}

/* ────────────────────────── DASHBOARD ────────────────────────── */

function AnalysisDashboard({
  analysis,
  onRefresh,
  isLoading,
}: {
  analysis: AICompilation;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const cfg = PARECER_CONFIG[analysis.parecerFinal?.parecer] || PARECER_CONFIG.ATENCAO;

  // KPIs do hero
  const scoreKpi = extractKPI(analysis.serasa?.score);
  const scrAtivaKpi = extractKPI(analysis.scr?.resumoGeral);
  const concentracaoKpi = extractKPI(analysis.smart?.concentracao);
  const inadimpKpi = extractKPI(analysis.scr?.creditosVencidos);

  return (
    <div className="mt-8 space-y-4 animate-fade-in">
      {/* HERO — Veredito */}
      <Card className={cn('overflow-hidden border-0 shadow-sm ring-1', cfg.bg, cfg.ring)}>
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 shadow-sm', cfg.fg)}>
                {cfg.severity >= 3 ? <ShieldAlert className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Parecer de Crédito</p>
                <h2 className={cn('mt-1 text-3xl font-bold tracking-tight sm:text-4xl', cfg.fg)}>
                  {cfg.label}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/80 line-clamp-3">
                  {analysis.parecerFinal?.justificativa}
                </p>
              </div>
            </div>
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 bg-white/70 backdrop-blur"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reanalisar
            </Button>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Score Serasa" value={scoreKpi} icon={<Gauge className="h-3.5 w-3.5" />} />
            <KpiTile label="Carteira SCR" value={scrAtivaKpi} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <KpiTile label="Concentração" value={concentracaoKpi} icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <KpiTile label="Vencidos" value={inadimpKpi} icon={<AlertTriangle className="h-3.5 w-3.5" />} alert={!!inadimpKpi} />
          </div>
        </div>
      </Card>

      {/* ALERTAS CRÍTICOS */}
      {(analysis.alertaCritico || (analysis.serasa?.liminarJudicial && analysis.serasa.alertaLiminar)) && (
        <Card className="border-red-200 bg-red-50/50">
          <div className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="space-y-2">
              {analysis.alertaCritico && (
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-red-700">Alerta crítico</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-red-800">{analysis.alertaCritico}</p>
                </div>
              )}
              {analysis.serasa?.liminarJudicial && analysis.serasa.alertaLiminar && !analysis.alertaCritico && (
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-red-700">Liminar judicial detectada</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-red-800">{analysis.serasa.alertaLiminar}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* SINAIS DE ALERTA (cruzada) */}
      {analysis.analiseCruzada?.sinaisAlerta && !isEmpty(analysis.analiseCruzada.sinaisAlerta) && (
        <Card className="border-orange-200 bg-orange-50/40">
          <div className="flex items-start gap-3 p-5">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Sinais de alerta cruzados</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
                {analysis.analiseCruzada.sinaisAlerta}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* GRID DE FONTES */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SourceCard
          title="Smart"
          subtitle="Dados internos"
          icon={<Building2 className="h-4 w-4" />}
          accent="text-rose-600 bg-rose-50 ring-rose-100"
          available={analysis.smart?.disponivel}
          unavailableMessage="Sem consulta interna"
          headline={extractKPI(analysis.smart?.resumoFinanceiro) || extractKPI(analysis.smart?.ultimasOperacoes)}
          headlineLabel="Volume operado"
          topics={[
            { label: 'Últimas operações', value: analysis.smart?.ultimasOperacoes },
            { label: 'Resumo financeiro', value: analysis.smart?.resumoFinanceiro },
            { label: 'Limite', value: analysis.smart?.limite },
            { label: 'Concentração de sacados', value: analysis.smart?.concentracao },
            { label: 'Liquidez', value: analysis.smart?.liquidez },
            { label: 'Taxa de confirmação', value: analysis.smart?.taxaConfirmacao },
            { label: 'Comportamento de pagamento (90d)', value: analysis.smart?.comportamentoPagamento },
          ]}
        />

        <SourceCard
          title="Serasa"
          subtitle={analysis.serasa?.tipoRelatorio || 'Bureau externo'}
          icon={<Shield className="h-4 w-4" />}
          accent="text-blue-600 bg-blue-50 ring-blue-100"
          available={analysis.serasa?.disponivel}
          unavailableMessage={analysis.serasa?.mensagem || 'Sem consulta Serasa'}
          headline={extractKPI(analysis.serasa?.score)}
          headlineLabel="Score"
          topics={[
            { label: 'Identificação cadastral', value: analysis.serasa?.identificacao },
            { label: 'Score', value: analysis.serasa?.score },
            { label: 'Limite sugerido', value: analysis.serasa?.limiteCreditoSugerido },
            { label: 'Anotações negativas', value: analysis.serasa?.anotacoesNegativas || analysis.serasa?.resumoDividas },
            { label: 'Ações judiciais / falências', value: analysis.serasa?.acoesFalencias },
            { label: 'Cheques sustados', value: analysis.serasa?.chequesSustados },
            { label: 'Consultas recentes', value: analysis.serasa?.ultimasConsultas },
            { label: 'QSA', value: analysis.serasa?.qsa },
            { label: 'Histórico de pagamento', value: analysis.serasa?.historicoPagamento },
            { label: 'Relacionamento com mercado', value: analysis.serasa?.relacionamentoMercado },
            { label: 'Evolução de compromissos', value: analysis.serasa?.evolucaoCompromissos },
          ]}
        />

        <SourceCard
          title="SCR Bacen"
          subtitle="Sistema de crédito"
          icon={<CreditCard className="h-4 w-4" />}
          accent="text-emerald-600 bg-emerald-50 ring-emerald-100"
          available={analysis.scr?.disponivel}
          unavailableMessage={analysis.scr?.mensagem || 'Sem consulta SCR'}
          headline={extractKPI(analysis.scr?.resumoGeral)}
          headlineLabel="Carteira ativa"
          topics={[
            { label: 'Resumo geral', value: analysis.scr?.resumoGeral },
            { label: 'Créditos a vencer', value: analysis.scr?.creditosAVencer },
            { label: 'Créditos vencidos', value: analysis.scr?.creditosVencidos, alert: true },
            { label: 'Modalidades', value: analysis.scr?.modalidades },
            { label: 'Limites de crédito', value: analysis.scr?.limitesCredito },
            { label: 'Classificação de risco', value: analysis.scr?.classificacaoRisco },
            { label: 'Discordância / sub judice', value: analysis.scr?.discordanciaSubJudice, alert: true },
          ]}
        />
      </div>

      {/* ANÁLISE CRUZADA — colapsada */}
      {analysis.analiseCruzada && (
        <Card className="border-border">
          <Accordion type="single" collapsible>
            <AccordionItem value="cross" className="border-0">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold">Análise cruzada entre fontes</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-3">
                  <CrossRow label="Consistência de endividamento" value={analysis.analiseCruzada.consistenciaEndividamento} />
                  <CrossRow label="Capacidade de pagamento" value={analysis.analiseCruzada.capacidadePagamento} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {/* RECOMENDAÇÕES */}
      {analysis.parecerFinal?.recomendacoes && analysis.parecerFinal.recomendacoes.length > 0 && (
        <Card className="border-border bg-gradient-to-br from-[#fdf6e3]/40 to-white">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e5b970]/20 text-[#a07d2a]">
                <Lightbulb className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-semibold tracking-tight">Recomendações da análise</h4>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {analysis.parecerFinal.recomendacoes.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-[#e5b970]/30 bg-white px-3.5 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/90">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ────────────────────────── SUB-COMPONENTS ────────────────────────── */

function KpiTile({ label, value, icon, alert }: { label: string; value: string | null; icon: React.ReactNode; alert?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border bg-white/70 px-3 py-2.5 backdrop-blur-sm',
      alert && value ? 'border-red-200' : 'border-white/60'
    )}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn(
        'mt-1 truncate text-lg font-bold tracking-tight',
        alert && value ? 'text-red-600' : 'text-foreground'
      )}>
        {value || <span className="text-muted-foreground/50">—</span>}
      </p>
    </div>
  );
}

interface Topic { label: string; value?: string; alert?: boolean }

function SourceCard({
  title,
  subtitle,
  icon,
  accent,
  available,
  unavailableMessage,
  headline,
  headlineLabel,
  topics,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  available?: boolean;
  unavailableMessage?: string;
  headline?: string | null;
  headlineLabel?: string;
  topics: Topic[];
}) {
  const [open, setOpen] = useState(false);
  const visibleTopics = topics.filter((t) => !isEmpty(t.value));

  return (
    <Card className="flex flex-col overflow-hidden border-border">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 p-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', accent)}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {available === false && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Indisponível</Badge>
        )}
      </div>

      <div className="flex-1 p-4">
        {available === false ? (
          <p className="text-sm italic text-muted-foreground">{unavailableMessage}</p>
        ) : (
          <>
            {headline && (
              <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{headlineLabel}</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight">{headline}</p>
              </div>
            )}

            {/* primeiros 2 tópicos visíveis */}
            <div className="space-y-2.5">
              {visibleTopics.slice(0, 2).map((t) => (
                <TopicCompact key={t.label} {...t} />
              ))}
            </div>

            {visibleTopics.length > 2 && (
              <>
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                  {open ? 'Ocultar detalhes' : `Ver mais ${visibleTopics.length - 2} tópicos`}
                </button>
                {open && (
                  <div className="mt-3 space-y-2.5 border-t border-dashed border-border pt-3 animate-fade-in">
                    {visibleTopics.slice(2).map((t) => (
                      <TopicCompact key={t.label} {...t} />
                    ))}
                  </div>
                )}
              </>
            )}

            {visibleTopics.length === 0 && (
              <p className="text-sm italic text-muted-foreground">Sem dados extraídos.</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function TopicCompact({ label, value, alert }: Topic) {
  if (!value || isEmpty(value)) return null;
  return (
    <div>
      <p className={cn(
        'text-[10px] font-semibold uppercase tracking-wider',
        alert ? 'text-red-600' : 'text-muted-foreground'
      )}>
        {label}
      </p>
      <p className={cn(
        'mt-0.5 text-sm leading-snug whitespace-pre-line',
        alert ? 'text-red-700' : 'text-foreground/90'
      )}>
        {value}
      </p>
    </div>
  );
}

function CrossRow({ label, value }: { label: string; value?: string }) {
  if (!value || isEmpty(value)) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{value}</p>
    </div>
  );
}
