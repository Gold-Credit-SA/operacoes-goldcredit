import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, TrendingUp, Wallet } from 'lucide-react';

interface DadosEmpresaProps {
  cedente: {
    nome: string | null;
    cpf_cnpj: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    email: string | null;
    telefone: string | null;
    gerente: string | null;
    operador: string | null;
    limite_global: number | null;
    risco_atual: number | null;
    saldo: number | null;
    bloqueado: string | null;
    setor: string | null;
    grupo_economico: string | null;
  };
  resumo: {
    primeiraOperacao: string | null;
    ultimaOperacao: string | null;
    totalOperacoes: number;
    valorBrutoTotal: number;
    valorLiquidoTotal: number;
    receitaTotal: number;
  };
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

export function DadosEmpresa({ cedente, resumo }: DadosEmpresaProps) {
  return (
    <Card className="border-t-4 border-t-green-600">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-green-600" />
            Dados da Empresa
          </CardTitle>
          <Badge variant={cedente.bloqueado === 'S' ? 'destructive' : 'default'}>
            {cedente.bloqueado === 'S' ? 'Bloqueado' : 'Ativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-semibold">Razão Social</th>
                <th className="px-4 py-2 text-left font-semibold">CNPJ</th>
                <th className="px-4 py-2 text-left font-semibold">Cliente desde</th>
                <th className="px-4 py-2 text-left font-semibold">Última Operação</th>
                <th className="px-4 py-2 text-right font-semibold">Risco</th>
                <th className="px-4 py-2 text-right font-semibold">Limite</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3 font-medium">{cedente.nome || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">{cedente.cpf_cnpj || '-'}</td>
                <td className="px-4 py-3">{formatDate(resumo.primeiraOperacao)}</td>
                <td className="px-4 py-3">{formatDate(resumo.ultimaOperacao)}</td>
                <td className="px-4 py-3 text-right text-amber-600 font-semibold">
                  {formatCurrency(cedente.risco_atual)}
                </td>
                <td className="px-4 py-3 text-right text-green-600 font-semibold">
                  {formatCurrency(cedente.limite_global)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Operações</p>
              <p className="text-lg font-bold">{resumo.totalOperacoes}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Bruto Total</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(resumo.valorBrutoTotal)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Líquido Total</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(resumo.valorLiquidoTotal)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(resumo.receitaTotal)}</p>
            </div>
          </div>
        </div>

        {(cedente.gerente || cedente.operador || cedente.setor) && (
          <div className="mt-4 grid gap-4 md:grid-cols-3 border-t border-border pt-4">
            {cedente.gerente && (
              <div>
                <p className="text-xs text-muted-foreground">Gerente</p>
                <p className="font-medium">{cedente.gerente}</p>
              </div>
            )}
            {cedente.operador && (
              <div>
                <p className="text-xs text-muted-foreground">Operador</p>
                <p className="font-medium">{cedente.operador}</p>
              </div>
            )}
            {cedente.setor && (
              <div>
                <p className="text-xs text-muted-foreground">Setor</p>
                <p className="font-medium">{cedente.setor}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
