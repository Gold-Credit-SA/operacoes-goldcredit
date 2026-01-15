import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CsvImportProps {
  onImportSuccess?: () => void;
}

const TABLE_OPTIONS = [
  { value: 'grupos_analise_vadu', label: 'Grupos Análise VADU' },
  { value: 'operadores', label: 'Operadores' },
  { value: 'regimes_tributarios', label: 'Regimes Tributários' },
  { value: 'estados_civis', label: 'Estados Civis' },
  { value: 'fontes_captacao', label: 'Fontes de Captação' },
  { value: 'gerentes', label: 'Gerentes' },
  { value: 'controladores', label: 'Controladores' },
  { value: 'contas_bancarias', label: 'Contas Bancárias' },
  { value: 'paginations', label: 'Paginações' },
  { value: 'cedentes_completo', label: 'Cedentes Completo' },
  { value: 'operacoes_individualizadas', label: 'Operações Individualizadas' },
  { value: 'receita_por_cedente', label: 'Receita por Cedente' },
  { value: 'titulos_em_aberto', label: 'Títulos em Aberto' },
  { value: 'titulos_prorrogados', label: 'Títulos Prorrogados' },
  { value: 'titulos_quitados', label: 'Títulos Quitados' },
  { value: 'titulos_quitados_suspeita_fraude', label: 'Títulos Quitados Suspeita Fraude' },
  { value: 'titulos_recomprados', label: 'Títulos Recomprados' },
];

type ImportStatus = 'idle' | 'reading' | 'importing' | 'success' | 'error';

export function CsvImport({ onImportSuccess }: CsvImportProps) {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ rowsInserted: number; totalRows: number; errors?: string[] } | null>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Formato inválido', { description: 'Por favor, selecione um arquivo .csv' });
      return;
    }
    setFile(selectedFile);
    setStatus('idle');
    setProgress(0);
    setResult(null);
    
    // Try to auto-detect table from filename
    const fileName = selectedFile.name.toLowerCase();
    for (const table of TABLE_OPTIONS) {
      if (fileName.includes(table.value.replace('_', ''))) {
        setSelectedTable(table.value);
        break;
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImport = async () => {
    if (!file || !selectedTable) {
      toast.error('Erro', { description: 'Selecione um arquivo e uma tabela de destino' });
      return;
    }

    setStatus('reading');
    setProgress(10);
    setStatusMessage('Lendo arquivo CSV...');

    try {
      const csvContent = await file.text();
      const lines = csvContent.trim().split('\n').length - 1; // Subtract header
      
      setStatus('importing');
      setProgress(30);
      setStatusMessage(`Importando ${lines} registros para ${selectedTable}...`);

      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: { 
          tableName: selectedTable, 
          csvContent,
          batchSize: 100
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao importar dados');
      }

      setProgress(100);
      setStatus('success');
      setResult(data);
      setStatusMessage(`${data.rowsInserted} de ${data.totalRows} registros importados com sucesso!`);
      
      toast.success('Importação concluída!', {
        description: `${data.rowsInserted} registros importados para ${selectedTable}`
      });

      if (data.errors && data.errors.length > 0) {
        toast.warning('Alguns erros ocorreram', {
          description: data.errors.slice(0, 3).join('; ')
        });
      }

      onImportSuccess?.();
    } catch (err) {
      setStatus('error');
      setProgress(0);
      const errorMessage = (err as Error).message;
      setStatusMessage(errorMessage);
      toast.error('Erro na importação', { description: errorMessage });
    }
  };

  const resetForm = () => {
    setFile(null);
    setSelectedTable('');
    setStatus('idle');
    setProgress(0);
    setStatusMessage('');
    setResult(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Importar CSV
        </CardTitle>
        <CardDescription>
          Importe dados de arquivos CSV para as tabelas do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Table Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tabela de Destino</label>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tabela..." />
            </SelectTrigger>
            <SelectContent>
              {TABLE_OPTIONS.map((table) => (
                <SelectItem key={table.value} value={table.value}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Drop Zone */}
        <div
          className={`
            relative rounded-lg border-2 border-dashed p-6 transition-all duration-200 cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${file ? 'bg-muted/30' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('csv-file-input')?.click()}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) handleFileSelect(selectedFile);
            }}
          />
          
          <div className="flex flex-col items-center gap-2 text-center">
            {file ? (
              <>
                <FileText className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Arraste um arquivo CSV aqui</p>
                  <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress and Status */}
        {status !== 'idle' && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center gap-2 text-sm">
              {status === 'reading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {status === 'importing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
              <span className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                {statusMessage}
              </span>
            </div>
          </div>
        )}

        {/* Result Details */}
        {result && result.errors && result.errors.length > 0 && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Avisos:</p>
            <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-300 space-y-1">
              {result.errors.slice(0, 5).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {result.errors.length > 5 && (
                <li>...e mais {result.errors.length - 5} erros</li>
              )}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleImport}
            disabled={!file || !selectedTable || status === 'reading' || status === 'importing'}
            className="flex-1"
          >
            {status === 'reading' || status === 'importing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </>
            )}
          </Button>
          
          {(status === 'success' || status === 'error') && (
            <Button variant="outline" onClick={resetForm}>
              Nova Importação
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
