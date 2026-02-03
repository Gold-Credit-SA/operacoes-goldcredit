import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  valor: number;
  faixa?: string;
  descricao?: string;
  probabilidadePagamento?: number;
  fonte?: string;
}

function getScoreColor(valor: number): { bg: string; text: string; level: string } {
  if (valor >= 800) return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', level: 'Excelente' };
  if (valor >= 600) return { bg: 'bg-green-500/10', text: 'text-green-500', level: 'Bom' };
  if (valor >= 400) return { bg: 'bg-amber-500/10', text: 'text-amber-500', level: 'Moderado' };
  if (valor >= 200) return { bg: 'bg-orange-500/10', text: 'text-orange-500', level: 'Baixo' };
  return { bg: 'bg-destructive/10', text: 'text-destructive', level: 'Crítico' };
}

function getScoreIcon(valor: number) {
  if (valor >= 600) return TrendingUp;
  if (valor >= 400) return Minus;
  return TrendingDown;
}

export function ScoreCard({ valor, faixa, descricao, probabilidadePagamento, fonte }: ScoreCardProps) {
  const scoreInfo = getScoreColor(valor);
  const Icon = getScoreIcon(valor);

  return (
    <div className={cn("p-5 rounded-xl border border-border", scoreInfo.bg)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Score de Crédito {fonte && `(${fonte})`}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={cn("text-4xl font-bold", scoreInfo.text)}>
              {valor}
            </span>
            <span className="text-sm text-muted-foreground">
              / 1000
            </span>
          </div>
        </div>
        
        <div className={cn("p-2 rounded-lg", scoreInfo.bg)}>
          <Icon className={cn("h-6 w-6", scoreInfo.text)} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Classificação</span>
          <span className={cn("text-sm font-semibold", scoreInfo.text)}>
            {descricao || scoreInfo.level}
          </span>
        </div>

        {faixa && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Faixa</span>
            <span className="text-sm font-medium text-foreground">{faixa}</span>
          </div>
        )}

        {probabilidadePagamento != null && typeof probabilidadePagamento === 'number' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Prob. Pagamento</span>
            <span className="text-sm font-medium text-foreground">
              {probabilidadePagamento.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Score bar */}
      <div className="mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", scoreInfo.text.replace('text-', 'bg-'))}
            style={{ width: `${(valor / 1000) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>0</span>
          <span>500</span>
          <span>1000</span>
        </div>
      </div>
    </div>
  );
}
