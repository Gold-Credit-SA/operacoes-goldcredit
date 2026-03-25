import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DashboardFiltersState } from '@/pages/Dashboard';

interface CedenteCompleto {
  id: number;
  nome: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  gerente: string | null;
  operador: string | null;
  limite_global: number | null;
  risco_atual: number | null;
  saldo: number | null;
  bloqueado: string | null;
  setor: string | null;
}

interface CedentesCompletoTableProps {
  filters: DashboardFiltersState;
}

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function CedentesCompletoTable({ filters }: CedentesCompletoTableProps) {
  const [data, setData] = useState<CedenteCompleto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = const { data: result, error } = await supabase.functions.invoke('external-db', {
          body: { 
            action: 'cedentes-detalhes',
            filters: {
              nome: filters.cedente || undefined,
              uf: filters.uf || undefined,
            }
          }
        });

        if (error) throw error;
        if (result?.success) {
          setData(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching cedentes:', err);
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
        Nenhum cedente encontrado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>UF</TableHead>
            <TableHead>Gerente</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead className="text-right">Limite Global</TableHead>
            <TableHead className="text-right">Risco Atual</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((cedente) => (
            <TableRow key={cedente.id}>
              <TableCell className="max-w-[200px] truncate font-medium">
                {cedente.nome || '-'}
              </TableCell>
              <TableCell className="font-mono text-xs">{cedente.cpf_cnpj || '-'}</TableCell>
              <TableCell>{cedente.cidade || '-'}</TableCell>
              <TableCell>{cedente.uf || '-'}</TableCell>
              <TableCell>{cedente.gerente || '-'}</TableCell>
              <TableCell>{cedente.operador || '-'}</TableCell>
              <TableCell className="text-right">{formatCurrency(cedente.limite_global)}</TableCell>
              <TableCell className="text-right text-amber-600">
                {formatCurrency(cedente.risco_atual)}
              </TableCell>
              <TableCell className="text-right text-green-600 font-medium">
                {formatCurrency(cedente.saldo)}
              </TableCell>
              <TableCell>
                <Badge variant={cedente.bloqueado === 'S' ? 'destructive' : 'default'}>
                  {cedente.bloqueado === 'S' ? 'Bloqueado' : 'Ativo'}
                </Badge>
              </TableCell>
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
