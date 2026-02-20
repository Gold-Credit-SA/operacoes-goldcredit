import { useState } from 'react';
import { Cake, ChevronRight, Gift, PartyPopper, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

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
}

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function ProximosAniversariantesCard({ aniversariantes, loading }: Props) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const navigate = useNavigate();

  const filtered = aniversariantes.filter(a => {
    if (periodo === 'semana' && a.dias_faltam > 7) return false;
    if (periodo === 'mes' && a.dias_faltam > 30) return false;
    return true;
  });

  const hoje = filtered.filter(a => a.dias_faltam === 0);
  const proximos = filtered.filter(a => a.dias_faltam > 0);

  const getDiasFaltamLabel = (dias: number) => {
    if (dias === 0) return 'Hoje! 🎉';
    if (dias === 1) return 'Amanhã';
    return `em ${dias} dias`;
  };

  const getDiasFaltamColor = (dias: number) => {
    if (dias === 0) return 'bg-primary/20 text-primary border-primary/30';
    if (dias <= 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  const renderItem = (a: Aniversariante, isToday: boolean) => (
    <button
      key={`${a.nome}-${a.empresa}`}
      onClick={() => navigate(`/consulta?q=${encodeURIComponent(a.empresa)}`)}
      className={`flex items-center justify-between w-full p-3 rounded-lg transition-colors text-left group ${
        isToday
          ? 'bg-primary/5 border border-primary/20 hover:bg-primary/10'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isToday ? (
          <PartyPopper className="h-5 w-5 text-primary shrink-0" />
        ) : (
          <Gift className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{a.nome}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Building2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{a.empresa}</p>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{a.dia} de {MESES[a.mes]}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge
          variant="outline"
          className={`text-[10px] ${isToday ? 'bg-primary/20 text-primary border-primary/30' : getDiasFaltamColor(a.dias_faltam)}`}
        >
          {getDiasFaltamLabel(a.dias_faltam)}
        </Badge>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Cake className="h-4 w-4 text-primary" />
            </div>
            Próximos Aniversários
            {filtered.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filtered.length}
              </Badge>
            )}
          </CardTitle>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as 'semana' | 'mes')} className="mt-2">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="semana" className="text-xs flex-1">Próximos 7 dias</TabsTrigger>
            <TabsTrigger value="mes" className="text-xs flex-1">Próximos 30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum aniversário nos próximos {periodo === 'semana' ? '7' : '30'} dias
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {hoje.map(a => renderItem(a, true))}
            {proximos.map(a => renderItem(a, false))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
