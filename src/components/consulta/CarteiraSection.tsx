import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Briefcase } from 'lucide-react';

interface CarteiraProps {
  carteira: {
    total: number;
    vencidos: number;
    percentualVencido: number;
    porTipo: Array<{
      tipo: string;
      risco: number;
      vencimento: number;
      vencidos: number;
      percentualRisco: number;
    }>;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR');
};

export function CarteiraSection({ carteira }: CarteiraProps) {
  const hoje = new Date();
  const proximoVencimento = new Date(hoje);
  proximoVencimento.setDate(proximoVencimento.getDate() + 30);

  // Calculate totals
  const totais = carteira.porTipo.reduce(
    (acc, item) => ({
      risco: acc.risco + item.risco,
      vencimento: acc.vencimento + item.vencimento,
      vencidos: acc.vencidos + item.vencidos,
    }),
    { risco: 0, vencimento: 0, vencidos: 0 }
  );

  return (
    <Card className="border-t-4 border-t-blue-600">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5 text-blue-600" />
          Carteira
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Produtos</TableHead>
                <TableHead className="text-right font-semibold">Risco</TableHead>
                <TableHead className="text-right font-semibold">Vencimento</TableHead>
                <TableHead className="text-right font-semibold">Vencidos</TableHead>
                <TableHead className="text-right font-semibold">Vencidos desde</TableHead>
                <TableHead className="text-right font-semibold">% Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carteira.porTipo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    Nenhum título em carteira
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {carteira.porTipo.map((item) => (
                    <TableRow key={item.tipo}>
                      <TableCell className="font-medium">{item.tipo}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.risco)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.vencimento)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(item.vencidos)}
                      </TableCell>
                      <TableCell className="text-right">{formatDate(hoje)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.percentualRisco.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totais.risco)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totais.vencimento)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatCurrency(totais.vencidos)}
                    </TableCell>
                    <TableCell className="text-right">{formatDate(hoje)}</TableCell>
                    <TableCell className="text-right">100,00%</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {carteira.total > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950">
              <p className="text-xs text-muted-foreground">Total em Carteira</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(carteira.total)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-950">
              <p className="text-xs text-muted-foreground">Vencidos</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(carteira.vencidos)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-950">
              <p className="text-xs text-muted-foreground">% Vencido</p>
              <p className="text-lg font-bold text-amber-600">{carteira.percentualVencido.toFixed(2)}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
