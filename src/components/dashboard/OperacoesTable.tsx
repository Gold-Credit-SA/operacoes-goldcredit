import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  etapaNormalizada?: string | null;
  precisaFormalizacao?: boolean;
  sinalizacaoGoldsign?: string | null;
}

interface OperacoesTableProps {
  filters: DashboardFiltersState;
  onlyFormalizacao?: boolean;
}

function normalizeStage(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function enrichWithFormalizacao(op: Operacao): Operacao {
  const etapaNormalizada = normalizeStage(op.etapa);
  const precisaFormalizacao = etapaNormalizada.includes('formalizacao');
  return {
    ...op,
    etapaNormalizada,
    precisaFormalizacao,
    sinalizacaoGoldsign: precisaFormalizacao ? 'Enviar documentos para assinatura' : null,
  };
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
export function OperacoesTable({ filters, onlyFormalizacao = false }: OperacoesTableProps) {
  const [data, setData] = useState<Operacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('external-db', {
          body: {
            action: 'operacoes',
            filters: {
              cedente: filters.cedente || undefined,
              dataInicio: filters.dataInicio || (filters.ano ? `${filters.ano}-01-01` : undefined),
              dataFim: filters.dataFim || (filters.ano ? `${filters.ano}-12-31` : undefined),
            },
          },
        });

        if (error) throw error;
        if (result?.success) {
          const enriched = (result.data || []).map(enrichWithFormalizacao);
          setData(enriched);
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

  const sortedData = [...data].sort((a, b) => {
    const prioridadeA = a.precisaFormalizacao ? 1 : 0;
    const prioridadeB = b.precisaFormalizacao ? 1 : 0;
    if (prioridadeA !== prioridadeB) {
      return prioridadeB - prioridadeA;
    }
    return (b.id || 0) - (a.id || 0);
  });

  const operacoesFormalizacao = sortedData.filter((op) => op.precisaFormalizacao);
  const displayData = onlyFormalizacao ? operacoesFormalizacao : sortedData;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {onlyFormalizacao
          ? 'Nenhuma operacao aguardando formalizacao encontrada'
          : 'Nenhuma operacao encontrada'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!onlyFormalizacao && operacoesFormalizacao.length > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="border border-amber-300 bg-amber-100 text-amber-900">
              Formalizacao
            </Badge>
            <span className="font-medium">
              {operacoesFormalizacao.length} operacao(oes) no Smart aguardando formalizacao no GoldSign.
            </span>
          </div>
          <p className="mt-2 text-amber-900/80">
            Essas operacoes entraram na etapa de formalizacao e devem seguir para envio dos documentos de assinatura.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operacao</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cedente</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="text-right">Valor Bruto</TableHead>
              <TableHead className="text-right">Valor Liquido</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Sinalizacao</TableHead>
              <TableHead>Operador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((op) => (
              <TableRow key={op.id} className={op.precisaFormalizacao ? 'bg-amber-50/70' : undefined}>
                <TableCell className="font-medium">{op.operacao || '-'}</TableCell>
                <TableCell>{formatDate(op.data)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{op.cedente || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{op.cpf_cnpj_cedente || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(op.valor_bruto)}</TableCell>
                <TableCell className="text-right">{formatCurrency(op.valor_liquido)}</TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatCurrency(op.valor_receita)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{op.etapa || '-'}</span>
                    {op.precisaFormalizacao && (
                      <Badge variant="secondary" className="border border-amber-300 bg-amber-100 text-amber-900">
                        Precisa formalizar
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {op.precisaFormalizacao ? (
                    <span className="font-medium text-amber-900">
                      {op.sinalizacaoGoldsign || 'Enviar documentos para assinatura'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{op.operador || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Exibindo {displayData.length} registros
        </p>
      </div>
    </div>
  );
}
