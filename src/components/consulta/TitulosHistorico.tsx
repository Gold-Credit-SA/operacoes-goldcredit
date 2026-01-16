import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileCheck, FileWarning, Clock, CheckCircle2 } from 'lucide-react';

interface TituloAberto {
  id: number;
  documento: string | null;
  sacado: string | null;
  cpf_cnpj_sacado: string | null;
  valor: number | null;
  vencimento: string | null;
  situacao: string | null;
  conf: string | null;
  etapa: string | null;
}

interface TituloQuitado {
  id: number;
  numero: string | null;
  sacado: string | null;
  cpf_cnpj_sacado: string | null;
  valor_face: number | null;
  valor_liquidado: number | null;
  vencimento: string | null;
  quitacao: string | null;
  status: string | null;
  tipo_quitacao: string | null;
}

interface TitulosHistoricoProps {
  titulosAberto: TituloAberto[];
  titulosQuitados: TituloQuitado[];
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

const formatCpfCnpj = (value: string | null) => {
  if (!value) return '-';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
};

const getConfirmacaoBadge = (conf: string | null) => {
  switch (conf?.toUpperCase()) {
    case 'C':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Confirmado</Badge>;
    case 'CI':
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Parcial</Badge>;
    case 'P':
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
    default:
      return <Badge variant="secondary">-</Badge>;
  }
};

const isVencido = (vencimento: string | null) => {
  if (!vencimento) return false;
  return new Date(vencimento) < new Date();
};

export function TitulosHistorico({ titulosAberto, titulosQuitados }: TitulosHistoricoProps) {
  const totalAberto = titulosAberto.reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalQuitado = titulosQuitados.reduce((acc, t) => acc + (t.valor_liquidado || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCheck className="h-5 w-5 text-primary" />
          Histórico de Títulos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="aberto" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="aberto" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em Aberto ({titulosAberto.length})
            </TabsTrigger>
            <TabsTrigger value="quitados" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Quitados ({titulosQuitados.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aberto">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatCurrency(totalAberto)}</span>
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Documento</TableHead>
                    <TableHead className="font-semibold">Sacado</TableHead>
                    <TableHead className="font-semibold">CPF/CNPJ</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Vencimento</TableHead>
                    <TableHead className="font-semibold">Confirmação</TableHead>
                    <TableHead className="font-semibold">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titulosAberto.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum título em aberto
                      </TableCell>
                    </TableRow>
                  ) : (
                    titulosAberto.map((titulo) => (
                      <TableRow key={titulo.id} className={isVencido(titulo.vencimento) ? 'bg-red-50/50' : ''}>
                        <TableCell className="font-mono text-xs font-medium">
                          {titulo.documento || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={titulo.sacado || ''}>
                          {titulo.sacado || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatCpfCnpj(titulo.cpf_cnpj_sacado)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(titulo.valor)}
                        </TableCell>
                        <TableCell>
                          <span className={isVencido(titulo.vencimento) ? 'text-red-600 font-medium' : ''}>
                            {formatDate(titulo.vencimento)}
                            {isVencido(titulo.vencimento) && (
                              <FileWarning className="inline h-3 w-3 ml-1 text-red-600" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getConfirmacaoBadge(titulo.conf)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {titulo.situacao || titulo.etapa || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="quitados">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total Liquidado: <span className="font-semibold text-foreground">{formatCurrency(totalQuitado)}</span>
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Número</TableHead>
                    <TableHead className="font-semibold">Sacado</TableHead>
                    <TableHead className="font-semibold">CPF/CNPJ</TableHead>
                    <TableHead className="text-right font-semibold">Valor Face</TableHead>
                    <TableHead className="text-right font-semibold">Liquidado</TableHead>
                    <TableHead className="font-semibold">Vencimento</TableHead>
                    <TableHead className="font-semibold">Quitação</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titulosQuitados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum título quitado
                      </TableCell>
                    </TableRow>
                  ) : (
                    titulosQuitados.map((titulo) => (
                      <TableRow key={titulo.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {titulo.numero || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={titulo.sacado || ''}>
                          {titulo.sacado || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatCpfCnpj(titulo.cpf_cnpj_sacado)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(titulo.valor_face)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(titulo.valor_liquidado)}
                        </TableCell>
                        <TableCell>
                          {formatDate(titulo.vencimento)}
                        </TableCell>
                        <TableCell>
                          {formatDate(titulo.quitacao)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={titulo.tipo_quitacao === 'L' ? 'bg-green-500/20 text-green-600' : ''}
                          >
                            {titulo.tipo_quitacao === 'L' ? 'Liquidado' : titulo.status || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
