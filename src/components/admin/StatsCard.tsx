import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}

export function StatsCard({ title, value, description, icon: Icon, iconClassName }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${iconClassName || 'bg-primary/10'}`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
