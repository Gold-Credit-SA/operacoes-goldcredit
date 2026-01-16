import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  target?: number;
  current?: number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  format?: 'currency' | 'number' | 'percent';
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const formatValue = (value: number, format: 'currency' | 'number' | 'percent' = 'number') => {
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

const colorClasses = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    progress: 'bg-primary',
  },
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    progress: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    progress: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    progress: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    progress: 'bg-blue-500',
  },
};

export function KPICard({
  title,
  value,
  target,
  current,
  icon: Icon,
  trend,
  trendValue,
  format = 'number',
  color = 'primary',
}: KPICardProps) {
  const colors = colorClasses[color];
  const progressPercent = target && current ? Math.min((current / target) * 100, 100) : 0;
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl', colors.bg)}>
            <Icon className={cn('h-5 w-5', colors.text)} />
          </div>
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trendValue}
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-bold', colors.text)}>
            {typeof value === 'number' ? formatValue(value, format) : value}
          </p>
        </div>

        {target !== undefined && current !== undefined && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta: {formatValue(target, format)}</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full rounded-full transition-all duration-500', colors.progress)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
