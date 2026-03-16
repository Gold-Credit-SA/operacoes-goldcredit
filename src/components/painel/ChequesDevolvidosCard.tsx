import { AlertTriangle, ChevronRight, CircleAlert, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChequeDevolvido {
  cpf_cnpj: string;
  nome: string;
  qtd_cheques: number;
  valor_total: number;
}

interface Props {
  chequesDevolvidos: ChequeDevolvido[];
  loading?: boolean;
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ChequesDevolvidosCard({ chequesDevolvidos, loading, className }: Props) {
  const navigate = useNavigate();
  const totalValor = chequesDevolvidos.reduce((sum, item) => sum + item.valor_total, 0);
  const totalQtd = chequesDevolvidos.reduce((sum, item) => sum + item.qtd_cheques, 0);
  const hasCheques = chequesDevolvidos.length > 0;

  return (
    <Card className={cn('border-slate-200/80 shadow-sm', hasCheques ? 'border-destructive/25' : '', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={cn('rounded-xl p-2', hasCheques ? 'bg-destructive/10' : 'bg-slate-100')}>
              <AlertTriangle className={cn('h-4 w-4', hasCheques ? 'text-destructive' : 'text-muted-foreground')} />
            </div>
            Cheques Devolvidos
          </CardTitle>
          {!loading && hasCheques && (
            <Badge variant="destructive" className="text-xs">
              {totalQtd} cheque(s)
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            {[1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !hasCheques ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500/30" />
            <p className="text-sm font-medium text-green-600">Nenhum cheque devolvido</p>
            <p className="mt-1 text-xs text-muted-foreground">Tudo certo por aqui</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-destructive/15 bg-destructive/5 p-4">
              <div className="mb-1 flex items-center gap-2">
                <CircleAlert className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">Atencao necessaria</span>
              </div>
              <p className="font-mono text-xl font-bold text-destructive">{formatCurrency(totalValor)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalQtd} cheque(s) em {chequesDevolvidos.length} cedente(s)
              </p>
            </div>

            <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
              {chequesDevolvidos.map((item) => (
                <button
                  key={item.cpf_cnpj}
                  onClick={() => navigate(`/consulta?q=${encodeURIComponent(item.cpf_cnpj)}`)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-transparent bg-slate-50/70 p-3 text-left transition-colors hover:border-slate-200 hover:bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">{item.cpf_cnpj}</p>
                  </div>

                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <Badge variant={item.qtd_cheques >= 3 ? 'destructive' : 'secondary'} className="mb-0.5 text-[10px]">
                        {item.qtd_cheques}x
                      </Badge>
                      <p className="font-mono text-xs font-medium text-destructive">
                        {formatCurrency(item.valor_total)}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
