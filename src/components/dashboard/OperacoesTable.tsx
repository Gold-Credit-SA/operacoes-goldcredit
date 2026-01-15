import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardFiltersState } from '@/pages/Dashboard';

interface Operacao {
  id: number;
  operacao: string | null;
  cedente: string | null;
  cpf_cnpj_cedente: string | null;
  data: string | null;
  valor_bruto: number | null;
  valor_liquido: number | null;
  valor_receita: number | null;
  etapa: string | null;
  operador: string | null;
}

interface OperacoesTableProps {
  filters: DashboardFiltersState;
}

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
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

export function OperacoesTable({ filters }: OperacoesTableProps) {
  const [data, setData] = useState<Operacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('dashboard-data', {
          body: { 
            action: 'operacoes',
            filters: {
              cedente: filters.cedente || undefined,
              dataInicio: filters.dataInicio || (filters.ano ? `${filters.ano}-01-01` : undefined),
              dataFim: filters.dataFim || (filters.ano ? `${filters.ano}-12-31` : undefined),
            }
          }
        });

        if (error) throw error;
        if (result?.success) {
          setData(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching operacoes:', err);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchData, 300);
    return () => clearTimeout(debounce);
  }, [filters]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhuma operação encontrada
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operação</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Cedente</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead className="text-right">Valor Bruto</TableHead>
            <TableHead className="text-right">Valor Líquido</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Operador</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((op) => (
            <TableRow key={op.id}>
              <TableCell className="font-medium">{op.operacao || '-'}</TableCell>
              <TableCell>{formatDate(op.data)}</TableCell>
              <TableCell className="max-w-[200px] truncate">{op.cedente || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{op.cpf_cnpj_cedente || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(op.valor_bruto)}</TableCell>
              <TableCell className="text-right">{formatCurrency(op.valor_liquido)}</TableCell>
              <TableCell className="text-right text-green-600 font-medium">
                {formatCurrency(op.valor_receita)}
              </TableCell>
              <TableCell>{op.etapa || '-'}</TableCell>
              <TableCell>{op.operador || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-4 text-xs text-muted-foreground">
        Exibindo {data.length} registros
      </p>
    </div>
  );
}
