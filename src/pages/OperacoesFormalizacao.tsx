import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { FileSignature, RefreshCw, Search, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface OperacaoSmart {
  id: number;
  operacao: string;
  etapa: string;
  data: string;
  cedente: string;
  cpf_cnpj_cedente: string;
  prazo_medio: string;
  valor_bruto: string;
  valor_liquido: string;
  valor_desagio: string;
  valor_saldo: string;
  finalizacao: string;
  operador: string;
  captador: string;
  pagamento_operacao: string;
  inicio: string;
  tipo_operacao: string;
  precisaFormalizacao: boolean;
  sinalizacaoGoldsign: string;
}

interface Meta {
  totalOperacoes: number;
  totalFormalizacao: number;
  periodo: { inicio: string; fim: string };
}

const POLL_INTERVAL = 60_000; // 1 minute (API has cache, respects 10-min rate limit)

export default function OperacoesFormalizacao() {
  const [data, setData] = useState<OperacaoSmart[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [searchCedente, setSearchCedente] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    if (silent) setIsRefreshing(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('smart-api', {
        body: {
          action: 'operacoes-formalizacao',
          filters: {
            cedente: searchCedente || undefined,
          },
        },
      });

      if (fnError) throw fnError;

      if (result?.success) {
        setData(result.data || []);
        setMeta(result.meta || null);
        setLastUpdate(new Date());
      } else {
        setError(result?.error || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar operações:', err);
      setError(err instanceof Error ? err.message : 'Erro ao conectar com a API Smart');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchCedente]);

  // Initial fetch
  useEffect(() => {
    const debounce = setTimeout(() => fetchData(false), 300);
    return () => clearTimeout(debounce);
  }, [fetchData]);

  // Auto-refresh polling
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) {
    return (
      <MainLayout title="Operações para Formalização" subtitle="Dados em tempo real da API Smart">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Operações para Formalização"
      subtitle="Dados em tempo real da API Smart"
    >
      <div className="space-y-6">
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <FileSignature className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Fila de formalização do GoldSign
            <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-xs font-normal">
              <Wifi className="h-3 w-3 mr-1" />
              Tempo real
            </Badge>
          </AlertTitle>
          <AlertDescription>
            Operações puxadas diretamente da API Smart que estão na etapa de formalização. Atualização automática a cada minuto.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por cedente..."
              value={searchCedente}
              onChange={(e) => setSearchCedente(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        {meta && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Operações no período</p>
                <p className="text-2xl font-bold">{meta.totalOperacoes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Em formalização</p>
                <p className="text-2xl font-bold text-amber-600">{meta.totalFormalizacao}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Período consultado</p>
                <p className="text-lg font-semibold">{meta.periodo.inicio} — {meta.periodo.fim}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">
              Operações aguardando formalização
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma operação em formalização encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operação</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Cedente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead className="text-right">Deságio</TableHead>
                      <TableHead>Prazo Médio</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Sinalização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((op) => (
                      <TableRow key={op.id} className="bg-amber-50/70">
                        <TableCell className="font-medium">{op.operacao || '-'}</TableCell>
                        <TableCell>{op.inicio || op.data || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{op.cedente || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{op.cpf_cnpj_cedente || '-'}</TableCell>
                        <TableCell className="text-right">{op.valor_bruto || '-'}</TableCell>
                        <TableCell className="text-right">{op.valor_liquido || '-'}</TableCell>
                        <TableCell className="text-right">{op.valor_desagio || '-'}</TableCell>
                        <TableCell>{op.prazo_medio || '-'}</TableCell>
                        <TableCell>{op.operador || '-'}</TableCell>
                        <TableCell>
                          <span className="font-medium text-amber-900">
                            {op.sinalizacaoGoldsign}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 mb-4 flex items-center justify-between px-4">
                  <p className="text-xs text-muted-foreground">
                    {data.length} operação(ões) em formalização
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    API Smart • Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
