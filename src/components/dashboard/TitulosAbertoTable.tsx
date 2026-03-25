import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DashboardFiltersState } from '@/pages/Dashboard';

interface Titulo {
  id: number;
  id_titulo: string | null;
  cedente: string | null;
  sacado: string | null;
  cpf_cnpj_sacado: string | null;
  documento: string | null;
  vencimento: string | null;
  valor: number | null;
  valor_total: number | null;
  situacao: string | null;
  etapa: string | null;
  tipo: string | null;
}

interface TitulosAbertoTableProps {
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

const getSituacaoVariant = (situacao: string | null) => {
  if (!situacao) return 'secondary';
  const lower = situacao.toLowerCase();
  if (lower.includes('vencid')) return 'destructive';
  if (lower.includes('aberto') || lower.includes('normal')) return 'default';
  return 'secondary';
};

export function TitulosAbertoTable({ filters }: TitulosAbertoTableProps) {
  const [data, setData] = useState<Titulo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = const { data: result, error } = await supabase.functions.invoke('external-db', {
          body: { 
            action: 'titulos-aberto',
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
        console.error('Error fetching titulos:', err);
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
        Nenhum título encontrado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Título</TableHead>
            <TableHead>Cedente</TableHead>
            <TableHead>Sacado</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((titulo) => (
            <TableRow key={titulo.id}>
              <TableCell className="font-mono text-xs">{titulo.id_titulo || '-'}</TableCell>
              <TableCell className="max-w-[150px] truncate">{titulo.cedente || '-'}</TableCell>
              <TableCell className="max-w-[150px] truncate">{titulo.sacado || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{titulo.documento || '-'}</TableCell>
              <TableCell>{formatDate(titulo.vencimento)}</TableCell>
              <TableCell className="text-right">{formatCurrency(titulo.valor)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(titulo.valor_total)}
              </TableCell>
              <TableCell>
                <Badge variant={getSituacaoVariant(titulo.situacao)}>
                  {titulo.situacao || '-'}
                </Badge>
              </TableCell>
              <TableCell>{titulo.tipo || '-'}</TableCell>
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
