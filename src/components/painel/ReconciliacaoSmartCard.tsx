import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ScaleIcon } from 'lucide-react';

interface BreakdownRow {
  situacao: string;
  etapa: string | null;
  qtd: number;
  valor: number;
}

interface ReconciliacaoData {
  totalGeralAberto: number;
  totalDocumental: number;
  carteiraConvencional: number;
  inadimplenciaSmart: number;
  breakdown: BreakdownRow[];
}

interface Props {
  data?: ReconciliacaoData;
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Reconciliação automática:
 *  - Carteira (Convencional) = Σ títulos em aberto com situação 'Aberto' fora da etapa Documental
 *  - Inadimplência = Σ títulos cuja situação contém 'Inadimpl'
 *  - Total Geral = Σ de todos os títulos em aberto
 *
 * A consistência é validada quando:
 *    Carteira + Documental + (demais situações Aberto c/...) = Total Geral
 */
export function ReconciliacaoSmartCard({ data, loading }: Props) {
  const [open, setOpen] = useState(false);

  if (loading || !data) {
    return (
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ScaleIcon className="h-5 w-5 text-slate-600" />
            Reconciliação Smart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const somaBreakdown = data.breakdown.reduce((acc, b) => acc + b.valor, 0);
  const diff = Math.abs(somaBreakdown - data.totalGeralAberto);
  const consistente = diff < 0.5;

  const carteiraPct = data.totalGeralAberto > 0
    ? (data.carteiraConvencional / data.totalGeralAberto) * 100
    : 0;
  const inadPct = data.totalGeralAberto > 0
    ? (data.inadimplenciaSmart / data.totalGeralAberto) * 100
    : 0;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ScaleIcon className="h-5 w-5 text-slate-600" />
          Reconciliação Smart
          {consistente ? (
            <Badge variant="outline" className="ml-auto gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Consistente
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto gap-1 border-amber-200 bg-amber-50 text-amber-700">
              <AlertCircle className="h-3 w-3" />
              Divergência {formatCurrency(diff)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-xs text-muted-foreground">Total Geral (Aberto)</p>
            <p className="mt-1 font-bold text-foreground">{formatCurrency(data.totalGeralAberto)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <p className="text-xs text-muted-foreground">Carteira (Convencional)</p>
            <p className="mt-1 font-bold text-blue-700">{formatCurrency(data.carteiraConvencional)}</p>
            <p className="text-[10px] text-muted-foreground">{carteiraPct.toFixed(1)}% do total</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
            <p className="text-xs text-muted-foreground">Inadimplência</p>
            <p className="mt-1 font-bold text-red-700">{formatCurrency(data.inadimplenciaSmart)}</p>
            <p className="text-[10px] text-muted-foreground">{inadPct.toFixed(1)}% do total</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(o => !o)}
          className="w-full justify-between text-xs"
        >
          Detalhamento por situação ({data.breakdown.length})
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {open && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Situação</th>
                  <th className="px-3 py-2 text-left font-medium">Etapa</th>
                  <th className="px-3 py-2 text-right font-medium">Qtd</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.breakdown.map((b, i) => {
                  const isCarteira = b.situacao === 'Aberto' && b.etapa !== 'Documental';
                  const isInad = /inadimpl/i.test(b.situacao);
                  return (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-3 py-1.5">
                        {b.situacao}
                        {isCarteira && (
                          <Badge variant="outline" className="ml-2 border-blue-200 bg-blue-50 text-[9px] text-blue-700">
                            Carteira
                          </Badge>
                        )}
                        {isInad && (
                          <Badge variant="outline" className="ml-2 border-red-200 bg-red-50 text-[9px] text-red-700">
                            Inad.
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{b.etapa || '—'}</td>
                      <td className="px-3 py-1.5 text-right">{b.qtd}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(b.valor)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-semibold">
                  <td className="px-3 py-1.5" colSpan={2}>Total</td>
                  <td className="px-3 py-1.5 text-right">
                    {data.breakdown.reduce((a, b) => a + b.qtd, 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(somaBreakdown)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Compare os valores acima com o relatório oficial do Smart. Pequenas diferenças (&lt;1%) podem ocorrer por baixas processadas no dia.
        </p>
      </CardContent>
    </Card>
  );
}
