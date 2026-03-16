import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Brain, CheckCircle2, Lightbulb, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
  visaoGeral: string;
  resumoExecutivo: string;
  confiancaAnalise: 'ALTA' | 'MEDIA' | 'BAIXA';
  fontesConsideradas: Array<{
    fonte: string;
    tipo: 'interna' | 'externa';
    status: 'presente' | 'ausente';
    observacao: string;
  }>;
  pontosFortes: string[];
  pontosAtencao: string[];
  inconsistenciasOuLacunas: string[];
  recomendacaoCredito: {
    parecer: 'FAVORAVEL' | 'FAVORAVEL_COM_RESTRICOES' | 'ATENCAO' | 'DESFAVORAVEL';
    justificativa: string;
  };
  proximosPassos: string[];
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

function confidenceStyle(value?: string) {
  if (value === 'ALTA') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  if (value === 'MEDIA') return 'bg-amber-500/10 text-amber-700 border-amber-200';
  return 'bg-red-500/10 text-red-700 border-red-200';
}

function recommendationStyle(value?: string) {
  if (value === 'FAVORAVEL') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  if (value === 'FAVORAVEL_COM_RESTRICOES') return 'bg-amber-500/10 text-amber-700 border-amber-200';
  if (value === 'ATENCAO') return 'bg-orange-500/10 text-orange-700 border-orange-200';
  return 'bg-red-500/10 text-red-700 border-red-200';
}

export function ClienteAICompilationCard({ client, history, agriskOverview }: Props) {
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
        agrisk: agriskOverview ? {
          sourceType: 'externa',
          consultaLabel: agriskOverview.consulta_label,
          createdAt: agriskOverview.created_at,
          data: agriskOverview.result_data,
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
  }, [client, history, agriskOverview]);

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
      toast.success('Resumo consolidado com IA concluido.');
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
              A IA consolida os dados internos do Smart com as consultas externas do cliente.
            </p>
          </div>
          <Button
            onClick={runCompilation}
            disabled={isLoading || !hasAnySource}
            className="gap-2 bg-[linear-gradient(135deg,#5b3418,#AA7128)] text-white hover:opacity-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compilando...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar resumo
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Compilar dados com IA
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!hasAnySource && (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhuma fonte disponivel para consolidacao ainda. Execute pelo menos uma consulta externa ou a consulta interna Smart.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {analysis && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <div className="rounded-2xl border border-amber-200/70 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={confidenceStyle(analysis.confiancaAnalise)}>
                    Confianca {analysis.confiancaAnalise}
                  </Badge>
                  <Badge variant="outline" className={recommendationStyle(analysis.recomendacaoCredito?.parecer)}>
                    {analysis.recomendacaoCredito?.parecer}
                  </Badge>
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground">{analysis.visaoGeral}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.resumoExecutivo}</p>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Fontes consideradas</p>
                <div className="mt-4 space-y-3">
                  {analysis.fontesConsideradas?.map((fonte) => (
                    <div key={`${fonte.fonte}-${fonte.tipo}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{fonte.fonte}</p>
                        <Badge variant="outline" className={fonte.tipo === 'interna' ? 'border-stone-200 text-stone-700' : 'border-amber-200 text-amber-700'}>
                          {fonte.tipo}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fonte.status} · {fonte.observacao}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionList
                title="Pontos fortes"
                items={analysis.pontosFortes}
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                emptyText="Nenhum ponto forte destacado."
              />
              <SectionList
                title="Pontos de atencao"
                items={analysis.pontosAtencao}
                icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
                emptyText="Nenhum ponto de atencao destacado."
              />
            </div>

            <SectionList
              title="Inconsistencias ou lacunas"
              items={analysis.inconsistenciasOuLacunas}
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              emptyText="Nenhuma inconsistencia relevante encontrada."
            />

            <Card className="border-amber-200/70 bg-white shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recomendacao de credito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline" className={recommendationStyle(analysis.recomendacaoCredito?.parecer)}>
                  {analysis.recomendacaoCredito?.parecer}
                </Badge>
                <p className="text-sm text-muted-foreground">{analysis.recomendacaoCredito?.justificativa}</p>
              </CardContent>
            </Card>

            <SectionList
              title="Proximos passos"
              items={analysis.proximosPassos}
              icon={<Lightbulb className="h-4 w-4 text-amber-700" />}
              emptyText="Nenhum proximo passo sugerido."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionList({
  title,
  items,
  icon,
  emptyText,
}: {
  title: string;
  items?: string[];
  icon: ReactNode;
  emptyText: string;
}) {
  return (
    <Card className="border-amber-200/70 bg-white shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={`${title}-${index}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
