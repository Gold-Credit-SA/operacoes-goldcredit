import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X, Clock, UserCheck, RefreshCw } from 'lucide-react';

interface Assignment {
  id: string;
  user_id: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string | null;
  status: string;
  created_at: string;
}

interface GestorOverview {
  user_id: string;
  name: string;
  email: string;
  total_cedentes: number;
  pending_requests: number;
}

export default function CarteiraPendencias() {
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [gestors, setGestors] = useState<GestorOverview[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();
  const { isMaster } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, pendingRes] = await Promise.all([
        supabase.functions.invoke('portfolio-data', { body: { action: 'admin-overview' } }),
        supabase.functions.invoke('portfolio-data', { body: { action: 'list-assignments', status: 'pending' } }),
      ]);

      if (overviewRes.data?.success) {
        setGestors(overviewRes.data.gestors);
        setPendingTotal(overviewRes.data.pendingTotal);
      }
      if (pendingRes.data?.success) {
        setPendingAssignments(pendingRes.data.assignments);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (assignmentId: string, action: 'approve-assignment' | 'reject-assignment') => {
    setProcessing(assignmentId);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action, assignment_id: assignmentId },
      });
      if (error) throw error;
      toast({
        title: action === 'approve-assignment' ? 'Aprovado' : 'Rejeitado',
        description: action === 'approve-assignment'
          ? 'Cedente vinculado à carteira do gestor.'
          : 'Solicitação rejeitada.',
      });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const formatCpfCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 14) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return value;
  };

  if (!isMaster) {
    return (
      <MainLayout title="Sem permissão">
        <p className="text-muted-foreground">Apenas o administrador pode acessar esta página.</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Gestão de Carteiras" subtitle="Visão consolidada de todos os gestores e aprovação de solicitações">
      <div className="space-y-6 max-w-5xl">
        {/* Gestors overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5" /> Gestores ({gestors.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : gestors.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum gestor cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {gestors.map(g => (
                  <div key={g.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {g.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{g.total_cedentes} cedente(s)</Badge>
                      {g.pending_requests > 0 && (
                        <Badge variant="destructive">{g.pending_requests} pendente(s)</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" /> Solicitações Pendentes ({pendingAssignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : pendingAssignments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="space-y-3">
                {pendingAssignments.map(a => {
                  const gestor = gestors.find(g => g.user_id === a.user_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{a.cedente_nome || formatCpfCnpj(a.cedente_cpf_cnpj)}</p>
                        <p className="text-xs text-muted-foreground">
                          Solicitado por <span className="font-medium">{gestor?.name || 'Gestor'}</span>
                          {' · '}{new Date(a.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(a.id, 'approve-assignment')}
                          disabled={processing === a.id}
                        >
                          <Check className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(a.id, 'reject-assignment')}
                          disabled={processing === a.id}
                        >
                          <X className="h-4 w-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
