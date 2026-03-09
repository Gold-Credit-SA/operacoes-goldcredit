import { useState, useCallback, useEffect, useMemo } from 'react';
import { FileText, Download, Loader2, Clock, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { SerasaDetailView } from '@/components/analise-operacao/serasa/SerasaDetailView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  pdf_path: string | null;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
  consulted_by_name: string | null;
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
  const { user } = useAuth();  // kept for auth check only
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consulta_history')
        .select('*')
        .eq('platform', platform)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(200);

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

  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = entry.entity_name?.toLowerCase().includes(term);
        const matchesCnpj = entry.cnpj.includes(searchTerm.replace(/\D/g, ''));
        const matchesLabel = entry.consulta_label.toLowerCase().includes(term);
        if (!matchesName && !matchesCnpj && !matchesLabel) return false;
      }
      // Date from filter
      if (dateFrom) {
        const entryDate = entry.created_at.slice(0, 10);
        if (entryDate < dateFrom) return false;
      }
      // Date to filter
      if (dateTo) {
        const entryDate = entry.created_at.slice(0, 10);
        if (entryDate > dateTo) return false;
      }
      return true;
    });
  }, [history, searchTerm, dateFrom, dateTo]);

  const handleDownloadPdf = useCallback(async (pdfPath: string) => {
    const { data } = await supabase.storage.from('consulta-pdfs').createSignedUrl(pdfPath, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }, []);

  const hasFilters = searchTerm || dateFrom || dateTo;

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

      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou CPF/CNPJ..."
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[150px] text-xs"
                  placeholder="De"
                />
                <span className="text-muted-foreground text-xs">até</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[150px] text-xs"
                  placeholder="Até"
                />
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-lg">
                {hasFilters ? 'Nenhuma consulta encontrada com os filtros aplicados.' : 'Nenhuma consulta realizada.'}
              </p>
              {!hasFilters && (
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Realize uma consulta na tela de Consultas para ver o histórico aqui.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filteredHistory.length} consulta(s)</p>
            {filteredHistory.map(entry => (
              <Card key={entry.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="py-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {entry.entity_name || formatCnpjDisplay(entry.cnpj)}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {entry.consulta_label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.entity_name && (
                        <><span className="font-mono">{formatCnpjDisplay(entry.cnpj)}</span>{' · '}</>
                      )}
                      {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {entry.consulted_by_name && (
                        <>{' · '}<span className="italic">por {entry.consulted_by_name}</span></>
                      )}
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
              {detailEntry?.entity_name || detailEntry?.consulta_label}
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
