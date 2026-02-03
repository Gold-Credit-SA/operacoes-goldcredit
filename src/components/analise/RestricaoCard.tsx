import { AlertTriangle, CheckCircle, FileWarning, Ban, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Restricao } from '@/types/analise';

interface RestricaoCardProps {
  restricoes: {
    protestos: Restricao[];
    chequesSemFundo: Restricao[];
    anotacoesNegativas: Restricao[];
    acoesCiveisFalencia?: Restricao[];
    totalDividas: number;
    possuiRestricao: boolean;
  };
}

interface ItemRestricaoProps {
  titulo: string;
  items: Restricao[];
  icon: React.ElementType;
  iconColor?: string;
}

function ItemRestricao({ titulo, items, icon: Icon, iconColor = 'text-muted-foreground' }: ItemRestricaoProps) {
  const temRestricao = items.length > 0;
  const totalValor = items.reduce((acc, item) => acc + (item.valor || 0), 0);

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-colors",
      temRestricao 
        ? "border-destructive/30 bg-destructive/5" 
        : "border-emerald-500/30 bg-emerald-500/5"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          temRestricao ? "bg-destructive/10" : "bg-emerald-500/10"
        )}>
          {temRestricao ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", temRestricao ? "text-destructive" : iconColor)} />
            <h4 className="text-sm font-semibold text-foreground">{titulo}</h4>
          </div>
          
          {temRestricao ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-destructive font-medium">
                {items.length} registro{items.length > 1 ? 's' : ''} encontrado{items.length > 1 ? 's' : ''}
              </p>
              {totalValor > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total: R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-emerald-600 mt-1">Nada consta</p>
          )}
        </div>
      </div>

      {temRestricao && items.length > 0 && items[0].data && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="space-y-1.5 max-h-24 overflow-y-auto">
            {items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="text-xs text-muted-foreground flex justify-between">
                <span>{item.credor || item.tipo}</span>
                <span className="font-medium">
                  {item.valor > 0 && `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-xs text-primary">+ {items.length - 3} mais...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RestricaoCard({ restricoes }: RestricaoCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Restrições</h3>
        {restricoes.possuiRestricao ? (
          <span className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-full">
            Com Restrições
          </span>
        ) : (
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-semibold rounded-full">
            Sem Restrições
          </span>
        )}
      </div>

      {restricoes.totalDividas > 0 && (
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-sm text-muted-foreground">Total em Dívidas</p>
          <p className="text-2xl font-bold text-destructive">
            R$ {restricoes.totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ItemRestricao
          titulo="Protestos"
          items={restricoes.protestos}
          icon={FileWarning}
        />
        <ItemRestricao
          titulo="Cheques sem Fundo"
          items={restricoes.chequesSemFundo}
          icon={Ban}
        />
        <ItemRestricao
          titulo="Anotações Negativas"
          items={restricoes.anotacoesNegativas}
          icon={AlertTriangle}
        />
        {restricoes.acoesCiveisFalencia && (
          <ItemRestricao
            titulo="Ações/Falências"
            items={restricoes.acoesCiveisFalencia}
            icon={Scale}
          />
        )}
      </div>
    </div>
  );
}
