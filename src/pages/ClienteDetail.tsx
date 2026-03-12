import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, FileText, Loader2, User, MapPin, Shield, Clock, Phone, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { SerasaDetailView } from '@/components/analise-operacao/serasa/SerasaDetailView';
import { ConsultaModal } from '@/components/clientes/ConsultaModal';

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  agrisk_client_id: string | null;
  basic_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
  consulted_by_name: string | null;
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function getPlatformColor(platform: string) {
  switch (platform) {
    case 'serasa': return 'bg-blue-500/10 text-blue-700 border-blue-200';
    case 'scr': return 'bg-green-500/10 text-green-700 border-green-200';
    case 'agrisk': return 'bg-amber-500/10 text-amber-700 border-amber-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

function calcAge(birthDate: string): number | null {
  try {
    const parts = birthDate.includes('/') ? birthDate.split('/') : null;
    let date: Date;
    if (parts && parts.length === 3) {
      date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    } else {
      date = new Date(birthDate);
    }
    if (isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  } catch { return null; }
}

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: clientRes } = await supabase.from('consulta_clients').select('*').eq('id', id).single();
    if (clientRes) {
      const c = clientRes as unknown as ClientRecord;
      setClient(c);
      const { data: hData } = await supabase
        .from('consulta_history')
        .select('*')
        .eq('cnpj', c.cpf_cnpj)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(200);
      if (hData) setHistory(hData as unknown as HistoryEntry[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConsultaDone = () => {
    setConsultaOpen(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-center text-muted-foreground mt-8">Cliente não encontrado.</p>
      </div>
    );
  }

  const bd = client.basic_data as any || {};
  const isCpf = client.cpf_cnpj.length === 11;
  const birthDate = bd.birthDate || bd.dataNascimento || bd.nascimento || null;
  const age = birthDate ? calcAge(birthDate) : null;
  const gender = bd.gender || bd.genero || bd.sexo || null;
  const maritalStatus = bd.maritalStatus || bd.estadoCivil || null;
  const motherName = bd.motherName || bd.nomeMae || null;

  // Validations
  const validations = bd.validations || bd.validacoes || {};
  const receitaFederal = validations.receitaFederal || validations.receita || null;
  const obito = validations.obito || validations.death || null;

  // Addresses, phones, emails from basic_data
  const addresses: any[] = bd.addresses || bd.enderecos || [];
  const phones: any[] = bd.phones || bd.telefones || [];
  const emails: any[] = bd.emails || [];

  const lastUpdate = client.updated_at || client.created_at;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => setConsultaOpen(true)}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Consultar
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar */}
          <div className="lg:w-[340px] shrink-0 space-y-4">
            {/* Update badge */}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                Última Atualização {format(new Date(lastUpdate), 'dd/MM/yyyy')}
              </Badge>
              <Button variant="outline" size="sm" className="text-xs h-7">
                <RefreshCw className="h-3 w-3 mr-1" />
                Atualizar
              </Button>
            </div>

            {/* Informações Cadastrais */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informações Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nome</p>
                  <p className="text-sm font-semibold text-foreground">{client.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{isCpf ? 'CPF' : 'CNPJ'}</p>
                  <p className="text-sm text-foreground">{formatDoc(client.cpf_cnpj)}</p>
                </div>
                {(birthDate || age || gender) && (
                  <div className="grid grid-cols-3 gap-3">
                    {birthDate && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nascimento</p>
                        <p className="text-sm text-foreground">{birthDate}</p>
                      </div>
                    )}
                    {age !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Idade</p>
                        <p className="text-sm text-foreground">{age} Anos</p>
                      </div>
                    )}
                    {gender && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Gênero</p>
                        <p className="text-sm text-foreground">{gender}</p>
                      </div>
                    )}
                  </div>
                )}
                {maritalStatus && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Estado Civil</p>
                    <p className="text-sm text-foreground">{maritalStatus}</p>
                  </div>
                )}
                {motherName && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nome da Mãe</p>
                    <p className="text-sm text-foreground">{motherName}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Validações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Validações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(validations).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {receitaFederal && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Receita Federal</p>
                        <p className="text-sm text-foreground">{receitaFederal}</p>
                      </div>
                    )}
                    {obito !== undefined && obito !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Óbito</p>
                        <p className="text-sm text-foreground">{typeof obito === 'boolean' ? (obito ? 'Positivo' : 'Negativo') : String(obito)}</p>
                      </div>
                    )}
                    {Object.entries(validations).filter(([k]) => k !== 'receitaFederal' && k !== 'receita' && k !== 'obito' && k !== 'death').map(([key, val]) => (
                      <div key={key}>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{formatLabel(key)}</p>
                        <p className="text-sm text-foreground">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Faça uma consulta completa para ver as validações.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tabs: Endereços, Telefones, Emails, Histórico */}
            <Tabs defaultValue="historico" className="w-full">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="historico" className="text-xs gap-1.5">
                  Consultas <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{history.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="enderecos" className="text-xs gap-1.5">
                  Endereços <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{addresses.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="telefones" className="text-xs gap-1.5">
                  Telefones <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{phones.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="emails" className="text-xs gap-1.5">
                  Emails <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{emails.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Histórico de consultas */}
              <TabsContent value="historico">
                <Card>
                  <CardContent className="pt-4">
                    {history.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma consulta realizada.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setConsultaOpen(true)}>
                          <SearchIcon className="h-3.5 w-3.5 mr-1.5" />
                          Fazer primeira consulta
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {history.map(entry => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer"
                            onClick={() => setDetailEntry(entry)}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{entry.consulta_label}</span>
                                <Badge variant="outline" className={`text-[10px] ${getPlatformColor(entry.platform)}`}>
                                  {entry.platform.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                {entry.consulted_by_name && <> · <span className="italic">por {entry.consulted_by_name}</span></>}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setDetailEntry(entry); }}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Endereços */}
              <TabsContent value="enderecos">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Endereços
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {addresses.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum endereço disponível.</p>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Logradouro</TableHead>
                              <TableHead className="w-[100px]">Tipo</TableHead>
                              <TableHead className="w-[90px] text-center">Passagem</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {addresses.map((addr: any, i: number) => {
                              const logradouro = addr.logradouro || addr.street
                                ? [addr.street || addr.logradouro, addr.number || addr.numero, addr.complement || addr.complemento, addr.neighborhood || addr.bairro, addr.zipCode || addr.cep, addr.city || addr.cidade, addr.state || addr.estado].filter(Boolean).join(', ')
                                : JSON.stringify(addr);
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{logradouro}</TableCell>
                                  <TableCell className="text-xs font-medium">{addr.type || addr.tipo || '—'}</TableCell>
                                  <TableCell className="text-xs text-center">{addr.passagem ?? addr.count ?? '—'}</TableCell>
                                  <TableCell className="text-xs text-right">{addr.ultimaPassagem || addr.lastSeen || addr.updatedAt || '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Telefones */}
              <TabsContent value="telefones">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Telefones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {phones.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum telefone disponível.</p>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número</TableHead>
                              <TableHead className="w-[100px]">Tipo</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {phones.map((ph: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-mono">{ph.number || ph.numero || ph.phone || String(ph)}</TableCell>
                                <TableCell className="text-xs">{ph.type || ph.tipo || '—'}</TableCell>
                                <TableCell className="text-xs text-right">{ph.ultimaPassagem || ph.lastSeen || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Emails */}
              <TabsContent value="emails">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      Emails
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {emails.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum e-mail disponível.</p>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>E-mail</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emails.map((em: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs">{em.email || em.address || String(em)}</TableCell>
                                <TableCell className="text-xs text-right">{em.ultimaPassagem || em.lastSeen || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Consulta Modal */}
      {consultaOpen && (
        <ConsultaModal
          cpfCnpj={client.cpf_cnpj}
          clientName={client.name}
          open={consultaOpen}
          onClose={() => setConsultaOpen(false)}
          onDone={handleConsultaDone}
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailEntry?.consulta_label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto pr-2">
            <div className="pb-4 min-w-0">
              {detailEntry?.result_data && (
                detailEntry.consulta_type === 'scr' ? (
                  <SCRDetailView data={detailEntry.result_data} />
                ) : detailEntry.platform === 'serasa' || detailEntry.consulta_type.startsWith('serasa') ? (
                  <SerasaDetailView data={detailEntry.result_data} document={detailEntry.cnpj} consultaId={detailEntry.consulta_type} />
                ) : (
                  <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">
                    {JSON.stringify(detailEntry.result_data, null, 2)}
                  </pre>
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}
