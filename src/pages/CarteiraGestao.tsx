import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search, Plus, RefreshCw, Settings2, Users, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';

interface Assignment {
  id: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string | null;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
}

interface SearchResult {
  cpf_cnpj: string;
  nome?: string;
  limite_global?: number;
  bloqueado?: string;
}

export default function CarteiraGestao() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const formatCpfCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (cleaned.length === 14) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return value;
  };

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'list-assignments' },
      });
      if (error) throw error;
      if (data.success) setAssignments(data.assignments || []);
    } catch (error) {
      toast({ title: "Erro ao carregar cedentes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAssignments(); }, []);

  const handleSearchCedentes = async () => {
    if (!addSearchTerm.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'search-cedentes', cedente_cpf_cnpj: addSearchTerm },
      });
      if (error) throw error;
      setSearchResults(data.cedentes || []);
    } catch {
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  // Check if a cedente already has an active (pending/approved) assignment
  const isAlreadyLinked = (cpfCnpj: string) => {
    return assignments.some(
      a => a.cedente_cpf_cnpj === cpfCnpj && (a.status === 'approved' || a.status === 'pending')
    );
  };

  const handleAddCedente = async (cpfCnpj: string) => {
    if (isAlreadyLinked(cpfCnpj)) {
      toast({ title: 'Cedente já vinculado ou com solicitação pendente', variant: 'destructive' });
      return;
    }
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
      toast({
        title: 'Solicitação enviada',
        description: 'Aguardando aprovação do administrador para vincular o cedente à sua carteira.',
      });
      fetchAssignments();
      setAddDialogOpen(false);
      setAddSearchTerm('');
      setSearchResults([]);
    } catch (error: any) {
      toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const statusBadge = (a: Assignment) => {
    switch (a.status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Aprovado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0 gap-1">
            <Clock className="h-3 w-3" /> Aguardando aprovação
          </Badge>
        );
      case 'rejected':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1 cursor-help">
                  <XCircle className="h-3 w-3" /> Recusado
                </Badge>
              </TooltipTrigger>
              {a.rejection_reason && (
                <TooltipContent className="max-w-xs">
                  <p className="text-sm"><strong>Motivo:</strong> {a.rejection_reason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return <Badge variant="secondary">{a.status}</Badge>;
    }
  };

  const approved = assignments.filter(a => a.status === 'approved');
  const pending = assignments.filter(a => a.status === 'pending');
  const rejected = assignments.filter(a => a.status === 'rejected');

  return (
    <MainLayout title="Gestão de Carteira" subtitle="Solicite e acompanhe a vinculação de cedentes à sua carteira">
      <LoadingIndicator show={isLoading} message="Carregando gestão..." />
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-lg font-bold">{approved.length}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <p className="text-lg font-bold">{pending.length}</p>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <p className="text-lg font-bold">{rejected.length}</p>
                <p className="text-xs text-muted-foreground">Recusados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-muted-foreground shrink-0" />
              <div>
                <p className="text-lg font-bold">{assignments.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Solicitar Cedente
          </Button>
          <Button variant="outline" onClick={fetchAssignments} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Info banner for pending */}
        {pending.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  Você possui {pending.length} solicitação(ões) aguardando aprovação
                </p>
                <p className="text-amber-700 mt-1">
                  Os cedentes pendentes só serão incluídos na sua carteira após aprovação do administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cedentes table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Meus Vínculos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="font-medium">Nenhum cedente vinculado</p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Solicitar Cedente" para buscar e solicitar a inclusão de cedentes na sua carteira.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Data da Solicitação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(a => (
                      <TableRow key={a.id} className={a.status === 'rejected' ? 'opacity-60' : ''}>
                        <TableCell className="font-mono text-sm">{formatCpfCnpj(a.cedente_cpf_cnpj)}</TableCell>
                        <TableCell>{a.cedente_nome || '-'}</TableCell>
                        <TableCell className="text-center">{statusBadge(a)}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Solicitar Cedente</DialogTitle>
              <DialogDescription>
                Busque pelo nome ou CPF/CNPJ. A solicitação será enviada para aprovação do administrador.
              </DialogDescription>
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
                  {searchResults.map(ced => {
                    const linked = isAlreadyLinked(ced.cpf_cnpj);
                    return (
                      <div key={ced.cpf_cnpj} className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{ced.nome || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(ced.cpf_cnpj)}</p>
                        </div>
                        {linked ? (
                          <Badge variant="secondary" className="text-xs">Já vinculado</Badge>
                        ) : (
                          <Button size="sm" onClick={() => handleAddCedente(ced.cpf_cnpj)} disabled={adding}>
                            <Plus className="h-3 w-3 mr-1" /> Solicitar
                          </Button>
                        )}
                      </div>
                    );
                  })}
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
