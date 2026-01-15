import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { createChunks, estimateChunks } from '@/lib/sql-chunker';
import { toast } from 'sonner';

interface SqlUploadProps {
  onUploadSuccess: () => void;
}

export function SqlUpload({ onUploadSuccess }: SqlUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.sql')) {
        toast.error('Por favor, selecione um arquivo .sql');
        return;
      }
      setFile(selectedFile);
      setUploadStatus('idle');
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.sql')) {
        toast.error('Por favor, selecione um arquivo .sql');
        return;
      }
      setFile(droppedFile);
      setUploadStatus('idle');
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setProgress(0);

    try {
      const sql = await file.text();
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      
      // For large files, process in chunks
      if (sql.length > 500 * 1024) { // > 500KB
        const chunks = createChunks(sql);
        const totalChunks = chunks.length;
        
        setProgressMessage(`Preparando ${totalChunks} partes (${fileSizeMB}MB)`);
        
        let totalRowsAffected = 0;
        let totalStatementsExecuted = 0;
        const allTablesCreated: string[] = [];
        const allErrors: string[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          setProgress(Math.round(((i) / totalChunks) * 100));
          setProgressMessage(`Processando parte ${i + 1} de ${totalChunks}...`);
          
          const { data, error } = await supabase.functions.invoke('process-sql', {
            body: { 
              action: 'import', 
              sql: chunk.content,
              chunkInfo: {
                index: chunk.index,
                total: chunk.total,
                isLast: chunk.isLast
              }
            }
          });

          if (error) {
            console.error(`Chunk ${i + 1} error:`, error);
            allErrors.push(`Parte ${i + 1}: ${error.message}`);
            continue;
          }

          if (data?.data) {
            totalRowsAffected += data.data.rowsAffected || 0;
            totalStatementsExecuted += data.data.statementsExecuted || 0;
            if (data.data.tablesCreated) {
              allTablesCreated.push(...data.data.tablesCreated);
            }
            if (data.data.errors) {
              allErrors.push(...data.data.errors.slice(0, 5));
            }
          }
        }
        
        setProgress(100);
        setUploadStatus('success');
        
        const uniqueTables = [...new Set(allTablesCreated)];
        let message = `Importação concluída! ${totalStatementsExecuted} comandos, ${totalRowsAffected} registros`;
        if (uniqueTables.length > 0) {
          message += `. Tabelas: ${uniqueTables.join(', ')}`;
        }
        
        toast.success(message);
        
        if (allErrors.length > 0) {
          console.warn('Import errors:', allErrors);
          toast.warning(`${allErrors.length} erros durante importação`);
        }
        
        onUploadSuccess();
        setFile(null);
        
      } else {
        // Small file - process in one request
        setProgressMessage('Processando...');
        
        const { data, error } = await supabase.functions.invoke('process-sql', {
          body: { action: 'import', sql }
        });

        if (error) {
          setUploadStatus('error');
          toast.error(error.message || 'Erro ao importar arquivo');
          return;
        }
        
        if (data?.success) {
          setUploadStatus('success');
          setProgress(100);
          toast.success(data.message || `Arquivo importado! ${data.data?.rowsAffected || 0} registros.`);
          onUploadSuccess();
          setFile(null);
        } else {
          setUploadStatus('error');
          toast.error(data?.error || 'Erro ao importar arquivo');
        }
      }
    } catch (error) {
      setUploadStatus('error');
      toast.error('Erro ao processar arquivo SQL.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setProgressMessage('');
    }
  };

  const estimatedChunks = file ? estimateChunks(file.size) : 0;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Importar Arquivo SQL
        </CardTitle>
        <CardDescription>
          Faça upload de um arquivo .sql para executar no banco de dados (suporta arquivos grandes)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-muted/50"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".sql"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {file ? (
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                  {estimatedChunks > 1 && ` • ~${estimatedChunks} partes`}
                </p>
              </div>
              {uploadStatus === 'success' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {uploadStatus === 'error' && (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          ) : (
            <>
              <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-center text-muted-foreground">
                Arraste um arquivo .sql aqui ou clique para selecionar
              </p>
            </>
          )}
        </div>

        {isUploading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              {progressMessage || `${progress}%`}
            </p>
          </div>
        )}

        {file && !isUploading && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="mt-4 w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Executar Script SQL
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
