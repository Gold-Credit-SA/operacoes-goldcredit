import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SaldoTrustee {
  cpf_cnpj: string;
  nome: string;
  saldo_trustee: number;
}

interface SaldoTrusteeCardProps {
  saldoTrustee: SaldoTrustee[];
  loading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function SaldoTrusteeCard({ saldoTrustee, loading }: SaldoTrusteeCardProps) {
  const total = saldoTrustee.reduce((sum, s) => sum + s.saldo_trustee, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Saldo Trustee
          </CardTitle>
          {!loading && saldoTrustee.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Total: {formatCurrency(total)}
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
        ) : saldoTrustee.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum saldo trustee encontrado
          </p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cedente</TableHead>
                  <TableHead className="text-right">Saldo Trustee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saldoTrustee.map((s) => (
                  <TableRow key={s.cpf_cnpj}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{s.nome}</p>
                        <p className="text-xs text-muted-foreground">{s.cpf_cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-600 dark:text-blue-400">
                      {formatCurrency(s.saldo_trustee)}
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
