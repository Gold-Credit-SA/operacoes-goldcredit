import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserFormDialog } from '@/components/admin/UserFormDialog';
import { UserCard } from '@/components/admin/UserCard';
import { StatsCard } from '@/components/admin/StatsCard';
import { 
  Plus, 
  Users, 
  Shield, 
  UserCheck,
  Info
} from 'lucide-react';

interface UserData {
  id: string;
  user_id: string;
  email: string;
  name: string;
  created_at: string;
  user_roles: { role: string }[];
}

export default function AdminSettings() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenDialog = (user?: UserData) => {
    setEditingUser(user || null);
    setDialogOpen(true);
  };

  const handleSave = async (formData: { name: string; email: string; password: string }) => {
    if (!formData.name || !formData.email) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e e-mail são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!editingUser && !formData.password) {
      toast({
        title: 'Senha obrigatória',
        description: 'Defina uma senha para o novo usuário.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingUser) {
        const updateData: any = { userId: editingUser.user_id, name: formData.name };
        if (formData.password) {
          updateData.password = formData.password;
        }

        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'update', ...updateData },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast({ 
          title: 'Usuário atualizado',
          description: `As informações de ${formData.name} foram atualizadas com sucesso.`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'create', ...formData },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        toast({ 
          title: 'Usuário criado',
          description: `${formData.name} foi adicionado ao sistema com sucesso.`,
        });
      }

      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserData) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: user.user_id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ 
        title: 'Usuário excluído',
        description: `${user.name} foi removido do sistema.`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Stats calculations
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.email === 'renan@goldcreditsa.com.br').length;
  const regularUsers = totalUsers - adminCount;

  return (
    <MainLayout 
      title="Configurações" 
      subtitle="Gerencie usuários e permissões do sistema"
    >
      <div className="space-y-8 max-w-5xl">
        {/* Stats Overview */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Visão geral do sistema</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Total de usuários"
              value={loading ? '-' : totalUsers}
              description="Cadastrados no sistema"
              icon={Users}
            />
            <StatsCard
              title="Administradores"
              value={loading ? '-' : adminCount}
              description="Acesso total ao sistema"
              icon={Shield}
              iconClassName="bg-primary/10"
            />
            <StatsCard
              title="Usuários comuns"
              value={loading ? '-' : regularUsers}
              description="Acesso padrão"
              icon={UserCheck}
              iconClassName="bg-muted"
            />
          </div>
        </section>

        {/* Users Management */}
        <section className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Gerenciar Usuários
                  </CardTitle>
                  <CardDescription>
                    Adicione, edite ou remova usuários que têm acesso ao sistema
                  </CardDescription>
                </div>
                
                <Button onClick={() => handleOpenDialog()} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-5 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Nenhum usuário cadastrado</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Novo Usuário" para adicionar o primeiro usuário ao sistema.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => {
                    const isCurrentUser = user.user_id === currentUser?.id;
                    const isMaster = user.email === 'renan@goldcreditsa.com.br';

                    return (
                      <UserCard
                        key={user.id}
                        user={user}
                        isCurrentUser={isCurrentUser}
                        isMaster={isMaster}
                        onEdit={() => handleOpenDialog(user)}
                        onDelete={() => handleDelete(user)}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Help Section */}
        <section>
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-5">
              <div className="flex gap-4">
                <div className="shrink-0 p-2 rounded-lg bg-background border">
                  <Info className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Sobre permissões</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Administradores</strong> têm acesso total ao sistema, incluindo gerenciamento de usuários. 
                    <strong> Usuários comuns</strong> podem acessar todas as funcionalidades exceto esta área de configurações.
                    O administrador principal não pode ser excluído.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* User Form Dialog */}
      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUser={editingUser ? { name: editingUser.name, email: editingUser.email } : null}
        onSave={handleSave}
        saving={saving}
      />
    </MainLayout>
  );
}
