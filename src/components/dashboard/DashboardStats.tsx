import { Card, CardContent } from '@/components/ui/card';
import { Users, FileText, DollarSign, Clock, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';

interface StatsData {
  counts: {
    cedentes: number;
    operacoes: number;
    receitas: number;
    titulosAberto: number;
    titulosQuitados: number;
    titulosProrrogados: number;
    titulosRecomprados: number;
  };
  totals: {
    receita: number;
    operacoesBruto: number;
    operacoesLiquido: number;
    operacoesReceita: number;
  };
}

interface DashboardStatsProps {
  stats: StatsData;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

export function DashboardStats({ stats }: DashboardStatsProps) {
  const statsCards = [
    {
      title: 'Cedentes',
      value: formatNumber(stats.counts.cedentes),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Operações',
      value: formatNumber(stats.counts.operacoes),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Receita Total',
      value: formatCurrency(stats.totals.receita),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Títulos Aberto',
      value: formatNumber(stats.counts.titulosAberto),
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Títulos Quitados',
      value: formatNumber(stats.counts.titulosQuitados),
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Títulos Prorrogados',
      value: formatNumber(stats.counts.titulosProrrogados),
      icon: RotateCcw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Títulos Recomprados',
      value: formatNumber(stats.counts.titulosRecomprados),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {statsCards.map((stat) => (
        <Card key={stat.title} className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {stat.title}
                </p>
                <p className="text-lg font-bold text-foreground truncate">
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
