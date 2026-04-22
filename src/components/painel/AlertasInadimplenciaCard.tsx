import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateBR } from '@/lib/utils';

interface AlertaInadimplencia {
  cedente: string;
  sacado: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
}

interface AlertasInadimplenciaCardProps {
  alertas: AlertaInadimplencia[];
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getSeverity(dias: number): { label: string; className: string } {
  if (dias > 90) return { label: 'Crítico', className: 'bg-red-100 text-red-800 border-red-200' };
  if (dias > 30) return { label: 'Alto', className: 'bg-orange-100 text-orange-800 border-orange-200' };
  return { label: 'Moderado', className: 'bg-amber-100 text-amber-800 border-amber-200' };
}

export function AlertasInadimplenciaCard({ alertas, loading }: AlertasInadimplenciaCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Alertas de Inadimplência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Alertas de Inadimplência
          {alertas.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {alertas.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum título vencido encontrado</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {alertas.map((alerta, idx) => {
                const severity = getSeverity(alerta.diasAtraso);
                const vencDate = formatDateBR(alerta.vencimento, 'N/I');

                return (
                  <div key={idx} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {alerta.cedente}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Sacado: {alerta.sacado}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">
                          {formatCurrency(alerta.valor)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severity.className}`}>
                        {severity.label}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {alerta.diasAtraso} dia{alerta.diasAtraso !== 1 ? 's' : ''} de atraso
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        Venc: {vencDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
