import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FileText, Download, Loader2, Clock, Search, X, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { SerasaDetailView } from '@/components/analise-operacao/serasa/SerasaDetailView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
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
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

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

  const handleGeneratePdf = useCallback(async (entry: HistoryEntry) => {
    setGeneratingPdfId(entry.id);
    // Wait for hidden content to render fully
    await new Promise(r => setTimeout(r, 800));

    const el = pdfContentRef.current;
    if (!el) {
      setGeneratingPdfId(null);
      return;
    }

    try {
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const maxContentHeight = pdfHeight - margin * 2;
      const pdf = new jsPDF('p', 'mm', 'a4');

      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pdfWidth - margin, margin + 3, { align: 'right' });

      let currentY = margin + 6;

      // Get direct children of the contentRef (individual sections)
      const children = Array.from(el.children) as HTMLElement[];

      for (const child of children) {
        // Skip elements with zero height
        if (child.offsetHeight === 0) continue;

        const canvas = await html2canvas(child, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 800,
          scrollY: 0,
          scrollX: 0,
        });

        const renderedHeight = (canvas.height * contentWidth) / canvas.width;

        // Check if we need a new page
        if (currentY + renderedHeight > maxContentHeight + margin && currentY > margin + 6) {
          pdf.addPage();
          currentY = margin;
        }

        if (renderedHeight > maxContentHeight) {
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const pagePixelHeight = (maxContentHeight * imgWidth) / contentWidth;
          const totalSlices = Math.ceil(imgHeight / pagePixelHeight);

          for (let s = 0; s < totalSlices; s++) {
            if (s > 0) { pdf.addPage(); currentY = margin; }
            const srcY = s * pagePixelHeight;
            const srcH = Math.min(pagePixelHeight, imgHeight - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = Math.ceil(srcH);
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(canvas, 0, Math.floor(srcY), imgWidth, Math.ceil(srcH), 0, 0, imgWidth, Math.ceil(srcH));
            }
            const sliceHeight = (srcH * contentWidth) / imgWidth;
            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, currentY, contentWidth, sliceHeight);
            currentY += sliceHeight;
          }
        } else {
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, contentWidth, renderedHeight);
          currentY += renderedHeight + 2;
        }
      }

      const cleanDoc = entry.cnpj.replace(/\D/g, '');
      const fileName = `${entry.consulta_label}-${cleanDoc}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setGeneratingPdfId(null);
    }
  }, []);

  const hasFilters = searchTerm || dateFrom || dateTo;
  const pdfEntry = generatingPdfId ? history.find(h => h.id === generatingPdfId) : null;

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
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setDetailEntry(entry)}>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={generatingPdfId === entry.id}
                          onClick={() => handleGeneratePdf(entry)}
                        >
                          {generatingPdfId === entry.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5 mr-1" />
                          )}
                          PDF
                        </Button>
                      </>
                    )}
                    {entry.pdf_path && (
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(entry.pdf_path!)}>
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Baixar
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailEntry?.entity_name || detailEntry?.consulta_label}
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

      {/* Hidden render for PDF generation */}
      {pdfEntry?.result_data && (
        <div className="fixed left-[-9999px] top-0 w-[800px] bg-white" style={{ visibility: 'hidden', zIndex: -1 }}>
          {pdfEntry.consulta_type === 'scr' ? (
            <div ref={pdfContentRef} className="space-y-6 p-4">
              <SCRDetailView data={pdfEntry.result_data} />
            </div>
          ) : pdfEntry.platform === 'serasa' || pdfEntry.consulta_type.startsWith('serasa') ? (
            <SerasaDetailView
              data={pdfEntry.result_data}
              document={pdfEntry.cnpj}
              consultaId={pdfEntry.consulta_type}
              hideExportButton
              externalRef={pdfContentRef}
            />
          ) : (
            <div ref={pdfContentRef} className="p-4">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(pdfEntry.result_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
