import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Target,
  Shield,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CedenteDetail } from '@/pages/CedenteConsulta';
import { toast } from 'sonner';

interface AnaliseIAProps {
  data: CedenteDetail;
}

interface AIAnalysis {
  saudeGeral: 'EXCELENTE' | 'BOA' | 'REGULAR' | 'ATENÇÃO' | 'CRÍTICA';
  scoreRisco: number;
  resumoExecutivo: string;
  indicadores: Array<{
    nome: string;
    status: 'positivo' | 'neutro' | 'negativo';
    descricao: string;
  }>;
  recomendacaoLimite: {
    acao: 'AUMENTAR' | 'MANTER' | 'REDUZIR' | 'SUSPENDER';
    percentual: number;
    justificativa: string;
  };
  giroCarteira: {
    recomendado: boolean;
    motivo: string;
    diasDesdeUltimaOperacao: number;
  };
  alertas: string[];
  oportunidades: string[];
  acoesSugeridas: string[];
}

const saudeConfig = {
  'EXCELENTE': { color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', icon: CheckCircle },
  'BOA': { color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', icon: CheckCircle },
  'REGULAR': { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', icon: Minus },
  'ATENÇÃO': { color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', icon: AlertTriangle },
  'CRÍTICA': { color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', icon: AlertTriangle },
};

const acaoLimiteConfig = {
  'AUMENTAR': { icon: ArrowUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'MANTER': { icon: Minus, color: 'text-blue-600', bg: 'bg-blue-50' },
  'REDUZIR': { icon: ArrowDown, color: 'text-orange-600', bg: 'bg-orange-50' },
  'SUSPENDER': { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
};

export function AnaliseIA({ data }: AnaliseIAProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('analyze-cedente', {
        body: { cedenteData: data }
      });

      if (fnError) throw fnError;
      
      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.analysis) {
        setAnalysis(result.analysis);
        toast.success('Análise de IA concluída!');
      }
    } catch (err) {
      console.error('Error running AI analysis:', err);
      const message = err instanceof Error ? err.message : 'Erro ao executar análise';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis) {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
              <Brain className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Análise de IA</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Utilize inteligência artificial para analisar a carteira do cedente, 
              identificar riscos, oportunidades e receber recomendações personalizadas.
            </p>
          </div>
          <Button 
            onClick={runAnalysis} 
            disabled={isLoading}
            size="lg"
            className="gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                Executar Análise
              </>
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const saudeInfo = saudeConfig[analysis.saudeGeral] || saudeConfig['REGULAR'];
  const SaudeIcon = saudeInfo.icon;
  const acaoInfo = acaoLimiteConfig[analysis.recomendacaoLimite.acao] || acaoLimiteConfig['MANTER'];
  const AcaoIcon = acaoInfo.icon;

  return (
    <div className="space-y-4">
      {/* Header com Score e Saúde */}
      <Card className="overflow-hidden">
        <div className={`${saudeInfo.bgLight} border-b`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Análise de IA</CardTitle>
                  <p className="text-xs text-muted-foreground">Powered by AI</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runAnalysis}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
            </div>
          </CardHeader>
        </div>
        
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Score de Risco */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">Score de Risco</span>
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * analysis.scoreRisco) / 100}
                    className={analysis.scoreRisco >= 70 ? 'text-emerald-500' : analysis.scoreRisco >= 40 ? 'text-yellow-500' : 'text-red-500'}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                  {analysis.scoreRisco}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {analysis.scoreRisco >= 70 ? 'Baixo Risco' : analysis.scoreRisco >= 40 ? 'Risco Moderado' : 'Alto Risco'}
              </span>
            </div>

            {/* Saúde Geral */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">Saúde Geral</span>
              <div className={`flex items-center justify-center w-16 h-16 rounded-full ${saudeInfo.bgLight}`}>
                <SaudeIcon className={`h-8 w-8 ${saudeInfo.textColor}`} />
              </div>
              <Badge variant="outline" className={`${saudeInfo.textColor} ${saudeInfo.bgLight} border-0`}>
                {analysis.saudeGeral}
              </Badge>
            </div>

            {/* Giro de Carteira */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">Giro de Carteira</span>
              <div className={`flex items-center justify-center w-16 h-16 rounded-full ${analysis.giroCarteira.recomendado ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                <Target className={`h-8 w-8 ${analysis.giroCarteira.recomendado ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
              <Badge variant="outline" className={analysis.giroCarteira.recomendado ? 'text-emerald-600 bg-emerald-50' : 'text-orange-600 bg-orange-50'}>
                {analysis.giroCarteira.recomendado ? 'Recomendado' : 'Não Recomendado'}
              </Badge>
              {analysis.giroCarteira.diasDesdeUltimaOperacao > 0 && (
                <span className="text-xs text-muted-foreground">
                  {analysis.giroCarteira.diasDesdeUltimaOperacao} dias sem operação
                </span>
              )}
            </div>
          </div>

          {/* Resumo Executivo */}
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
            <p className="text-sm text-foreground">{analysis.resumoExecutivo}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recomendação de Limite */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Recomendação de Limite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-4 p-4 rounded-xl ${acaoInfo.bg}`}>
            <div className={`flex items-center justify-center w-12 h-12 rounded-full bg-white`}>
              <AcaoIcon className={`h-6 w-6 ${acaoInfo.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${acaoInfo.color}`}>{analysis.recomendacaoLimite.acao}</span>
                {analysis.recomendacaoLimite.acao !== 'MANTER' && analysis.recomendacaoLimite.acao !== 'SUSPENDER' && (
                  <Badge variant="secondary" className="text-xs">
                    {analysis.recomendacaoLimite.acao === 'AUMENTAR' ? '+' : '-'}{analysis.recomendacaoLimite.percentual}%
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{analysis.recomendacaoLimite.justificativa}</p>
            </div>
          </div>
          
          {/* Motivo Giro Carteira */}
          <div className="mt-4 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Giro de Carteira</p>
                <p className="text-xs text-muted-foreground">{analysis.giroCarteira.motivo}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores */}
      {analysis.indicadores && analysis.indicadores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Indicadores Chave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.indicadores.map((ind, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    ind.status === 'positivo' ? 'bg-emerald-50/50 border-emerald-200' :
                    ind.status === 'negativo' ? 'bg-red-50/50 border-red-200' :
                    'bg-muted/30'
                  }`}
                >
                  {ind.status === 'positivo' ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : ind.status === 'negativo' ? (
                    <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ind.nome}</p>
                    <p className="text-xs text-muted-foreground">{ind.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertas e Oportunidades */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Alertas */}
        {analysis.alertas && analysis.alertas.length > 0 && (
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.alertas.map((alerta, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <span className="text-orange-800">{alerta}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Oportunidades */}
        {analysis.oportunidades && analysis.oportunidades.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <Lightbulb className="h-4 w-4" />
                Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.oportunidades.map((op, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span className="text-emerald-800">{op}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ações Sugeridas */}
      {analysis.acoesSugeridas && analysis.acoesSugeridas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Ações Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {analysis.acoesSugeridas.map((acao, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                    {idx + 1}
                  </span>
                  <span>{acao}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
