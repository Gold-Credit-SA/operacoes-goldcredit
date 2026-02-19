import { Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SaldoTrustee {
  cpf_cnpj: string;
  nome: string;
  saldo_trustee: number;
}

interface Props {
  saldoTrustee: SaldoTrustee[];
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

export function SaldosCard({ saldoTrustee, loading }: Props) {
  const total = saldoTrustee.reduce((sum, s) => sum + s.saldo_trustee, 0);
  const top5 = saldoTrustee.slice(0, 5);
  const restCount = Math.max(0, saldoTrustee.length - 5);
  const restTotal = saldoTrustee.slice(5).reduce((s, x) => s + x.saldo_trustee, 0);

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            Saldo Trustee
          </CardTitle>
          {!loading && saldoTrustee.length > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              {formatCompact(total)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : saldoTrustee.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum saldo trustee encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total consolidado</span>
                <span className="text-xs text-muted-foreground">{saldoTrustee.length} cedente(s)</span>
              </div>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Top cedentes */}
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {top5.map((s, i) => {
                const pct = total > 0 ? (s.saldo_trustee / total) * 100 : 0;
                return (
                  <div key={s.cpf_cnpj} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-xs text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500/60 rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium font-mono text-blue-600 dark:text-blue-400 shrink-0">
                      {formatCompact(s.saldo_trustee)}
                    </span>
                  </div>
                );
              })}
              {restCount > 0 && (
                <div className="flex items-center justify-between p-2 text-xs text-muted-foreground">
                  <span>+ {restCount} outros</span>
                  <span className="font-mono">{formatCompact(restTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
