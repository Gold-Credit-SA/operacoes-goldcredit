import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, AlertTriangle, FileText, RotateCcw, Building2, DollarSign, TrendingUp } from 'lucide-react';
import { formatDateBR } from '@/lib/utils';

interface SacadoSmartViewProps {
  data: any;
  cpfCnpj?: string;
  nome?: string | null;
}

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return (num || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string | null | undefined) {
  return formatDateBR(d, '—');
}

function formatDoc(doc: string | null | undefined) {
  if (!doc) return '—';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

interface ColDef {
  key: string;
  label: string;
  format?: 'date' | 'currency';
  align?: 'right' | 'center';
}

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

const TitulosTable = memo(function TitulosTable({ rows, columns }: { rows: any[]; columns: ColDef[] }) {
  if (!rows?.length) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
        Nenhum registro encontrado
      </CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
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

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
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
}

export function SacadoSmartView({ data, cpfCnpj, nome }: SacadoSmartViewProps) {
  const resumo = data?.resumo;
  const titulosAberto = data?.titulosAberto || [];
  const titulosQuitados = data?.titulosQuitados || [];
  const recomprados = data?.recomprados || [];
  const fraude = data?.fraude || [];
  const cedentes = data?.cedentes || [];

  const displayName = nome || titulosAberto[0]?.sacado || titulosQuitados[0]?.sacado || '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold tracking-tight">{displayName}</h2>
          <p className="text-sm text-muted-foreground font-mono">
            {formatDoc(cpfCnpj)} · Visão Sacado
          </p>
        </div>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={DollarSign} label="Exposição Aberta" value={formatCurrency(resumo.total_aberto)} color="text-red-500" />
          <KpiCard icon={FileText} label="Títulos Abertos" value={String(resumo.qtd_aberto ?? 0)} color="text-yellow-500" />
          <KpiCard icon={TrendingUp} label="Total Quitado" value={formatCurrency(resumo.total_quitado)} color="text-green-500" />
          <KpiCard icon={FileText} label="Títulos Quitados" value={String(resumo.qtd_quitado ?? 0)} color="text-green-600" />
          <KpiCard icon={RotateCcw} label="Recomprados" value={String(resumo.qtd_recomprados ?? 0)} color="text-orange-500" />
          <KpiCard icon={AlertTriangle} label="Suspeita Fraude" value={String(resumo.qtd_fraude ?? 0)} color={resumo.qtd_fraude > 0 ? 'text-red-600' : 'text-muted-foreground'} />
        </div>
      )}

      {cedentes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Cedentes Vinculados ({cedentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {cedentes.map((c: any, i: number) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {c.nome || c.cpf_cnpj_cedente}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="aberto">
        <TabsList>
          <TabsTrigger value="aberto">Títulos Abertos ({titulosAberto.length})</TabsTrigger>
          <TabsTrigger value="quitados">Quitados ({titulosQuitados.length})</TabsTrigger>
          <TabsTrigger value="recomprados">Recomprados ({recomprados.length})</TabsTrigger>
          {fraude.length > 0 && (
            <TabsTrigger value="fraude" className="text-red-500">
              Fraude ({fraude.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="aberto">
          <TitulosTable rows={titulosAberto} columns={COLS_ABERTO} />
        </TabsContent>
        <TabsContent value="quitados">
          <TitulosTable rows={titulosQuitados} columns={COLS_QUITADOS} />
        </TabsContent>
        <TabsContent value="recomprados">
          <TitulosTable rows={recomprados} columns={COLS_RECOMPRADOS} />
        </TabsContent>
        {fraude.length > 0 && (
          <TabsContent value="fraude">
            <TitulosTable rows={fraude} columns={COLS_FRAUDE} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
