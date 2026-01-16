import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  format: 'currency' | 'number' | 'percent';
  period: string;
}

interface GoalsProgressProps {
  goals: Goal[];
}

const formatValue = (value: number, format: 'currency' | 'number' | 'percent') => {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value);
};

export function GoalsProgress({ goals }: GoalsProgressProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5 text-primary" />
          Metas e Objetivos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {goals.map((goal) => {
          const percent = Math.min((goal.current / goal.target) * 100, 100);
          const isAchieved = percent >= 100;
          const isClose = percent >= 80;
          
          return (
            <div key={goal.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{goal.name}</h4>
                  <p className="text-xs text-muted-foreground">{goal.period}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'font-bold text-sm',
                    isAchieved ? 'text-emerald-600' : isClose ? 'text-amber-600' : 'text-muted-foreground'
                  )}>
                    {formatValue(goal.current, goal.format)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {formatValue(goal.target, goal.format)}
                  </p>
                </div>
              </div>
              
              <div className="relative">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isAchieved ? 'bg-emerald-500' : isClose ? 'bg-amber-500' : 'bg-primary'
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={cn(
                    'text-xs font-medium',
                    isAchieved ? 'text-emerald-600' : isClose ? 'text-amber-600' : 'text-muted-foreground'
                  )}>
                    {percent.toFixed(0)}% alcançado
                  </span>
                  {isAchieved && (
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Meta atingida!
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
