import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardFiltersState } from '@/pages/Dashboard';

interface Receita {
  id: number;
  cedente: string | null;
  cpf_cnpj: string | null;
  data_pagamento: string | null;
  modalidade: string | null;
  desagio: number | null;
  juros: number | null;
  multas: number | null;
  tarifas: number | null;
  total: number | null;
  operador: string | null;
}

interface ReceitasTableProps {
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

export function ReceitasTable({ filters }: ReceitasTableProps) {
  const [data, setData] = useState<Receita[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = const { data: result, error } = await supabase.functions.invoke('external-db', {
          body: { 
            action: 'receitas',
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
        console.error('Error fetching receitas:', err);
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
        Nenhuma receita encontrada
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cedente</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Data Pagamento</TableHead>
            <TableHead>Modalidade</TableHead>
            <TableHead className="text-right">Deságio</TableHead>
            <TableHead className="text-right">Juros</TableHead>
            <TableHead className="text-right">Multas</TableHead>
            <TableHead className="text-right">Tarifas</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Operador</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((rec) => (
            <TableRow key={rec.id}>
              <TableCell className="max-w-[200px] truncate font-medium">
                {rec.cedente || '-'}
              </TableCell>
              <TableCell className="font-mono text-xs">{rec.cpf_cnpj || '-'}</TableCell>
              <TableCell>{formatDate(rec.data_pagamento)}</TableCell>
              <TableCell>{rec.modalidade || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(rec.desagio)}</TableCell>
              <TableCell className="text-right">{formatCurrency(rec.juros)}</TableCell>
              <TableCell className="text-right">{formatCurrency(rec.multas)}</TableCell>
              <TableCell className="text-right">{formatCurrency(rec.tarifas)}</TableCell>
              <TableCell className="text-right text-green-600 font-bold">
                {formatCurrency(rec.total)}
              </TableCell>
              <TableCell>{rec.operador || '-'}</TableCell>
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
