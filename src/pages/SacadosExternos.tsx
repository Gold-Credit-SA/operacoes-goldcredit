import { useState, useCallback, useRef, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users, ArrowLeft, AlertTriangle, FileText, RotateCcw, Building2, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateBR } from '@/lib/utils';
import { EntityNotes } from '@/components/notes/EntityNotes';

// ── Cache config ─────────────────────────────────────────────────────
const LIST_STALE = 10 * 60 * 1000;   // 10 min — lista muda pouco
const DETAIL_STALE = 5 * 60 * 1000;  // 5 min — detalhe pode ter títulos novos
const LIST_CACHE = 30 * 60 * 1000;   // 30 min gcTime
const DETAIL_CACHE = 15 * 60 * 1000; // 15 min gcTime

function formatCurrency(value: number | string | null) {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string | null) {
  return formatDateBR(d, '—');
}

function formatDoc(doc: string | null) {
  if (!doc) return '—';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

interface SacadoRow {
  cpf_cnpj_sacado: string;
  nome: string;
  total_cedentes: number;
  exposicao_aberto: number;
  titulos_aberto: number;
}

async function fetchSacadosList(search?: string) {
  const { data, error } = await supabase.functions.invoke('external-db', {
    body: { action: 'sacados-list', filters: { search: search || undefined } },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Erro ao buscar sacados');
  return (data.data || []) as SacadoRow[];
}

async function fetchSacadoDetail(cpfCnpj: string) {
  const { data, error } = await supabase.functions.invoke('external-db', {
    body: { action: 'sacado-detail', filters: { cpf_cnpj: cpfCnpj } },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Erro ao buscar detalhes');
  return data.data;
}

export default function SacadosExternos() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSacado, setSelectedSacado] = useState<SacadoRow | null>(null);
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  }, []);

  const { data: sacados, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['sacados-externos', debouncedSearch],
    queryFn: () => fetchSacadosList(debouncedSearch),
    staleTime: LIST_STALE,
    gcTime: LIST_CACHE,
    placeholderData: (prev) => prev, // keep old data while fetching new search
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['sacado-detail', selectedSacado?.cpf_cnpj_sacado],
    queryFn: () => fetchSacadoDetail(selectedSacado!.cpf_cnpj_sacado),
    enabled: !!selectedSacado,
    staleTime: DETAIL_STALE,
    gcTime: DETAIL_CACHE,
  });

  // Prefetch detail on hover
  const handleHover = useCallback((sacado: SacadoRow) => {
    queryClient.prefetchQuery({
      queryKey: ['sacado-detail', sacado.cpf_cnpj_sacado],
      queryFn: () => fetchSacadoDetail(sacado.cpf_cnpj_sacado),
      staleTime: DETAIL_STALE,
    });
  }, [queryClient]);

  const handleForceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sacados-externos'] });
    if (selectedSacado) {
      queryClient.invalidateQueries({ queryKey: ['sacado-detail', selectedSacado.cpf_cnpj_sacado] });
    }
  }, [queryClient, selectedSacado]);

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (selectedSacado) {
    return (
      <SacadoDetailView
        sacado={selectedSacado}
        detail={detail}
        loading={loadingDetail}
        onBack={() => setSelectedSacado(null)}
        onRefresh={handleForceRefresh}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-[#e5b970]" />
          <h1 className="text-2xl font-bold tracking-tight">Sacados</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastUpdate && <span>Atualizado às {lastUpdate}</span>}
          {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          <Button variant="outline" size="sm" onClick={handleForceRefresh} disabled={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sacado</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead className="text-right">Exposição Aberta</TableHead>
                <TableHead className="text-center">Títulos</TableHead>
                <TableHead className="text-center">Cedentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !sacados ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !sacados?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum sacado encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sacados.map((s) => (
                  <TableRow
                    key={s.cpf_cnpj_sacado}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedSacado(s)}
                    onMouseEnter={() => handleHover(s)}
                  >
                    <TableCell className="font-medium">{s.nome || '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatDoc(s.cpf_cnpj_sacado)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(s.exposicao_aberto)}
                    </TableCell>
                    <TableCell className="text-center">{s.titulos_aberto}</TableCell>
                    <TableCell className="text-center">{s.total_cedentes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Detail View ──────────────────────────────────────────────────────
function SacadoDetailView({
  sacado,
  detail,
  loading,
  onBack,
  onRefresh,
}: {
  sacado: SacadoRow;
  detail: any;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const resumo = detail?.resumo;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-[#e5b970]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sacado.nome || '—'}</h1>
          <p className="text-sm text-muted-foreground font-mono">{formatDoc(sacado.cpf_cnpj_sacado)}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard icon={DollarSign} label="Exposição Aberta" value={formatCurrency(resumo.total_aberto)} color="text-red-500" />
          <KpiCard icon={FileText} label="Títulos Abertos" value={String(resumo.qtd_aberto)} color="text-yellow-500" />
          <KpiCard icon={TrendingUp} label="Total Quitado" value={formatCurrency(resumo.total_quitado)} color="text-green-500" />
          <KpiCard icon={FileText} label="Títulos Quitados" value={String(resumo.qtd_quitado)} color="text-green-600" />
          <KpiCard icon={RotateCcw} label="Recomprados" value={String(resumo.qtd_recomprados)} color="text-orange-500" />
          <KpiCard icon={AlertTriangle} label="Suspeita Fraude" value={String(resumo.qtd_fraude)} color={resumo.qtd_fraude > 0 ? 'text-red-600' : 'text-muted-foreground'} />
        </div>
      ) : null}

      {detail?.cedentes?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Cedentes Vinculados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {detail.cedentes.map((c: any, i: number) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {c.nome || c.cpf_cnpj_cedente}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <EntityNotes
        entityType="sacado"
        entityCpfCnpj={sacado.cpf_cnpj_sacado}
        entityName={sacado.nome || undefined}
      />

      <Tabs defaultValue="aberto">
        <TabsList>
          <TabsTrigger value="aberto">Títulos Abertos ({detail?.titulosAberto?.length || 0})</TabsTrigger>
          <TabsTrigger value="quitados">Quitados ({detail?.titulosQuitados?.length || 0})</TabsTrigger>
          <TabsTrigger value="recomprados">Recomprados ({detail?.recomprados?.length || 0})</TabsTrigger>
          {detail?.fraude?.length > 0 && (
            <TabsTrigger value="fraude" className="text-red-500">
              Fraude ({detail.fraude.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="aberto">
          <TitulosTable rows={detail?.titulosAberto || []} loading={loading} columns={COLS_ABERTO} />
        </TabsContent>
        <TabsContent value="quitados">
          <TitulosTable rows={detail?.titulosQuitados || []} loading={loading} columns={COLS_QUITADOS} />
        </TabsContent>
        <TabsContent value="recomprados">
          <TitulosTable rows={detail?.recomprados || []} loading={loading} columns={COLS_RECOMPRADOS} />
        </TabsContent>
        {detail?.fraude?.length > 0 && (
          <TabsContent value="fraude">
            <TitulosTable rows={detail.fraude} loading={loading} columns={COLS_FRAUDE} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── Static column definitions (avoid re-creation) ───────────────────
const COLS_ABERTO: ColDef[] = [
  { key: 'cedente', label: 'Cedente' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'documento', label: 'Documento' },
  { key: 'vencimento', label: 'Vencimento', format: 'date' },
  { key: 'valor', label: 'Valor', format: 'currency', align: 'right' },
  { key: 'situacao', label: 'Situação' },
];
const COLS_QUITADOS: ColDef[] = [
  { key: 'cedente', label: 'Cedente' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'vencimento', label: 'Vencimento', format: 'date' },
  { key: 'quitacao', label: 'Quitação', format: 'date' },
  { key: 'valor_face', label: 'Valor', format: 'currency', align: 'right' },
  { key: 'status', label: 'Status' },
];
const COLS_RECOMPRADOS: ColDef[] = [
  { key: 'cedente', label: 'Cedente' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'vencimento', label: 'Vencimento', format: 'date' },
  { key: 'recompra', label: 'Recompra', format: 'date' },
  { key: 'valor_face', label: 'Valor', format: 'currency', align: 'right' },
];
const COLS_FRAUDE: ColDef[] = [
  { key: 'cedente', label: 'Cedente' },
  { key: 'sacado', label: 'Sacado' },
  { key: 'data_quitacao', label: 'Quitação', format: 'date' },
  { key: 'valor_face', label: 'Valor', format: 'currency', align: 'right' },
  { key: 'motivo', label: 'Motivo' },
];

// ── Reusable Table (memoized) ───────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  format?: 'date' | 'currency';
  align?: 'right' | 'center';
}

const TitulosTable = memo(function TitulosTable({ rows, loading, columns }: { rows: any[]; loading: boolean; columns: ColDef[] }) {
  if (loading) {
    return (
      <Card><CardContent className="p-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 mb-2" />)}
      </CardContent></Card>
    );
  }

  if (!rows.length) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">
        Nenhum registro encontrado
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.align === 'right' ? 'text-right' : ''}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                      {c.format === 'currency' ? formatCurrency(row[c.key])
                        : c.format === 'date' ? formatDate(row[c.key])
                        : String(row[c.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

// ── KPI Card ─────────────────────────────────────────────────────────
const KpiCard = memo(function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          {label}
        </div>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
});
