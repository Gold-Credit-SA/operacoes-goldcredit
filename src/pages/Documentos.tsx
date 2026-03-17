import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Filter, Clock, CheckCircle2, AlertCircle, Send, Eye, Loader2, RefreshCw, Copy, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type ContratoStatus = 'pendente' | 'assinado' | 'expirado' | 'enviado';

interface Contrato {
  id: string;
  tipo: string;
  cedente_nome: string;
  cedente_cpf_cnpj: string;
  data_envio: string;
  data_assinatura: string | null;
  status: ContratoStatus;
  observacao: string;
  token_acesso: string;
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

export default function Documentos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchContratos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/goldsign-proxy?target=/api/assinatura/listar`, {
        headers: { 'apikey': SUPABASE_KEY },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setContratos(Array.isArray(data) ? data : data.documentos || []);
    } catch (e: any) {
      console.error('Erro ao buscar documentos:', e);
      setContratos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  const filtered = contratos.filter((c) => {
    const matchSearch =
      (c.cedente_nome || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.cedente_cpf_cnpj || '').includes(search) ||
      (c.observacao || '').toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || c.tipo === filterTipo;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  const stats = {
    total: contratos.length,
    pendentes: contratos.filter((c) => c.status === 'pendente' || c.status === 'enviado').length,
    assinados: contratos.filter((c) => c.status === 'assinado').length,
    expirados: contratos.filter((c) => c.status === 'expirado').length,
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/assinar/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchContratos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/contratos/assinatura-digital">
            <Button className="gap-2">
              <Send className="h-4 w-4" />
              Enviar Documento
            </Button>
          </Link>
        </div>
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
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.assinados}</p>
              <p className="text-xs text-muted-foreground">Assinados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
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
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando documentos...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cedente</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {contratos.length === 0
                        ? 'Nenhum documento enviado ainda'
                        : 'Nenhum documento encontrado com os filtros aplicados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((contrato) => {
                    const statusCfg = STATUS_CONFIG[contrato.status] || STATUS_CONFIG.pendente;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <TableRow key={contrato.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {TIPO_LABELS[contrato.tipo] || contrato.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{contrato.cedente_nome}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {contrato.cedente_cpf_cnpj}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                          {contrato.observacao || '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {contrato.data_envio
                            ? new Date(contrato.data_envio).toLocaleDateString('pt-BR')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {contrato.data_assinatura
                            ? new Date(contrato.data_assinatura).toLocaleDateString('pt-BR')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {contrato.token_acesso && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Copiar link de assinatura"
                                onClick={() => handleCopyLink(contrato.token_acesso)}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                            {contrato.token_acesso && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir" asChild>
                                <a href={`/assinar/${contrato.token_acesso}`} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
