import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb,
  BarChart3,
  MessageSquare,
  Target,
  Search,
  Layers,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { AnaliseDocumento } from '@/types/analise';

interface AnaliseDetalhadaCardProps {
  analise: AnaliseDocumento;
}

function AnaliseSection({ 
  title, 
  content, 
  icon: Icon 
}: { 
  title: string; 
  content: string; 
  icon: React.ElementType;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed pl-8">
        {content}
      </p>
    </div>
  );
}

function AlertasList({ alertas }: { alertas: string[] }) {
  if (!alertas || alertas.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <h4 className="font-semibold text-sm text-destructive">Alertas Críticos</h4>
      </div>
      <ul className="space-y-1.5 pl-8">
        {alertas.map((alerta, idx) => (
          <li key={idx} className="text-sm text-destructive/80 flex items-start gap-2">
            <span className="text-destructive mt-1.5">•</span>
            {alerta}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PontosFortesList({ pontos }: { pontos: string[] }) {
  if (!pontos || pontos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <h4 className="font-semibold text-sm text-emerald-600">Pontos Fortes</h4>
      </div>
      <ul className="space-y-1.5 pl-8">
        {pontos.map((ponto, idx) => (
          <li key={idx} className="text-sm text-emerald-600/80 flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
            {ponto}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SugestoesList({ sugestoes }: { sugestoes: string[] }) {
  if (!sugestoes || sugestoes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/10">
          <Lightbulb className="h-4 w-4 text-amber-500" />
        </div>
        <h4 className="font-semibold text-sm text-amber-600">Sugestões de Melhoria</h4>
      </div>
      <ul className="space-y-1.5 pl-8">
        {sugestoes.map((sugestao, idx) => (
          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-amber-500 mt-1.5">→</span>
            {sugestao}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QualidadeIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-destructive';
  };

  const getLabel = () => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    return 'Insuficiente';
  };

  const getProgressColor = () => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-destructive';
  };

  return (
    <div className="p-4 bg-muted/50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Qualidade do Documento</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getColor()}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 ${getProgressColor()} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={`text-xs mt-1.5 ${getColor()}`}>{getLabel()}</p>
    </div>
  );
}

export function AnaliseDetalhadaCard({ analise }: AnaliseDetalhadaCardProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Análise Detalhada do Documento</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Análise crítica e insights para tomada de decisão
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Score de Qualidade */}
        <QualidadeIndicator score={analise.scoreQualidade} />

        {/* Resumo */}
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm text-foreground">Resumo Executivo</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analise.resumo}
          </p>
        </div>

        {/* Alertas e Pontos Fortes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10">
            <AlertasList alertas={analise.alertas} />
          </div>
          <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
            <PontosFortesList pontos={analise.pontosFortes} />
          </div>
        </div>

        {/* Seções de Análise */}
        <div className="space-y-4 divide-y divide-border">
          <AnaliseSection
            title="Estrutura e Organização"
            content={analise.estruturaOrganizacao}
            icon={Layers}
          />
          
          <div className="pt-4">
            <AnaliseSection
              title="Clareza e Linguagem"
              content={analise.clarezaLinguagem}
              icon={MessageSquare}
            />
          </div>
          
          <div className="pt-4">
            <AnaliseSection
              title="Consistência dos Dados"
              content={analise.argumentacaoConsistencia}
              icon={Target}
            />
          </div>
          
          <div className="pt-4">
            <AnaliseSection
              title="Aspectos Críticos"
              content={analise.aspectosCriticos}
              icon={Search}
            />
          </div>
          
          <div className="pt-4">
            <AnaliseSection
              title="Relevância para Decisão de Crédito"
              content={analise.relevanciaAplicabilidade}
              icon={Target}
            />
          </div>
        </div>

        {/* Sugestões */}
        <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/10">
          <SugestoesList sugestoes={analise.sugestoesMelhoria} />
        </div>
      </CardContent>
    </Card>
  );
}