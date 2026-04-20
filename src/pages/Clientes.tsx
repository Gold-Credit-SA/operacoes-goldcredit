import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Loader2, X, LayoutGrid, List, MoreVertical, Building2, User, Trash2, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';
import { PageLoadingSkeleton } from '@/components/ui/PageLoadingSkeleton';

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  agrisk_client_id: string | null;
  basic_data: Record<string, unknown> | null;
  created_at: string;
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function maskDocInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join('.') + (e ? `-${e}` : '')
    );
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, f, e) =>
    `${a}.${b}.${c}/${f}` + (e ? `-${e}` : '')
  );
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

export default function Clientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [orderBy, setOrderBy] = useState('lastRegistered');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('consulta_clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setClients(data as unknown as ClientRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const counts = useMemo(() => {
    const pf = clients.filter(c => c.cpf_cnpj.length === 11).length;
    const pj = clients.filter(c => c.cpf_cnpj.length === 14).length;
    return { total: clients.length, pf, pj };
  }, [clients]);

  const filtered = useMemo(() => {
    let result = clients;

    // Filter by type
    if (filterType === 'pf') result = result.filter(c => c.cpf_cnpj.length === 11);
    if (filterType === 'pj') result = result.filter(c => c.cpf_cnpj.length === 14);

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.cpf_cnpj.includes(searchTerm.replace(/\D/g, ''))
      );
    }

    // Sort
    if (orderBy === 'crescentOrder') {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (orderBy === 'descendingOrder') {
      result = [...result].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }
    // lastRegistered is default (already sorted by created_at desc)

    return result;
  }, [clients, searchTerm, filterType, orderBy]);

  const handleCreate = async () => {
    const cleanDoc = newDoc.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      toast.error('CPF ou CNPJ inválido.');
      return;
    }

    const existing = clients.find(c => c.cpf_cnpj === cleanDoc);
    if (existing) {
      toast.info('Cliente já cadastrado.');
      navigate(`/clientes/${existing.id}`);
      setDialogOpen(false);
      return;
    }

    setCreating(true);
    try {
      // Register client on AgRisk and fetch free cadastral data
      const { data: agriskData } = await supabase.functions.invoke('agrisk-query', {
        body: { action: 'register-client', taxId: cleanDoc },
      });

      const resultData = agriskData?.data || agriskData || {};
      const clientName = resultData?.clientData?.name || null;
      const agriskClientId = resultData?.clientId || null;

      const { data: inserted, error: insertError } = await supabase
        .from('consulta_clients')
        .insert({
          cpf_cnpj: cleanDoc,
          name: clientName,
          agrisk_client_id: agriskClientId,
          basic_data: resultData,
          created_by: user!.id,
        } as any)
        .select()
        .single();

      if (insertError) {
        if (insertError.message.includes('duplicate')) {
          toast.info('Cliente já cadastrado.');
          await loadClients();
        } else {
          throw insertError;
        }
      } else if (inserted) {

        toast.success('Cliente cadastrado com sucesso!');
        navigate(`/clientes/${(inserted as any).id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar cliente.');
    } finally {
      setCreating(false);
      setDialogOpen(false);
      setNewDoc('');
    }
  };

  const handleDelete = async (client: ClientRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover ${client.name || formatDoc(client.cpf_cnpj)}?`)) return;
    await supabase.from('consulta_clients').delete().eq('id', client.id);
    toast.success('Cliente removido.');
    loadClients();
  };

  if (loading && clients.length === 0) {
    return <PageLoadingSkeleton message="Carregando clientes..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <div className="flex items-center gap-3">
            {/* Counters */}
            <div className="flex items-center gap-3 mr-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary">{counts.pj}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary">{counts.pf}</span>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo cliente
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-5">
        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar"
              className="pl-10"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastRegistered">Últimos cadastrados</SelectItem>
              <SelectItem value="crescentOrder">Nome A-Z</SelectItem>
              <SelectItem value="descendingOrder">Nome Z-A</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-lg">
                {searchTerm || filterType !== 'all' ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
              </p>
              {!searchTerm && filterType === 'all' && (
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Clique em "Novo cliente" para adicionar.
                </p>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(client => {
              const isPJ = client.cpf_cnpj.length === 14;
              return (
                <Card key={client.id} className="hover:border-primary/30 transition-colors group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate uppercase">
                          {client.name || 'NOME NÃO DISPONÍVEL'}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {formatDoc(client.cpf_cnpj)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${client.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => handleDelete(client, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            isPJ
                              ? 'border-primary/30 text-primary bg-primary/5'
                              : 'border-primary/30 text-primary bg-primary/5'
                          }`}
                        >
                          {isPJ ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {isPJ ? 'Jurídica' : 'Física'}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(client.created_at)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => navigate(`/clientes/${client.id}`)}
                      >
                        Ver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filtered.map(client => {
              const isPJ = client.cpf_cnpj.length === 14;
              return (
                <Card
                  key={client.id}
                  className="hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/clientes/${client.id}`)}
                >
                  <CardContent className="py-3 px-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate uppercase">
                        {client.name || 'NOME NÃO DISPONÍVEL'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {formatDoc(client.cpf_cnpj)}
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Calendar className="h-3 w-3" />
                      {formatDate(client.created_at)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5 shrink-0"
                    >
                      {isPJ ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {isPJ ? 'Jurídica' : 'Física'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                    >
                      Ver
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0" onClick={e => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDelete(client, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Informe o CPF ou CNPJ para cadastrar um novo cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input
                value={newDoc}
                onChange={e => setNewDoc(maskDocInput(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setNewDoc(''); }} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating || newDoc.replace(/\D/g, '').length < 11}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
