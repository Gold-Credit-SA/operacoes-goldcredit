import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ConcentracaoSacadosProps {
  sacados: Array<{
    cpf_cnpj: string;
    nome: string;
    risco: number;
    concentracao: number;
  }>;
  total: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ConcentracaoSacados({ sacados, total }: ConcentracaoSacadosProps) {
  return (
    <Card className="border-t-4 border-t-purple-600">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-purple-600" />
          Concentrações de Sacado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Sacado</TableHead>
                <TableHead className="text-right font-semibold">Risco</TableHead>
                <TableHead className="text-right font-semibold w-[150px]">Concentração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sacados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    Nenhum sacado encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sacados.map((sacado, index) => (
                  <TableRow key={`${sacado.cpf_cnpj}-${index}`}>
                    <TableCell className="max-w-[200px]">
                      <p className="font-medium truncate">{sacado.nome}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(sacado.risco)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Progress 
                          value={sacado.concentracao} 
                          className="w-16 h-2" 
                        />
                        <span className={`font-semibold text-sm ${
                          sacado.concentracao > 30 
                            ? 'text-destructive' 
                            : sacado.concentracao > 20 
                            ? 'text-amber-600' 
                            : 'text-green-600'
                        }`}>
                          {sacado.concentracao.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {sacados.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Top {Math.min(3, sacados.length)} sacados representam:</span>
              <span className="font-bold text-purple-600">
                {sacados.slice(0, 3).reduce((acc, s) => acc + s.concentracao, 0).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
