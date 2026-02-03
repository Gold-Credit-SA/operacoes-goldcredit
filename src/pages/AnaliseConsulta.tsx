import { useState, useCallback } from 'react';
import { FileSearch, Plus } from 'lucide-react';
import { DocumentUpload } from '@/components/analise/DocumentUpload';
import { DocumentList } from '@/components/analise/DocumentList';
import { ExtractedReport } from '@/components/analise/ExtractedReport';
import { LoadingAnalysis } from '@/components/analise/LoadingAnalysis';
import { useToast } from '@/hooks/use-toast';
import type { DocumentoAnalisado, DadosExtraidos } from '@/types/analise';

// PDF.js text extraction (simplified - extracts text from PDF)
async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        
        // Convert to string and extract readable text
        let text = '';
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(bytes);
        
        // Extract text between stream markers and clean up
        const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
        let match;
        while ((match = streamRegex.exec(rawText)) !== null) {
          text += match[1] + '\n';
        }
        
        // Also try to extract text objects
        const textRegex = /\((.*?)\)/g;
        while ((match = textRegex.exec(rawText)) !== null) {
          const extracted = match[1].replace(/\\(\d{3})/g, (_, oct) => 
            String.fromCharCode(parseInt(oct, 8))
          );
          if (extracted.length > 2 && /[a-zA-Z0-9]/.test(extracted)) {
            text += extracted + ' ';
          }
        }
        
        // Clean up the text
        text = text
          .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (text.length < 100) {
          // If extraction failed, send raw content
          resolve(rawText.slice(0, 50000));
        } else {
          resolve(text.slice(0, 50000)); // Limit to 50k chars
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function AnaliseConsulta() {
  const [documentos, setDocumentos] = useState<DocumentoAnalisado[]>([]);
  const [documentoSelecionado, setDocumentoSelecionado] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  const { toast } = useToast();

  const processarDocumento = useCallback(async (file: File, docId: string) => {
    try {
      // Extract text from PDF
      const pdfText = await extractTextFromPDF(file);
      
      if (!pdfText || pdfText.length < 50) {
        throw new Error('Não foi possível extrair texto do PDF. O documento pode ser uma imagem.');
      }

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            pdfContent: pdfText,
            fileName: file.name,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar documento');
      }

      const dados = result.data as DadosExtraidos;

      // Update document with extracted data
      setDocumentos(prev => prev.map(doc => 
        doc.id === docId 
          ? { 
              ...doc, 
              status: 'concluido' as const, 
              tipoDocumento: dados.tipoDocumento,
              dados 
            }
          : doc
      ));

      // Select the processed document
      setDocumentoSelecionado(docId);

      toast({
        title: 'Documento analisado',
        description: `${file.name} processado com sucesso.`,
      });

    } catch (error) {
      console.error('Error processing document:', error);
      
      setDocumentos(prev => prev.map(doc => 
        doc.id === docId 
          ? { ...doc, status: 'erro' as const, erro: error instanceof Error ? error.message : 'Erro desconhecido' }
          : doc
      ));

      toast({
        title: 'Erro ao processar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsProcessing(true);

    // Add documents to list with processing status
    const novosDocumentos: DocumentoAnalisado[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nomeArquivo: file.name,
      tipoDocumento: 'OUTRO' as const,
      status: 'processando' as const,
      dataUpload: new Date(),
    }));

    setDocumentos(prev => [...prev, ...novosDocumentos]);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docId = novosDocumentos[i].id;
      setProcessingDoc(file.name);
      await processarDocumento(file, docId);
    }

    setProcessingDoc(null);
    setIsProcessing(false);
  }, [processarDocumento]);

  const handleRemoverDocumento = useCallback((id: string) => {
    setDocumentos(prev => prev.filter(doc => doc.id !== id));
    if (documentoSelecionado === id) {
      setDocumentoSelecionado(null);
    }
  }, [documentoSelecionado]);

  const handleNovaAnalise = useCallback(() => {
    setDocumentos([]);
    setDocumentoSelecionado(null);
  }, []);

  const documentoAtual = documentos.find(d => d.id === documentoSelecionado);
  const temDocumentosProcessados = documentos.some(d => d.status === 'concluido');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileSearch className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Análise de Consulta</h1>
                <p className="text-sm text-muted-foreground">
                  Upload de documentos VADU, SCR, Serasa para extração via IA
                </p>
              </div>
            </div>

            {temDocumentosProcessados && (
              <button
                onClick={handleNovaAnalise}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Análise
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Upload Area - sempre visível se não há documento selecionado */}
          {!documentoSelecionado && (
            <DocumentUpload
              onFilesSelected={handleFilesSelected}
              isProcessing={isProcessing}
            />
          )}

          {/* Document List */}
          {documentos.length > 0 && !processingDoc && (
            <DocumentList
              documentos={documentos}
              documentoSelecionado={documentoSelecionado}
              onSelecionar={setDocumentoSelecionado}
              onRemover={handleRemoverDocumento}
            />
          )}

          {/* Loading State */}
          {processingDoc && (
            <LoadingAnalysis 
              nomeArquivo={processingDoc} 
              etapa="analise"
            />
          )}

          {/* Extracted Report */}
          {documentoAtual?.status === 'concluido' && documentoAtual.dados && (
            <ExtractedReport
              dados={documentoAtual.dados}
              nomeArquivo={documentoAtual.nomeArquivo}
            />
          )}

          {/* Error State */}
          {documentoAtual?.status === 'erro' && (
            <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Erro ao processar documento
              </h3>
              <p className="text-sm text-muted-foreground">
                {documentoAtual.erro || 'Erro desconhecido. Tente novamente.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
