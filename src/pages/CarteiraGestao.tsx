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
  Search, Plus, RefreshCw, Settings2, Users, Trash2,
} from 'lucide-react';

interface Assignment {
  id: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string | null;
  status: string;
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
          : 'Cedente vinculado à sua carteira.',
      });
      fetchAssignments();
      setAddDialogOpen(false);
      setAddSearchTerm('');
      setSearchResults([]);
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-emerald-100 text-emerald-700 border-0">Aprovado</Badge>;
      case 'pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejeitado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const approved = assignments.filter(a => a.status === 'approved');
  const pending = assignments.filter(a => a.status === 'pending');

  return (
    <MainLayout title="Gestão de Carteira" subtitle="Gerencie os cedentes vinculados à sua carteira">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <p className="text-lg font-bold">{approved.length}</p>
                <p className="text-xs text-muted-foreground">Cedentes ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-amber-500" />
              <div>
                <p className="text-lg font-bold">{pending.length}</p>
                <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{assignments.length}</p>
                <p className="text-xs text-muted-foreground">Total de vínculos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Cedente
          </Button>
          <Button variant="outline" onClick={fetchAssignments} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cedentes table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Cedentes Vinculados
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
                  Clique em "Adicionar Cedente" para vincular cedentes à sua carteira.
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
                      <TableHead className="text-center">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{formatCpfCnpj(a.cedente_cpf_cnpj)}</TableCell>
                        <TableCell>{a.cedente_nome || '-'}</TableCell>
                        <TableCell className="text-center">{statusLabel(a.status)}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString('pt-BR')}
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
              <DialogTitle>Adicionar Cedente</DialogTitle>
              <DialogDescription>Busque pelo nome ou CPF/CNPJ para solicitar o vínculo à sua carteira.</DialogDescription>
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
