import { useState } from 'react';
import { Cake, ChevronRight, Gift, PartyPopper, Calendar, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Aniversariante {
  nome: string;
  empresa: string;
  data_nascimento: string;
  dias_faltam: number;
  dia: number;
  mes: number;
  na_carteira: boolean;
}

interface Props {
  aniversariantes: Aniversariante[];
  loading?: boolean;
  className?: string;
}

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function ProximosAniversariantesCard({ aniversariantes, loading, className }: Props) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const navigate = useNavigate();

  const filtered = aniversariantes.filter((item) => {
    if (periodo === 'semana' && item.dias_faltam > 7) return false;
    if (periodo === 'mes' && item.dias_faltam > 30) return false;
    return true;
  });

  const hoje = filtered.filter((item) => item.dias_faltam === 0);
  const proximos = filtered.filter((item) => item.dias_faltam > 0);

  const getDiasFaltamLabel = (dias: number) => {
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Amanha';
    return `em ${dias} dias`;
  };

  const getDiasFaltamColor = (dias: number) => {
    if (dias === 0) return 'bg-primary/15 text-primary border-primary/30';
    if (dias <= 3) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const renderItem = (item: Aniversariante, isToday: boolean) => (
    <button
      key={`${item.nome}-${item.empresa}`}
      onClick={() => navigate(`/consulta?q=${encodeURIComponent(item.empresa)}`)}
      className={cn(
        'group flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-colors',
        isToday
          ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
          : 'border-transparent bg-slate-50/70 hover:border-slate-200 hover:bg-white',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {isToday ? (
          <PartyPopper className="h-5 w-5 shrink-0 text-primary" />
        ) : (
          <Gift className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.nome}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            <p className="truncate text-xs text-muted-foreground">{item.empresa}</p>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            {item.dia} de {MESES[item.mes]}
          </p>
        </div>
      </div>

      <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
        <Badge variant="outline" className={`text-[10px] ${getDiasFaltamColor(item.dias_faltam)}`}>
          {getDiasFaltamLabel(item.dias_faltam)}
        </Badge>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );

  return (
    <Card className={cn('border-slate-200/80 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-xl bg-primary/10 p-2">
              <Cake className="h-4 w-4 text-primary" />
            </div>
            Proximos Aniversarios
            {filtered.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filtered.length}
              </Badge>
            )}
          </CardTitle>
        </div>

        <Tabs value={periodo} onValueChange={(value) => setPeriodo(value as 'semana' | 'mes')} className="mt-2">
          <TabsList className="h-9 w-full rounded-xl bg-slate-100/80 p-1">
            <TabsTrigger value="semana" className="flex-1 rounded-lg text-xs">
              Proximos 7 dias
            </TabsTrigger>
            <TabsTrigger value="mes" className="flex-1 rounded-lg text-xs">
              Proximos 30 dias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhum aniversario nos proximos {periodo === 'semana' ? '7' : '30'} dias
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {hoje.length > 0 && (
              <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">Aniversariantes de hoje</p>
                    <p className="text-xs text-muted-foreground">Acompanhe e retome relacionamento</p>
                  </div>
                  <Badge className="bg-primary/12 text-primary hover:bg-primary/12">{hoje.length}</Badge>
                </div>
                <div className="space-y-1.5">{hoje.map((item) => renderItem(item, true))}</div>
              </div>
            )}

            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {proximos.map((item) => renderItem(item, false))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
