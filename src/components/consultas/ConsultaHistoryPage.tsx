import { useState, useCallback, useEffect } from 'react';
import { FileText, Download, Loader2, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function formatCnpjDisplay(doc: string): string {
  if (doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
}

interface ConsultaHistoryPageProps {
  platform: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ConsultaHistoryPage({ platform, title, description, icon }: ConsultaHistoryPageProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consulta_history')
        .select('*')
        .eq('platform', platform)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setHistory(data as unknown as HistoryEntry[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, platform]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDownloadPdf = useCallback(async (pdfPath: string) => {
    const { data } = await supabase.storage.from('consulta-pdfs').createSignedUrl(pdfPath, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-lg">Nenhuma consulta realizada.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Realize uma consulta na tela de Consultas para ver o histórico aqui.
              </p>
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
                      <span className="font-mono">{formatCnpjDisplay(entry.cnpj)}</span>
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
