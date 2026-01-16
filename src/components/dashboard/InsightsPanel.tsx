import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  metric?: string;
  icon?: 'trend-up' | 'trend-down' | 'users' | 'dollar' | 'clock' | 'check' | 'x';
}

interface InsightsPanelProps {
  insights: Insight[];
}

const typeStyles = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-l-emerald-500',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-l-amber-500',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-l-red-500',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-l-blue-500',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
};

const iconMap = {
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  'users': Users,
  'dollar': DollarSign,
  'clock': Clock,
  'check': CheckCircle,
  'x': XCircle,
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Insights & Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => {
          const styles = typeStyles[insight.type];
          const IconComponent = insight.icon ? iconMap[insight.icon] : AlertTriangle;
          
          return (
            <div
              key={insight.id}
              className={cn(
                'p-4 rounded-lg border-l-4 transition-colors',
                styles.bg,
                styles.border
              )}
            >
              <div className="flex items-start gap-3">
                <IconComponent className={cn('h-5 w-5 mt-0.5 flex-shrink-0', styles.icon)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{insight.title}</h4>
                    {insight.metric && (
                      <Badge variant="secondary" className={cn('text-xs', styles.badge)}>
                        {insight.metric}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
