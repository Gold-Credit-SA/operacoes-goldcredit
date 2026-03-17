import { useState } from 'react';
import { FileText, Search, Filter, Clock, CheckCircle2, AlertCircle, Send, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';

type ContratoStatus = 'pendente' | 'assinado' | 'expirado' | 'enviado';

interface Contrato {
  id: string;
  tipo: string;
  cedente: string;
  cpfCnpj: string;
  dataEnvio: string;
  dataAssinatura: string | null;
  status: ContratoStatus;
  descricao: string;
}

const TIPO_LABELS: Record<string, string> = {
  'contrato-mae': 'Contrato Mãe',
  'aditivo': 'Aditivo',
  'carta-cessao': 'Carta de Cessão',
  'np': 'Nota Promissória',
  'duplicata': 'Duplicata',
};

const STATUS_CONFIG: Record<ContratoStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  pendente: { label: 'Pendente', variant: 'outline', icon: Clock },
  enviado: { label: 'Enviado', variant: 'secondary', icon: Send },
  assinado: { label: 'Assinado', variant: 'default', icon: CheckCircle2 },
  expirado: { label: 'Expirado', variant: 'destructive', icon: AlertCircle },
};

const mockContratos: Contrato[] = [
  {
    id: '1', tipo: 'contrato-mae', cedente: 'Empresa ABC Ltda', cpfCnpj: '12.345.678/0001-90',
    dataEnvio: '2025-03-10', dataAssinatura: '2025-03-12', status: 'assinado',
    descricao: 'Contrato de cedente com a securitizadora – início do relacionamento',
  },
  {
    id: '2', tipo: 'aditivo', cedente: 'Empresa ABC Ltda', cpfCnpj: '12.345.678/0001-90',
    dataEnvio: '2025-03-14', dataAssinatura: null, status: 'pendente',
    descricao: 'Aditivo da operação #1042 – Duplicatas – Deságio 2,5%',
  },
  {
    id: '3', tipo: 'carta-cessao', cedente: 'Comércio XYZ S.A.', cpfCnpj: '98.765.432/0001-10',
    dataEnvio: '2025-03-13', dataAssinatura: null, status: 'enviado',
    descricao: 'Cessão de títulos – Operação #1038',
  },
  {
    id: '4', tipo: 'np', cedente: 'Comércio XYZ S.A.', cpfCnpj: '98.765.432/0001-10',
    dataEnvio: '2025-03-01', dataAssinatura: null, status: 'expirado',
    descricao: 'NP referente operação #1035 – R$ 150.000,00',
  },
  {
    id: '5', tipo: 'duplicata', cedente: 'Indústria Delta Ltda', cpfCnpj: '11.222.333/0001-44',
    dataEnvio: '2025-03-15', dataAssinatura: '2025-03-16', status: 'assinado',
    descricao: 'Duplicata mercantil – NF 4521 – Sacado: Loja Beta',
  },
];

export default function Documentos() {
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = mockContratos.filter((c) => {
    const matchSearch =
      c.cedente.toLowerCase().includes(search.toLowerCase()) ||
      c.cpfCnpj.includes(search) ||
      c.descricao.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || c.tipo === filterTipo;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  const stats = {
    total: mockContratos.length,
    pendentes: mockContratos.filter((c) => c.status === 'pendente').length,
    assinados: mockContratos.filter((c) => c.status === 'assinado').length,
    expirados: mockContratos.filter((c) => c.status === 'expirado').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico de todos os documentos enviados para assinatura
          </p>
        </div>
        <Link to="/contratos/assinatura-digital">
          <Button className="gap-2">
            <Send className="h-4 w-4" />
            Enviar Documento
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <FileText className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--success) / 0.1)' }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: 'hsl(var(--success))' }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.assinados}</p>
              <p className="text-xs text-muted-foreground">Assinados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--destructive) / 0.1)' }}>
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.expirados}</p>
              <p className="text-xs text-muted-foreground">Expirados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cedente, CNPJ ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="contrato-mae">Contrato Mãe</SelectItem>
                <SelectItem value="aditivo">Aditivo</SelectItem>
                <SelectItem value="carta-cessao">Carta de Cessão</SelectItem>
                <SelectItem value="np">Nota Promissória</SelectItem>
                <SelectItem value="duplicata">Duplicata</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Cedente</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Envio</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((contrato) => {
                  const statusCfg = STATUS_CONFIG[contrato.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <TableRow key={contrato.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {TIPO_LABELS[contrato.tipo] || contrato.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{contrato.cedente}</TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {contrato.cpfCnpj}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                        {contrato.descricao}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(contrato.dataEnvio).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {contrato.dataAssinatura
                          ? new Date(contrato.dataAssinatura).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
