import { AlertTriangle, ChevronRight, CircleAlert, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface ChequeDevolvido {
  cpf_cnpj: string;
  nome: string;
  qtd_cheques: number;
  valor_total: number;
}

interface Props {
  chequesDevolvidos: ChequeDevolvido[];
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ChequesDevolvidosCard({ chequesDevolvidos, loading }: Props) {
  const navigate = useNavigate();
  const totalValor = chequesDevolvidos.reduce((sum, c) => sum + c.valor_total, 0);
  const totalQtd = chequesDevolvidos.reduce((sum, c) => sum + c.qtd_cheques, 0);
  const hasCheques = chequesDevolvidos.length > 0;

  return (
    <Card className={`col-span-full lg:col-span-1 ${hasCheques ? 'border-destructive/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${hasCheques ? 'bg-destructive/10' : 'bg-muted'}`}>
              <AlertTriangle className={`h-4 w-4 ${hasCheques ? 'text-destructive' : 'text-muted-foreground'}`} />
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
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
            {[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
          </div>
        ) : !hasCheques ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-10 w-10 text-green-500/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-green-600 dark:text-green-400">Nenhum cheque devolvido</p>
            <p className="text-xs text-muted-foreground mt-1">Tudo certo por aqui ✅</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Critical summary */}
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
              <div className="flex items-center gap-2 mb-1">
                <CircleAlert className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">Atenção necessária</span>
              </div>
              <p className="text-xl font-bold text-destructive font-mono">
                {formatCurrency(totalValor)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalQtd} cheque(s) em {chequesDevolvidos.length} cedente(s)
              </p>
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {chequesDevolvidos.map(c => (
                <button
                  key={c.cpf_cnpj}
                  onClick={() => navigate(`/consulta?q=${encodeURIComponent(c.cpf_cnpj)}`)}
                  className="flex items-center justify-between w-full p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cpf_cnpj}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <div className="text-right">
                      <Badge variant={c.qtd_cheques >= 3 ? 'destructive' : 'secondary'} className="text-[10px] mb-0.5">
                        {c.qtd_cheques}x
                      </Badge>
                      <p className="text-xs font-medium font-mono text-destructive">
                        {formatCurrency(c.valor_total)}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
