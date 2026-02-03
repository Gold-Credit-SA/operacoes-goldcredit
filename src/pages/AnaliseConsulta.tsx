import { useState, useCallback } from 'react';
import { FileSearch, Plus } from 'lucide-react';
import { DocumentUpload } from '@/components/analise/DocumentUpload';
import { DocumentList } from '@/components/analise/DocumentList';
import { ExtractedReport } from '@/components/analise/ExtractedReport';
import { LoadingAnalysis } from '@/components/analise/LoadingAnalysis';
import { useToast } from '@/hooks/use-toast';
import type { DocumentoAnalisado, DadosExtraidos } from '@/types/analise';

// Convert file to base64 for sending to AI
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof File)) {
      reject(new Error('Arquivo inválido'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        if (!result) {
          reject(new Error('Falha ao ler arquivo'));
          return;
        }
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Falha ao converter para base64'));
          return;
        }
        console.log('File converted to base64, length:', base64.length);
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo: ' + reader.error?.message));
    };
    
    reader.readAsDataURL(file);
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
      console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      if (!file || file.size === 0) {
        throw new Error('Arquivo vazio ou inválido');
      }

      // Convert PDF to base64 for multimodal AI processing
      const pdfBase64 = await fileToBase64(file);
      
      if (!pdfBase64 || pdfBase64.length === 0) {
        throw new Error('Falha ao converter PDF para base64');
      }

      console.log('Sending to edge function, base64 length:', pdfBase64.length);

      // Call edge function with base64 PDF
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            pdfBase64,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
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
