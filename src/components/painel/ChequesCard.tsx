import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ChequeDevolvido {
  cpf_cnpj: string;
  nome: string;
  qtd_cheques: number;
  valor_total: number;
}

interface ChequesCardProps {
  chequesDevolvidos: ChequeDevolvido[];
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ChequesCard({ chequesDevolvidos, loading }: ChequesCardProps) {
  const totalValor = chequesDevolvidos.reduce((sum, c) => sum + c.valor_total, 0);
  const totalQtd = chequesDevolvidos.reduce((sum, c) => sum + c.qtd_cheques, 0);

  return (
    <Card className={chequesDevolvidos.length > 0 ? 'border-red-200 dark:border-red-800' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${chequesDevolvidos.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            Cheques Devolvidos
          </CardTitle>
          {!loading && chequesDevolvidos.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalQtd} cheque(s) · {formatCurrency(totalValor)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : chequesDevolvidos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum cheque devolvido encontrado ✅
          </p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cedente</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chequesDevolvidos.map((c) => (
                  <TableRow key={c.cpf_cnpj}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.cpf_cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.qtd_cheques >= 3 ? 'destructive' : 'secondary'}>
                        {c.qtd_cheques}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(c.valor_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
