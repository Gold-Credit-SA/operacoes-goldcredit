import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserFormDialog } from '@/components/admin/UserFormDialog';
import { UserCard } from '@/components/admin/UserCard';
import { StatsCard } from '@/components/admin/StatsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { checkSignerStatus, listarCertificados, type Certificado } from '@/lib/assinatura-api';
import {
  clearGoldCreditCertificatePreference,
  getGoldCreditCertificatePreference,
  matchGoldCreditCertificate,
  saveGoldCreditCertificatePreference,
  type GoldCreditCertificatePreference,
} from '@/lib/goldsign-settings';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, Users, Shield, UserCheck, Info, Briefcase, Check, X, Clock, RefreshCw, FileSignature, Link2, Trash2, Loader2, Zap, Save,
} from 'lucide-react';

interface UserData {
  id: string;
  user_id: string;
  email: string;
  name: string;
  created_at: string;
  user_roles: { role: string }[];
}

interface Assignment {
  id: string;
  user_id: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string | null;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
}

interface GestorOverview {
  user_id: string;
  name: string;
  email: string;
  total_cedentes: number;
  pending_requests: number;
}

const MASTER_EMAIL = 'renan@goldcreditsa.com.br';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);

  // Portfolio admin
  const [gestors, setGestors] = useState<GestorOverview[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingAssignment, setRejectingAssignment] = useState<Assignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [preferredGoldCreditCert, setPreferredGoldCreditCert] = useState<GoldCreditCertificatePreference | null>(null);
  const [certificadosLocais, setCertificadosLocais] = useState<Certificado[]>([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [loadingSigningSettings, setLoadingSigningSettings] = useState(true);
  const [loadingLocalCerts, setLoadingLocalCerts] = useState(false);
  const [savingSigningSettings, setSavingSigningSettings] = useState(false);
  const [signerOnline, setSignerOnline] = useState(false);
  const [signingSettingsError, setSigningSettingsError] = useState('');

  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // CRM integration
  const [crmUrl, setCrmUrl] = useState('');
  const [crmToken, setCrmToken] = useState('');
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmSaving, setCrmSaving] = useState(false);

  const fetchCrmSettings = async () => {
    setCrmLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_settings')
        .select('url, api_token')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      setCrmUrl(data?.url ?? '');
      setCrmToken(data?.api_token ?? '');
    } catch (err: any) {
      toast({ title: 'Erro ao carregar CRM', description: err.message, variant: 'destructive' });
    } finally {
      setCrmLoading(false);
    }
  };

  const handleSaveCrmSettings = async () => {
    setCrmSaving(true);
    try {
      const { error } = await supabase
        .from('crm_settings')
        .upsert({
          id: 1,
          url: crmUrl.trim() || null,
          api_token: crmToken.trim() || null,
          updated_by: currentUser?.id ?? null,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast({ title: 'Configuração do CRM salva' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setCrmSaving(false);
    }
  };


  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setUsers(data.data || []);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolioData = async () => {
    setPortfolioLoading(true);
    try {
      const [overviewRes, pendingRes] = await Promise.all([
        supabase.functions.invoke('portfolio-data', { body: { action: 'admin-overview' } }),
        supabase.functions.invoke('portfolio-data', { body: { action: 'list-assignments', status: 'pending' } }),
      ]);
      if (overviewRes.data?.success) {
        setGestors(overviewRes.data.gestors);
      }
      if (pendingRes.data?.success) {
        setPendingAssignments(pendingRes.data.assignments);
      }
    } catch {
      toast({ title: 'Erro ao carregar carteiras', variant: 'destructive' });
    } finally {
      setPortfolioLoading(false);
    }
  };

  const fetchSigningSettings = async () => {
    setLoadingSigningSettings(true);
    setSigningSettingsError('');
    try {
      const data = await getGoldCreditCertificatePreference();
      setPreferredGoldCreditCert(data);
    } catch (error: any) {
      setPreferredGoldCreditCert(null);
      setSigningSettingsError(error.message || 'Nao foi possivel carregar as configuracoes de assinatura.');
    } finally {
      setLoadingSigningSettings(false);
    }
  };

  const fetchLocalCertificates = async () => {
    setLoadingLocalCerts(true);
    try {
      const status = await checkSignerStatus();
      setSignerOnline(status.online);
      if (!status.online) {
        setCertificadosLocais([]);
        return;
      }

      const certs = await listarCertificados();
      setCertificadosLocais(certs);

      const matched = matchGoldCreditCertificate(certs, preferredGoldCreditCert);
      setSelectedCertId(matched?.cert_id || certs[0]?.cert_id || '');
    } catch (error: any) {
      setCertificadosLocais([]);
      toast({ title: 'Erro ao carregar certificados locais', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingLocalCerts(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPortfolioData();
    fetchCrmSettings();
  }, []);

  useEffect(() => {
    if (activeTab !== 'assinatura' || !currentUser || currentUser.email !== MASTER_EMAIL) {
      return;
    }
    fetchSigningSettings();
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (activeTab !== 'assinatura' || !currentUser || currentUser.email !== MASTER_EMAIL) {
      return;
    }
    fetchLocalCertificates();
  }, [activeTab, currentUser, preferredGoldCreditCert]);

  const handleOpenDialog = (user?: UserData) => {
    setEditingUser(user || null);
    setDialogOpen(true);
  };

  const handleSave = async (formData: { name: string; email: string; password: string }) => {
    if (!formData.name || !formData.email) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e e-mail são obrigatórios.', variant: 'destructive' });
      return;
    }
    if (!editingUser && !formData.password) {
      toast({ title: 'Senha obrigatória', description: 'Defina uma senha para o novo usuário.', variant: 'destructive' });
      return;
    }
    if (formData.password && formData.password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updateData: any = { userId: editingUser.user_id, name: formData.name };
        if (formData.password) updateData.password = formData.password;
        if (formData.email && formData.email !== editingUser.email) {
          updateData.email = formData.email;
        }
        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'update', ...updateData },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        toast({ title: 'Usuário atualizado', description: `${formData.name} foi atualizado.` });
      } else {
        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'create', ...formData },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        toast({ title: 'Usuário criado', description: `${formData.name} foi adicionado.` });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Usuário excluído', description: `${user.name} foi removido.` });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (assignmentId: string) => {
    setProcessing(assignmentId);
    try {
      const { error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'approve-assignment', assignment_id: assignmentId },
      });
      if (error) throw error;
      toast({ title: 'Aprovado', description: 'Cedente vinculado à carteira do gestor.' });
      fetchPortfolioData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const openRejectDialog = (assignment: Assignment) => {
    setRejectingAssignment(assignment);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingAssignment) return;
    if (!rejectionReason.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Informe o motivo da recusa.', variant: 'destructive' });
      return;
    }
    setProcessing(rejectingAssignment.id);
    try {
      const { error } = await supabase.functions.invoke('portfolio-data', {
        body: {
          action: 'reject-assignment',
          assignment_id: rejectingAssignment.id,
          rejection_reason: rejectionReason.trim(),
        },
      });
      if (error) throw error;
      toast({ title: 'Recusado', description: 'Solicitação rejeitada com motivo registrado.' });
      setRejectDialogOpen(false);
      fetchPortfolioData();
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

  const totalUsers = users.length;
  const adminCount = users.filter(u => u.email === 'renan@goldcreditsa.com.br').length;
  const regularUsers = totalUsers - adminCount;
  const selectedCert = certificadosLocais.find((cert) => cert.cert_id === selectedCertId) || null;

  const handleSavePreferredCertificate = async () => {
    if (!selectedCert) {
      toast({ title: 'Selecione um certificado', description: 'Escolha o certificado da Gold Credit para vincular.', variant: 'destructive' });
      return;
    }

    setSavingSigningSettings(true);
    try {
      const saved = await saveGoldCreditCertificatePreference(selectedCert);
      setPreferredGoldCreditCert(saved);
      toast({ title: 'Certificado vinculado', description: 'A Gold Credit agora sera auto-selecionada nas telas internas quando esse certificado estiver instalado.' });
    } catch (error: any) {
      toast({ title: 'Erro ao vincular certificado', description: error.message, variant: 'destructive' });
    } finally {
      setSavingSigningSettings(false);
    }
  };

  const handleClearPreferredCertificate = async () => {
    setSavingSigningSettings(true);
    try {
      await clearGoldCreditCertificatePreference();
      setPreferredGoldCreditCert(null);
      setSelectedCertId('');
      toast({ title: 'Vinculo removido', description: 'A selecao automatica do certificado da Gold Credit foi desativada.' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover vinculo', description: error.message, variant: 'destructive' });
    } finally {
      setSavingSigningSettings(false);
    }
  };

  return (
    <MainLayout title="Configurações" subtitle="Gerencie usuários, permissões e carteiras do sistema">
      <div className="space-y-6 max-w-5xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="assinatura" className="gap-2">
              <FileSignature className="h-4 w-4" /> Assinatura
            </TabsTrigger>
            <TabsTrigger value="carteiras" className="gap-2">
              <Briefcase className="h-4 w-4" /> Carteiras
              {pendingAssignments.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {pendingAssignments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-2">
              <Zap className="h-4 w-4" /> CRM
            </TabsTrigger>
          </TabsList>

          {/* ===== USUARIOS TAB ===== */}
          <TabsContent value="usuarios" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard title="Total de usuários" value={loading ? '-' : totalUsers} description="Cadastrados no sistema" icon={Users} />
              <StatsCard title="Administradores" value={loading ? '-' : adminCount} description="Acesso total" icon={Shield} iconClassName="bg-primary/10" />
              <StatsCard title="Usuários comuns" value={loading ? '-' : regularUsers} description="Acesso padrão" icon={UserCheck} iconClassName="bg-muted" />
            </div>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" /> Gerenciar Usuários
                    </CardTitle>
                    <CardDescription>Adicione, edite ou remova usuários do sistema</CardDescription>
                  </div>
                  <Button onClick={() => handleOpenDialog()} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" /> Novo Usuário
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-5 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <p className="font-medium">Nenhum usuário cadastrado</p>
                    <p className="text-sm text-muted-foreground">Clique em "Novo Usuário" para adicionar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map(user => {
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

            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="shrink-0 p-2 rounded-lg bg-background border">
                    <Info className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">Sobre permissões</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong>Administradores</strong> têm acesso total incluindo gerenciamento de usuários e aprovação de carteiras.
                      <strong> Usuários comuns</strong> acessam todas as funcionalidades exceto esta área.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assinatura" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" /> Certificado preferencial da Gold Credit
                </CardTitle>
                <CardDescription>
                  O master define qual certificado da Gold Credit deve ser usado como preferencial. Nas telas internas de contrato-mae, esse certificado sera auto-selecionado quando estiver instalado na maquina do usuario.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {signingSettingsError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Nao foi possivel carregar o certificado vinculado da Gold Credit. Finalize o deploy da migration e da edge function `goldsign-settings` no Supabase para habilitar esse recurso.
                    <div className="mt-2 text-xs opacity-80">{signingSettingsError}</div>
                  </div>
                ) : null}

                {loadingSigningSettings ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Certificado atualmente vinculado</p>
                    {preferredGoldCreditCert?.gold_credit_cert_document ? (
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <p><strong className="text-foreground">Titular:</strong> {preferredGoldCreditCert.gold_credit_cert_subject_cn || 'Nao informado'}</p>
                        <p><strong className="text-foreground">Documento:</strong> {preferredGoldCreditCert.gold_credit_cert_document}</p>
                        <p><strong className="text-foreground">Serie:</strong> {preferredGoldCreditCert.gold_credit_cert_serial_number || 'Nao informada'}</p>
                        <p><strong className="text-foreground">Vinculado por:</strong> {preferredGoldCreditCert.gold_credit_cert_linked_by_email || 'Nao informado'}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nenhum certificado foi vinculado ainda. Enquanto isso, as pessoas continuam precisando selecionar manualmente o certificado da Gold Credit.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Certificados instalados nesta maquina</p>
                      <p className="text-xs text-muted-foreground">
                        O vinculo nao envia a chave privada para lugar nenhum. Ele so serve para auto-selecionar o certificado correto quando ele estiver instalado localmente.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchLocalCertificates} disabled={loadingLocalCerts || savingSigningSettings}>
                      {loadingLocalCerts ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>

                  {!signerOnline ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      O assinador local nao foi detectado em <code>localhost:8765</code>. Abra o assinador para listar e vincular o certificado da Gold Credit.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Selecionar certificado da Gold Credit</Label>
                        <Select value={selectedCertId} onValueChange={setSelectedCertId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um certificado instalado" />
                          </SelectTrigger>
                          <SelectContent>
                            {certificadosLocais.map((cert) => (
                              <SelectItem key={cert.cert_id} value={cert.cert_id}>
                                {cert.subject_cn} · {cert.cpf_cnpj}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleSavePreferredCertificate} disabled={!selectedCert || savingSigningSettings || Boolean(signingSettingsError)}>
                          {savingSigningSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                          Vincular certificado
                        </Button>
                        <Button variant="outline" onClick={handleClearPreferredCertificate} disabled={savingSigningSettings || !preferredGoldCreditCert?.gold_credit_cert_document || Boolean(signingSettingsError)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover vinculo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CARTEIRAS TAB ===== */}
          <TabsContent value="carteiras" className="space-y-6">
            {/* Gestors overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="h-5 w-5" /> Gestores e Carteiras
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchPortfolioData} disabled={portfolioLoading}>
                    <RefreshCw className={`h-4 w-4 ${portfolioLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {portfolioLoading ? (
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
                {portfolioLoading ? (
                  <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
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
                              {' · '}{new Date(a.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove(a.id)} disabled={processing === a.id}>
                              <Check className="h-4 w-4 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openRejectDialog(a)} disabled={processing === a.id}>
                              <X className="h-4 w-4 mr-1" /> Recusar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CRM TAB ===== */}
          <TabsContent value="crm" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> Integração com CRM
                </CardTitle>
                <CardDescription>
                  Configure o endpoint do CRM e o token de autenticação para envio de prospects gerados a partir de consultas SCR.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {crmLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="crm-url">URL do CRM</Label>
                      <Input
                        id="crm-url"
                        type="url"
                        placeholder="https://crm.exemplo.com.br"
                        value={crmUrl}
                        onChange={(e) => setCrmUrl(e.target.value)}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">
                        O envio usa <code>{`{URL}/api/public/prospects-internos`}</code>.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crm-token">API Token</Label>
                      <Input
                        id="crm-token"
                        type="password"
                        placeholder="••••••••"
                        value={crmToken}
                        onChange={(e) => setCrmToken(e.target.value)}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enviado como <code>Authorization: Bearer {`{token}`}</code>. Se o secret <code>CRM_API_TOKEN</code> estiver configurado no projeto, ele tem precedência.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveCrmSettings} disabled={crmSaving}>
                        {crmSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUser={editingUser ? { name: editingUser.name, email: editingUser.email } : null}
        onSave={handleSave}
        saving={saving}
        isMasterUser={editingUser?.email === MASTER_EMAIL}
      />

      {/* Rejection reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. O gestor será notificado com esta informação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {rejectingAssignment && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Cedente:</strong> {rejectingAssignment.cedente_nome || formatCpfCnpj(rejectingAssignment.cedente_cpf_cnpj)}</p>
                <p className="text-muted-foreground mt-1">
                  Solicitado em {new Date(rejectingAssignment.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            <Textarea
              placeholder="Motivo da recusa (obrigatório)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing === rejectingAssignment?.id}
            >
              <X className="h-4 w-4 mr-1" /> Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
