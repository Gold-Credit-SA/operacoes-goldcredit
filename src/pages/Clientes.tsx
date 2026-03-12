import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function Clientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filtered = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.cpf_cnpj.includes(searchTerm.replace(/\D/g, ''))
    );
  }, [clients, searchTerm]);

  const handleCreate = async () => {
    const cleanDoc = newDoc.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      toast.error('CPF ou CNPJ inválido.');
      return;
    }

    // Check if already exists
    const existing = clients.find(c => c.cpf_cnpj === cleanDoc);
    if (existing) {
      toast.info('Cliente já cadastrado.');
      navigate(`/clientes/${existing.id}`);
      setDialogOpen(false);
      return;
    }

    setCreating(true);
    try {
      // Call AgRisk to get basic client data
      const { data: agriskData, error: agriskError } = await supabase.functions.invoke('agrisk-query', {
        body: { taxId: cleanDoc, consultaType: 'consulta_cliente' },
      });

      const clientName = agriskData?.data?.name
        || agriskData?.data?.response?.name
        || agriskData?.name
        || null;

      const agriskClientId = agriskData?.data?._id || agriskData?.data?.id || agriskData?._id || null;

      // Insert into consulta_clients
      const { data: inserted, error: insertError } = await supabase
        .from('consulta_clients')
        .insert({
          cpf_cnpj: cleanDoc,
          name: clientName,
          agrisk_client_id: agriskClientId,
          basic_data: agriskData?.data || agriskData || null,
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
        // Also save to consulta_history
        await supabase.from('consulta_history').insert({
          user_id: user!.id,
          cnpj: cleanDoc,
          platform: 'agrisk',
          consulta_type: 'consulta_cliente',
          consulta_label: 'Consulta Cliente',
          result_data: agriskData?.data || agriskData || null,
          status: agriskError ? 'error' : 'success',
          entity_name: clientName,
        } as any);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Clientes</h1>
              <p className="text-sm text-muted-foreground">Cadastro e consultas de CPF/CNPJ</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {/* Search */}
        <Card>
          <CardContent className="py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou CPF/CNPJ..."
                className="pl-10"
              />
              {searchTerm && (
                <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setSearchTerm('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-lg">
                {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
              </p>
              {!searchTerm && (
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Clique em "Novo Cliente" para adicionar um CPF/CNPJ.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filtered.length} cliente(s)</p>
            {filtered.map(client => (
              <Card
                key={client.id}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/clientes/${client.id}`)}
              >
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {client.name?.charAt(0)?.toUpperCase() || '#'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {client.name || 'Nome não disponível'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatDoc(client.cpf_cnpj)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {client.cpf_cnpj.length === 11 ? 'PF' : 'PJ'}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
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
