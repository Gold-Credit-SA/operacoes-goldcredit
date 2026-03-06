import { useState, useCallback, useEffect } from 'react';
import { Search, ChevronDown, FileText, Download, Loader2, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CnpjInput } from '@/components/analise-operacao/CnpjInput';
import { ConsultaExecution } from '@/components/analise-operacao/ConsultaExecution';
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { CONSULTA_GROUPS, type ConsultaTypeId } from '@/components/analise-operacao/ConsultaSelection';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Platform {
  id: string;
  label: string;
  description: string;
  consultaIds: ConsultaTypeId[];
}

const PLATFORMS: Platform[] = [
  {
    id: 'serasa',
    label: 'Serasa',
    description: 'Consultas de crédito Serasa Avançado',
    consultaIds: CONSULTA_GROUPS.find(g => g.provider === 'Serasa')?.items.map(i => i.id) || [],
  },
  {
    id: 'scr',
    label: 'SCR (HBI)',
    description: 'Sistema de Informações de Crédito do Banco Central',
    consultaIds: CONSULTA_GROUPS.find(g => g.provider === 'HBI')?.items.map(i => i.id) || [],
  },
  {
    id: 'agrisk',
    label: 'Agrisk',
    description: 'Restritivos, Endividamento, CPR, Imóveis e Patrimônio',
    consultaIds: CONSULTA_GROUPS.find(g => g.provider === 'Agrisk')?.items.map(i => i.id) || [],
  },
];

interface HistoryEntry {
  id: string;
  cnpj: string;
  consulta_label: string;
  consulta_type: string;
  pdf_path: string | null;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
}

type Step = 'platform' | 'cnpj' | 'execution' | 'history';

function formatCnpjDisplay(cnpj: string): string {
  if (cnpj.length === 11) {
    return `${cnpj.slice(0, 3)}.${cnpj.slice(3, 6)}.${cnpj.slice(6, 9)}-${cnpj.slice(9)}`;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export default function Consultas() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);

  const loadHistory = useCallback(async (platformId: string) => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('consulta_history')
        .select('*')
        .eq('platform', platformId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setHistory(data as unknown as HistoryEntry[]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  const handleSelectPlatform = useCallback((platform: Platform) => {
    setSelectedPlatform(platform);
    setStep('history');
    loadHistory(platform.id);
  }, [loadHistory]);

  const handleCnpjConfirm = useCallback((value: string) => {
    setCnpj(value);
    setStep('execution');
  }, []);

  const handleBackToPlatform = useCallback(() => {
    setStep('platform');
    setSelectedPlatform(null);
    setHistory([]);
  }, []);

  const handleNewConsulta = useCallback(() => {
    setStep('cnpj');
    setCnpj('');
  }, []);

  const handleExecutionDone = useCallback(() => {
    if (selectedPlatform) {
      loadHistory(selectedPlatform.id);
    }
    setStep('history');
  }, [selectedPlatform, loadHistory]);

  const handleDownloadPdf = useCallback(async (pdfPath: string) => {
    const { data } = await supabase.storage.from('consulta-pdfs').createSignedUrl(pdfPath, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            {step !== 'platform' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={step === 'history' ? handleBackToPlatform : step === 'cnpj' ? () => setStep('history') : () => setStep('history')}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="p-2 rounded-lg bg-primary/10">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Consultas
                {selectedPlatform && <span className="text-muted-foreground font-normal"> / {selectedPlatform.label}</span>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedPlatform?.description || 'Selecione a plataforma de consulta'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Platform Selection */}
        {step === 'platform' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Plataformas disponíveis</h2>
            <div className="grid gap-3">
              {PLATFORMS.map(platform => (
                <Card
                  key={platform.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => handleSelectPlatform(platform)}
                >
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {platform.label}
                      </h3>
                      <p className="text-sm text-muted-foreground">{platform.description}</p>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* History + New Consulta Button */}
        {step === 'history' && selectedPlatform && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Histórico de Consultas</h2>
              <Button onClick={handleNewConsulta}>
                <Search className="h-4 w-4 mr-1.5" />
                Nova Consulta
              </Button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Nenhuma consulta realizada nesta plataforma.</p>
                  <Button onClick={handleNewConsulta} variant="outline" className="mt-4">
                    Realizar primeira consulta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {history.map(entry => (
                  <Card key={entry.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="py-3 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{entry.consulta_label}</span>
                          <Badge variant={entry.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">
                            {entry.status === 'success' ? 'Sucesso' : 'Erro'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          CNPJ: <span className="font-mono">{formatCnpjDisplay(entry.cnpj)}</span>
                          {' · '}
                          {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.result_data && (
                          <Button variant="ghost" size="sm" onClick={() => setDetailEntry(entry)}>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Detalhes
                          </Button>
                        )}
                        {entry.pdf_path && (
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(entry.pdf_path!)}>
                            <Download className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CNPJ Input */}
        {step === 'cnpj' && (
          <CnpjInput onConfirm={handleCnpjConfirm} />
        )}

        {/* Execution */}
        {step === 'execution' && selectedPlatform && (
          <ConsultaExecution
            cnpj={cnpj}
            selected={selectedPlatform.consultaIds}
            onBack={() => setStep('cnpj')}
            onNewAnalysis={handleExecutionDone}
            saveToPlatform={selectedPlatform.id}
          />
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailEntry?.consulta_label}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {detailEntry?.result_data && (
              detailEntry.consulta_type === 'scr' ? (
                <SCRDetailView data={detailEntry.result_data} />
              ) : (
                <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {JSON.stringify(detailEntry.result_data, null, 2)}
                </pre>
              )
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
