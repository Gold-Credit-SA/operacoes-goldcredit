import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  DollarSign, 
  FileText, 
  Percent,
  CreditCard
} from 'lucide-react';

interface ResumoExpandidoProps {
  resumoExpandido: {
    volumeOperado: number;
    prazoMedioOperacoes: number;
    prazoMedioTitulos90Dias: number;
    mediaPagoEmAtraso: number;
    valorMedioBorderos: number;
    valorMedioTitulos: number;
    receitaGerada: number;
    percentualProrrogacao: number;
    chqDevolvidosAberto: number;
    chqDevolvidosQuitado: number;
  };
  limites: {
    global: number;
    risco: number;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function ResumoExpandido({ resumoExpandido, limites }: ResumoExpandidoProps) {
  const metrics = [
    {
      icon: TrendingUp,
      label: 'Volume Operado',
      value: formatCurrency(resumoExpandido.volumeOperado),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      icon: DollarSign,
      label: 'Receita Gerada',
      value: formatCurrency(resumoExpandido.receitaGerada),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      icon: Percent,
      label: 'Prorrogação',
      value: `${formatNumber(resumoExpandido.percentualProrrogacao, 1)}%`,
      color: resumoExpandido.percentualProrrogacao > 10 ? 'text-amber-600' : 'text-emerald-600',
      bgColor: resumoExpandido.percentualProrrogacao > 10 ? 'bg-amber-50' : 'bg-emerald-50',
    },
    {
      icon: Clock,
      label: 'Prazo Médio Vencto',
      value: `${formatNumber(resumoExpandido.prazoMedioOperacoes, 0)} dias`,
      sublabel: 'Títulos operados',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      icon: Calendar,
      label: 'Prazo Médio (90 Dias)',
      value: `${formatNumber(resumoExpandido.prazoMedioTitulos90Dias, 0)} dias`,
      sublabel: 'Últimos 90 dias',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      icon: AlertTriangle,
      label: 'Média Pago em Atraso',
      value: `${formatNumber(resumoExpandido.mediaPagoEmAtraso, 1)} dias`,
      color: resumoExpandido.mediaPagoEmAtraso > 15 ? 'text-red-600' : 'text-orange-600',
      bgColor: resumoExpandido.mediaPagoEmAtraso > 15 ? 'bg-red-50' : 'bg-orange-50',
    },
    {
      icon: FileText,
      label: 'Valor Médio Borderôs',
      value: formatCurrency(resumoExpandido.valorMedioBorderos),
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      icon: FileText,
      label: 'Valor Médio Títulos',
      value: formatCurrency(resumoExpandido.valorMedioTitulos),
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      icon: CreditCard,
      label: 'CHQ Devolvidos',
      value: `${resumoExpandido.chqDevolvidosAberto} / ${resumoExpandido.chqDevolvidosQuitado}`,
      sublabel: 'Aberto / Quitado',
      color: resumoExpandido.chqDevolvidosAberto > 0 ? 'text-red-600' : 'text-gray-600',
      bgColor: resumoExpandido.chqDevolvidosAberto > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Resumo Financeiro Expandido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className={`${metric.bgColor} rounded-lg p-3 transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-2">
                <div className={`${metric.color} mt-0.5`}>
                  <metric.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                  <p className={`text-sm font-semibold ${metric.color} mt-0.5`}>
                    {metric.value}
                  </p>
                  {metric.sublabel && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{metric.sublabel}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Limites resumidos */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Limite Global</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(limites.global)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Risco Atual</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(limites.risco)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Utilização</p>
              <p className={`text-sm font-semibold ${
                limites.global > 0 && (limites.risco / limites.global) > 0.8 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {limites.global > 0 ? formatNumber((limites.risco / limites.global) * 100, 1) : 0}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
