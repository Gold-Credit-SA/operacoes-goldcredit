import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadSqlFile } from '@/lib/api';
import { toast } from 'sonner';

interface SqlUploadProps {
  onUploadSuccess: () => void;
}

export function SqlUpload({ onUploadSuccess }: SqlUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const result = await uploadSqlFile(file);
      
      if (result.success) {
        setUploadStatus('success');
        toast.success(`Arquivo importado com sucesso! ${result.data?.rowsAffected || 0} registros afetados.`);
        onUploadSuccess();
        setFile(null);
      } else {
        setUploadStatus('error');
        toast.error(result.error || 'Erro ao importar arquivo');
      }
    } catch (error) {
      setUploadStatus('error');
      toast.error('Erro de conexão com o servidor. Verifique se o backend está rodando.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Importar Arquivo SQL
        </CardTitle>
        <CardDescription>
          Faça upload de um arquivo .sql para executar no banco de dados MySQL
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
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {uploadStatus === 'success' && (
                <CheckCircle className="h-5 w-5 text-success" />
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

        {file && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="mt-4 w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando SQL...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Executar Script SQL
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
