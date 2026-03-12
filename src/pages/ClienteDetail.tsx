import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, FileText, Loader2, User, MapPin, Calendar, Shield, Clock, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    const [clientRes, historyRes] = await Promise.all([
      supabase.from('consulta_clients').select('*').eq('id', id).single(),
      // We'll load history after we have the client's cpf_cnpj
      Promise.resolve(null),
    ]);

    if (clientRes.data) {
      const c = clientRes.data as unknown as ClientRecord;
      setClient(c);
      // Load history by cpf_cnpj
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
    loadData(); // Refresh history
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

  const basicData = client.basic_data as any;
  const isCpf = client.cpf_cnpj.length === 11;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
              {client.name?.charAt(0)?.toUpperCase() || '#'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {client.name || 'Nome não disponível'}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono">{formatDoc(client.cpf_cnpj)}</span>
                <Badge variant="outline" className="text-[10px]">{isCpf ? 'PF' : 'PJ'}</Badge>
              </div>
            </div>
          </div>
          <Button onClick={() => setConsultaOpen(true)}>
            <SearchIcon className="h-4 w-4 mr-2" />
            Consultar
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Cadastral Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="Nome" value={client.name} />
              <InfoRow label="Documento" value={formatDoc(client.cpf_cnpj)} />
              <InfoRow label="Tipo" value={isCpf ? 'Pessoa Física' : 'Pessoa Jurídica'} />
              {basicData?.birthDate && <InfoRow label="Nascimento" value={basicData.birthDate} />}
              {basicData?.gender && <InfoRow label="Gênero" value={basicData.gender === 'M' ? 'Masculino' : basicData.gender === 'F' ? 'Feminino' : basicData.gender} />}
              {basicData?.maritalStatus && <InfoRow label="Estado Civil" value={basicData.maritalStatus} />}
              {basicData?.motherName && <InfoRow label="Nome da Mãe" value={basicData.motherName} />}
              <InfoRow label="Cadastrado em" value={format(new Date(client.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Validações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {basicData?.validations ? (
                Object.entries(basicData.validations as Record<string, unknown>).map(([key, val]) => (
                  <InfoRow key={key} label={formatLabel(key)} value={String(val)} />
                ))
              ) : (
                <p className="text-muted-foreground text-xs">Nenhuma validação disponível.</p>
              )}
              {basicData?.addresses && Array.isArray(basicData.addresses) && basicData.addresses.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Endereço</span>
                  </div>
                  {basicData.addresses.map((addr: any, i: number) => (
                    <p key={i} className="text-xs text-foreground">
                      {[addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Histórico de Consultas
              <Badge variant="secondary" className="text-[10px] ml-auto">{history.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma consulta realizada ainda.
              </p>
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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right truncate">{value}</span>
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
