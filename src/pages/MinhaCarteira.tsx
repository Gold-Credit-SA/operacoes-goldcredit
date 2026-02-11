import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, ArrowRight, Building2, RefreshCw, Users, Plus, Briefcase,
  TrendingUp, AlertCircle, DollarSign, Activity,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface CedenteCarteira {
  cpf_cnpj: string;
  nome?: string;
  limite_global?: number;
  limite_disponivel?: number;
  risco_atual?: number;
  bloqueado?: string;
  ultima_operacao?: string;
  dias_inativo?: number;
}

interface Metricas {
  total_cedentes: number;
  total_limite: number;
  total_risco: number;
  total_disponivel: number;
  total_operacoes_30d: number;
}

interface SearchResult {
  cpf_cnpj: string;
  nome?: string;
  limite_global?: number;
  risco_atual?: number;
  bloqueado?: string;
}

export default function MinhaCarteira() {
  const [cedentes, setCedentes] = useState<CedenteCarteira[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Add cedente dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCpfCnpj = (value: string | undefined) => {
    if (!value) return '-';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (cleaned.length === 14) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return value;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const fetchPortfolio = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'my-portfolio' },
      });
      if (error) throw error;
      if (data.success) {
        setCedentes(data.cedentes);
        setMetricas(data.metricas);
      }
    } catch (error) {
      console.error("Erro ao buscar carteira:", error);
      toast({ title: "Erro ao carregar carteira", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  const filteredCedentes = searchTerm.trim()
    ? cedentes.filter(c => {
        const term = searchTerm.toLowerCase();
        return c.nome?.toLowerCase().includes(term) || c.cpf_cnpj?.includes(term);
      })
    : cedentes;

  const cedentesOrdenados = [...filteredCedentes].sort((a, b) => {
    const dateA = a.ultima_operacao ? new Date(a.ultima_operacao).getTime() : 0;
    const dateB = b.ultima_operacao ? new Date(b.ultima_operacao).getTime() : 0;
    return dateB - dateA;
  });

  const totalPages = Math.ceil(cedentesOrdenados.length / itemsPerPage);
  const paginatedCedentes = cedentesOrdenados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  // Search cedentes to add
  const handleSearchCedentes = async () => {
    if (!addSearchTerm.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'search-cedentes', cedente_cpf_cnpj: addSearchTerm },
      });
      if (error) throw error;
      setSearchResults(data.cedentes || []);
    } catch (error) {
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleAddCedente = async (cpfCnpj: string) => {
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'request-assignment', cedente_cpf_cnpj: cpfCnpj },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }
      const isPending = data.assignment?.status === 'pending';
      toast({
        title: isPending ? 'Solicitação enviada' : 'Cedente adicionado',
        description: isPending
          ? 'Aguardando aprovação do administrador.'
          : 'Cedente vinculado à sua carteira com sucesso.',
      });
      if (!isPending) fetchPortfolio();
      setAddDialogOpen(false);
      setAddSearchTerm('');
      setSearchResults([]);
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <MainLayout title="Minha Carteira" subtitle="Cedentes vinculados ao seu portfólio">
      <div className="space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Cedentes', value: metricas?.total_cedentes ?? '-', icon: Users, color: 'text-primary' },
            { label: 'Limite Total', value: metricas ? formatCurrency(metricas.total_limite) : '-', icon: DollarSign, color: 'text-primary' },
            { label: 'Risco Atual', value: metricas ? formatCurrency(metricas.total_risco) : '-', icon: AlertCircle, color: 'text-destructive' },
            { label: 'Disponível', value: metricas ? formatCurrency(metricas.total_disponivel) : '-', icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Operações (30d)', value: metricas?.total_operacoes_30d ?? '-', icon: Activity, color: 'text-primary' },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <m.icon className={`h-6 w-6 ${m.color}`} />
                <div>
                  <p className="text-lg font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar na carteira..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Cedente
          </Button>
          <Button variant="outline" onClick={fetchPortfolio} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Cedentes da Carteira ({filteredCedentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : cedentes.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="font-medium">Sua carteira está vazia</p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Adicionar Cedente" para vincular cedentes ao seu portfólio.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Limite Global</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-center">Última Operação</TableHead>
                      <TableHead className="text-center">Dias Inativo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCedentes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum cedente encontrado
                        </TableCell>
                      </TableRow>
                    ) : paginatedCedentes.map(ced => (
                      <TableRow key={ced.cpf_cnpj}>
                        <TableCell className="font-mono text-sm">{formatCpfCnpj(ced.cpf_cnpj)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{ced.nome || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(ced.limite_global)}</TableCell>
                        <TableCell className={`text-right font-medium ${(ced.limite_disponivel || 0) <= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                          {formatCurrency(ced.limite_disponivel)}
                        </TableCell>
                        <TableCell className="text-center">{formatDate(ced.ultima_operacao)}</TableCell>
                        <TableCell className="text-center">
                          {ced.dias_inativo != null ? (
                            <Badge variant={ced.dias_inativo > 30 ? "destructive" : "secondary"}>
                              {ced.dias_inativo} dias
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/consulta?cpf_cnpj=${ced.cpf_cnpj}`)}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && cedentesOrdenados.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Exibindo</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span>de {filteredCedentes.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm mx-2">Página {currentPage} de {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Cedente Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Cedente à Carteira</DialogTitle>
              <DialogDescription>Busque pelo nome ou CPF/CNPJ do cedente para solicitar o vínculo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome ou CPF/CNPJ..."
                  value={addSearchTerm}
                  onChange={(e) => setAddSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCedentes()}
                />
                <Button onClick={handleSearchCedentes} disabled={searching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searching && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>}

              {!searching && searchResults.length > 0 && (
                <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
                  {searchResults.map(ced => (
                    <div key={ced.cpf_cnpj} className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{ced.nome || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(ced.cpf_cnpj)}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddCedente(ced.cpf_cnpj)} disabled={adding}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!searching && searchResults.length === 0 && addSearchTerm && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum cedente encontrado.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
