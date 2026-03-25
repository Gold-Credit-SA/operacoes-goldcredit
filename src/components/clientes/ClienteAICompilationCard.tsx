import { useMemo, useState } from 'react';
import { AlertTriangle, Brain, Building2, CreditCard, FileSearch, Loader2, RefreshCw, Shield, Sparkles, TrendingUp, Lightbulb, Users, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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
    resumoDividas?: string; // backwards compat
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

function parecerStyle(value?: string) {
  if (value === 'FAVORAVEL') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  if (value === 'FAVORAVEL_COM_RESTRICOES') return 'bg-amber-500/10 text-amber-700 border-amber-200';
  if (value === 'ATENCAO') return 'bg-orange-500/10 text-orange-700 border-orange-200';
  return 'bg-red-500/10 text-red-700 border-red-200';
}

function parecerLabel(value?: string) {
  if (value === 'FAVORAVEL') return 'FAVORÁVEL';
  if (value === 'FAVORAVEL_COM_RESTRICOES') return 'FAVORÁVEL COM RESTRIÇÕES';
  if (value === 'ATENCAO') return 'ATENÇÃO';
  return 'DESFAVORÁVEL';
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
        smart: latestSmart ? {
          sourceType: 'interna',
          consultaLabel: latestSmart.consulta_label,
          createdAt: latestSmart.created_at,
          data: latestSmart.result_data,
        } : null,
        serasa: latestSerasa ? {
          sourceType: 'externa',
          consultaLabel: latestSerasa.consulta_label,
          createdAt: latestSerasa.created_at,
          data: latestSerasa.result_data,
        } : null,
        scr: latestScr ? {
          sourceType: 'externa',
          consultaLabel: latestScr.consulta_label,
          createdAt: latestScr.created_at,
          data: latestScr.result_data,
        } : null,
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
      toast.success('Compilação com IA concluída.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao compilar dados com IA.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-8 border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,1))]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-amber-700" />
              Compilar dados com IA
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Consolida dados Smart, Serasa e SCR em um parecer de crédito completo.
            </p>
          </div>
          <Button
            onClick={runCompilation}
            disabled={isLoading || !hasAnySource}
            className="gap-2 bg-[linear-gradient(135deg,#5b3418,#AA7128)] text-white hover:opacity-95"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Compilando...</>
            ) : analysis ? (
              <><RefreshCw className="h-4 w-4" /> Atualizar compilação</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Compilar dados com IA</>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!hasAnySource && (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhuma fonte disponível. Execute pelo menos uma consulta (Smart, Serasa ou SCR).
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {analysis && <AnalysisResult analysis={analysis} />}
      </CardContent>
    </Card>
  );
}

/* ─── Sub-components ─── */

function AnalysisResult({ analysis }: { analysis: AICompilation }) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Alerta Crítico */}
      {analysis.alertaCritico && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">⚠ ALERTA CRÍTICO</p>
            <p className="mt-1 text-sm text-red-600">{analysis.alertaCritico}</p>
          </div>
        </div>
      )}

      {/* Serasa Liminar extra */}
      {analysis.serasa?.liminarJudicial && analysis.serasa.alertaLiminar && !analysis.alertaCritico && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">⚠ LIMINAR JUDICIAL DETECTADA</p>
            <p className="mt-1 text-sm text-red-600">{analysis.serasa.alertaLiminar}</p>
          </div>
        </div>
      )}

      {/* Smart Section */}
      <SectionCard
        title="Smart (Dados Internos)"
        icon={<Building2 className="h-4 w-4 text-stone-600" />}
        available={analysis.smart?.disponivel}
      >
        <TopicRow label="Últimas Operações" value={analysis.smart?.ultimasOperacoes} />
        <TopicRow label="Resumo Financeiro" value={analysis.smart?.resumoFinanceiro} />
        <TopicRow label="Limite" value={analysis.smart?.limite} />
        <TopicRow label="Concentração de Sacados" value={analysis.smart?.concentracao} />
        <TopicRow label="Liquidez" value={analysis.smart?.liquidez} />
        <TopicRow label="Taxa de Confirmação" value={analysis.smart?.taxaConfirmacao} />
        <TopicRow label="Comportamento de Pagamento (90d)" value={analysis.smart?.comportamentoPagamento} />
      </SectionCard>

      {/* Serasa Section */}
      <SectionCard
        title="Serasa"
        icon={<Shield className="h-4 w-4 text-blue-600" />}
        available={analysis.serasa?.disponivel}
        unavailableMessage={analysis.serasa?.mensagem}
        badge={analysis.serasa?.tipoRelatorio}
      >
        {analysis.serasa?.disponivel && (
          <>
            {analysis.serasa.liminarJudicial && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">
                ⚠ Liminar Judicial detectada — {analysis.serasa.alertaLiminar || 'Verificar detalhes no relatório completo.'}
              </div>
            )}
            <TopicRow label="Identificação Cadastral" value={analysis.serasa.identificacao} />
            <TopicRow label="Score de Risco" value={analysis.serasa.score} />
            <TopicRow label="Limite de Crédito Sugerido" value={analysis.serasa.limiteCreditoSugerido} />
            <TopicRow label="Anotações Negativas (PEFIN/REFIN/Protestos)" value={analysis.serasa.anotacoesNegativas || analysis.serasa.resumoDividas} />
            <TopicRow label="Ações Judiciais / Falências" value={analysis.serasa.acoesFalencias} />
            <TopicRow label="Cheques Sustados" value={analysis.serasa.chequesSustados} />
            <TopicRow label="Consultas Recentes" value={analysis.serasa.ultimasConsultas} />
            <TopicRow label="QSA (Quadro Societário)" value={analysis.serasa.qsa} />
            <TopicRow label="Histórico de Pagamento" value={analysis.serasa.historicoPagamento} />
            <TopicRow label="Relacionamento com Mercado/Factoring" value={analysis.serasa.relacionamentoMercado} />
            <TopicRow label="Evolução de Compromissos" value={analysis.serasa.evolucaoCompromissos} />
          </>
        )}
      </SectionCard>

      {/* SCR Section */}
      <SectionCard
        title="SCR (Sistema de Informações de Crédito)"
        icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
        available={analysis.scr?.disponivel}
        unavailableMessage={analysis.scr?.mensagem}
      >
        {analysis.scr?.disponivel && (
          <>
            <TopicRow label="Resumo Geral" value={analysis.scr.resumoGeral} />
            <TopicRow label="Créditos a Vencer" value={analysis.scr.creditosAVencer} />
            <TopicRow label="Créditos Vencidos" value={analysis.scr.creditosVencidos} />
            <TopicRow label="Modalidades de Crédito" value={analysis.scr.modalidades} />
            <TopicRow label="Limites de Crédito" value={analysis.scr.limitesCredito} />
            <TopicRow label="Classificação de Risco" value={analysis.scr.classificacaoRisco} />
            <TopicRow label="Discordância / Sub Judice" value={analysis.scr.discordanciaSubJudice} />
          </>
        )}
      </SectionCard>

      {/* Análise Cruzada */}
      {analysis.analiseCruzada && (
        <SectionCard
          title="Análise Cruzada entre Fontes"
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          available={true}
        >
          <TopicRow label="Consistência de Endividamento (SCR vs Serasa)" value={analysis.analiseCruzada.consistenciaEndividamento} />
          <TopicRow label="Capacidade de Pagamento (Smart + Serasa + SCR)" value={analysis.analiseCruzada.capacidadePagamento} />
          <TopicRow label="Sinais de Alerta Identificados" value={analysis.analiseCruzada.sinaisAlerta} highlight />
        </SectionCard>
      )}

      {/* Parecer Final */}
      <Card className="border-amber-200/70 bg-white shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSearch className="h-4 w-4 text-amber-700" />
            Parecer Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="outline" className={`text-sm px-3 py-1 ${parecerStyle(analysis.parecerFinal?.parecer)}`}>
            {parecerLabel(analysis.parecerFinal?.parecer)}
          </Badge>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.parecerFinal?.justificativa}</p>

          {analysis.parecerFinal?.recomendacoes && analysis.parecerFinal.recomendacoes.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                Recomendações
              </p>
              <ul className="space-y-1.5">
                {analysis.parecerFinal.recomendacoes.map((rec, i) => (
                  <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  available,
  unavailableMessage,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  available?: boolean;
  unavailableMessage?: string | null;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-amber-200/70 bg-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          {badge && (
            <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
              {badge}
            </Badge>
          )}
          {available === false && (
            <Badge variant="outline" className="ml-auto text-xs bg-muted/50 text-muted-foreground border-border">
              Indisponível
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {available === false ? (
          <p className="text-sm text-muted-foreground italic">
            {unavailableMessage || 'Dados não disponíveis para esta fonte.'}
          </p>
        ) : (
          <div className="space-y-3">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function TopicRow({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('sem dados') || lower.startsWith('não houve consulta') || lower.startsWith('dados insuficientes') || lower.startsWith('não disponível')) return null;

  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-orange-200 bg-orange-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${highlight ? 'text-orange-700' : 'text-muted-foreground'}`}>{label}</p>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}
