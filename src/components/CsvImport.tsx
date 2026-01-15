import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Database, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CsvImportProps {
  onImportSuccess?: () => void;
}

interface FileMapping {
  file: File;
  tableName: string;
  status: 'pending' | 'importing' | 'success' | 'error';
  rowsInserted?: number;
  totalRows?: number;
  error?: string;
}

const TABLE_MAPPINGS: Record<string, string> = {
  'grupos_analise_vadu': 'grupos_analise_vadu',
  'gruposanalisevadu': 'grupos_analise_vadu',
  'operadores': 'operadores',
  'regimes_tributarios': 'regimes_tributarios',
  'regimestributarios': 'regimes_tributarios',
  'estados_civis': 'estados_civis',
  'estadoscivis': 'estados_civis',
  'fontes_captacao': 'fontes_captacao',
  'fontescaptacao': 'fontes_captacao',
  'gerentes': 'gerentes',
  'controladores': 'controladores',
  'contas_bancarias': 'contas_bancarias',
  'contasbancarias': 'contas_bancarias',
  'paginations': 'paginations',
  'cedentes_completo': 'cedentes_completo',
  'cedentescompleto': 'cedentes_completo',
  'cedentes': 'cedentes_completo',
  'smartsecurities_cedentes': 'cedentes_completo',
  'operacoes_individualizadas': 'operacoes_individualizadas',
  'operacoesindividualizadas': 'operacoes_individualizadas',
  'receita_por_cedente': 'receita_por_cedente',
  'receitaporcedente': 'receita_por_cedente',
  'titulos_em_aberto': 'titulos_em_aberto',
  'titulosemaberto': 'titulos_em_aberto',
  'titulos_prorrogados': 'titulos_prorrogados',
  'titulosprorrogados': 'titulos_prorrogados',
  'titulos_quitados': 'titulos_quitados',
  'titulosquitados': 'titulos_quitados',
  'titulos_quitados_suspeita_fraude': 'titulos_quitados_suspeita_fraude',
  'titulosquitadossuspeitafraude': 'titulos_quitados_suspeita_fraude',
  'titulos_recomprados': 'titulos_recomprados',
  'titulosrecomprados': 'titulos_recomprados',
  // SmartSecurities prefixed tables
  'smartsecurities_contas_bancarias': 'contas_bancarias',
  'smartsecurities_controladores': 'controladores',
  'smartsecurities_estados_civis': 'estados_civis',
  'smartsecurities_fontes_captacao': 'fontes_captacao',
  'smartsecurities_gerentes': 'gerentes',
  'smartsecurities_grupos_analise_vadu': 'grupos_analise_vadu',
  'smartsecurities_operadores': 'operadores',
  'smartsecurities_operacoes_individualizadas': 'operacoes_individualizadas',
  'smartsecurities_receita_por_cedente': 'receita_por_cedente',
  'smartsecurities_regimes_tributarios': 'regimes_tributarios',
  'smartsecurities_titulos_em_aberto': 'titulos_em_aberto',
  'smartsecurities_titulos_prorrogados': 'titulos_prorrogados',
  'smartsecurities_titulos_quitados': 'titulos_quitados',
  'smartsecurities_titulos_quitados_suspeita_fraude': 'titulos_quitados_suspeita_fraude',
  'smartsecurities_titulos_recomprados': 'titulos_recomprados',
};

const TABLE_LABELS: Record<string, string> = {
  'grupos_analise_vadu': 'Grupos Análise VADU',
  'operadores': 'Operadores',
  'regimes_tributarios': 'Regimes Tributários',
  'estados_civis': 'Estados Civis',
  'fontes_captacao': 'Fontes de Captação',
  'gerentes': 'Gerentes',
  'controladores': 'Controladores',
  'contas_bancarias': 'Contas Bancárias',
  'paginations': 'Paginações',
  'cedentes_completo': 'Cedentes Completo',
  'operacoes_individualizadas': 'Operações Individualizadas',
  'receita_por_cedente': 'Receita por Cedente',
  'titulos_em_aberto': 'Títulos em Aberto',
  'titulos_prorrogados': 'Títulos Prorrogados',
  'titulos_quitados': 'Títulos Quitados',
  'titulos_quitados_suspeita_fraude': 'Títulos Suspeita Fraude',
  'titulos_recomprados': 'Títulos Recomprados',
};

function detectTableFromFilename(filename: string): string | null {
  const cleanName = filename
    .toLowerCase()
    .replace(/\.csv$/, '')
    .replace(/_\d{12}$/, '') // Remove timestamp like _202601151003
    .replace(/[-\s]/g, '_');
  
  // Direct match
  if (TABLE_MAPPINGS[cleanName]) {
    return TABLE_MAPPINGS[cleanName];
  }
  
  // Partial match
  for (const [pattern, tableName] of Object.entries(TABLE_MAPPINGS)) {
    if (cleanName.includes(pattern) || pattern.includes(cleanName)) {
      return tableName;
    }
  }
  
  return null;
}

type ImportStatus = 'idle' | 'importing' | 'complete';

export function CsvImport({ onImportSuccess }: CsvImportProps) {
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>('');

  const handleFilesSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const csvFiles = fileArray.filter(f => f.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      toast.error('Nenhum arquivo CSV selecionado');
      return;
    }

    const mappings: FileMapping[] = csvFiles.map(file => {
      const tableName = detectTableFromFilename(file.name);
      return {
        file,
        tableName: tableName || '',
        status: 'pending'
      };
    });

    const unmapped = mappings.filter(m => !m.tableName);
    if (unmapped.length > 0) {
      toast.warning(`${unmapped.length} arquivo(s) não reconhecido(s)`, {
        description: unmapped.map(m => m.file.name).join(', ')
      });
    }

    setFileMappings(prev => [...prev, ...mappings.filter(m => m.tableName)]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    setFileMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportAll = async () => {
    if (fileMappings.length === 0) {
      toast.error('Nenhum arquivo para importar');
      return;
    }

    setStatus('importing');
    setOverallProgress(0);

    const total = fileMappings.length;
    let completed = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < fileMappings.length; i++) {
      const mapping = fileMappings[i];
      setCurrentFile(mapping.file.name);
      
      // Update status to importing
      setFileMappings(prev => prev.map((m, idx) => 
        idx === i ? { ...m, status: 'importing' } : m
      ));

      try {
        const csvContent = await mapping.file.text();
        const lines = csvContent.trim().split('\n').length - 1;

        const { data, error } = await supabase.functions.invoke('import-csv', {
          body: { 
            tableName: mapping.tableName, 
            csvContent,
            batchSize: 100
          }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Erro desconhecido');

        setFileMappings(prev => prev.map((m, idx) => 
          idx === i ? { 
            ...m, 
            status: 'success',
            rowsInserted: data.rowsInserted,
            totalRows: data.totalRows || lines
          } : m
        ));
        successCount++;
      } catch (err) {
        const errorMessage = (err as Error).message;
        setFileMappings(prev => prev.map((m, idx) => 
          idx === i ? { ...m, status: 'error', error: errorMessage } : m
        ));
        errorCount++;
      }

      completed++;
      setOverallProgress(Math.round((completed / total) * 100));
    }

    setStatus('complete');
    setCurrentFile('');

    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) importado(s) com sucesso!`);
      onImportSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) com erro`);
    }
  };

  const resetForm = () => {
    setFileMappings([]);
    setStatus('idle');
    setOverallProgress(0);
    setCurrentFile('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pendingCount = fileMappings.filter(m => m.status === 'pending').length;
  const successCount = fileMappings.filter(m => m.status === 'success').length;
  const errorCount = fileMappings.filter(m => m.status === 'error').length;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Importar CSVs
        </CardTitle>
        <CardDescription>
          Arraste múltiplos arquivos CSV para importar de uma vez
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Drop Zone */}
        <div
          className={`
            relative rounded-lg border-2 border-dashed p-6 transition-all duration-200 cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('csv-files-input')?.click()}
        >
          <input
            id="csv-files-input"
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelect(e.target.files);
              e.target.value = '';
            }}
          />
          
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Arraste arquivos CSV aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar múltiplos</p>
            </div>
          </div>
        </div>

        {/* File List */}
        {fileMappings.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{fileMappings.length} arquivo(s) selecionado(s)</span>
              {status === 'idle' && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Limpar todos
                </Button>
              )}
            </div>
            
            {fileMappings.map((mapping, index) => (
              <div 
                key={`${mapping.file.name}-${index}`}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border
                  ${mapping.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
                  ${mapping.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}
                  ${mapping.status === 'importing' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
                  ${mapping.status === 'pending' ? 'bg-muted/30' : ''}
                `}
              >
                {mapping.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground" />}
                {mapping.status === 'importing' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                {mapping.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {mapping.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mapping.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TABLE_LABELS[mapping.tableName] || mapping.tableName} • {formatFileSize(mapping.file.size)}
                    {mapping.rowsInserted !== undefined && (
                      <span className="text-green-600 dark:text-green-400">
                        {' '}• {mapping.rowsInserted} registros
                      </span>
                    )}
                    {mapping.error && (
                      <span className="text-red-600 dark:text-red-400">
                        {' '}• {mapping.error}
                      </span>
                    )}
                  </p>
                </div>

                {status === 'idle' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {status === 'importing' && (
          <div className="space-y-2">
            <Progress value={overallProgress} className="h-2" />
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">
                Importando {currentFile}... ({overallProgress}%)
              </span>
            </div>
          </div>
        )}

        {/* Summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-4 text-sm">
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {successCount} sucesso
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {errorCount} erro(s)
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleImportAll}
            disabled={fileMappings.length === 0 || status === 'importing' || pendingCount === 0}
            className="flex-1"
          >
            {status === 'importing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar {pendingCount > 0 ? `${pendingCount} Arquivo(s)` : 'Todos'}
              </>
            )}
          </Button>
          
          {status === 'complete' && (
            <Button variant="outline" onClick={resetForm}>
              Nova Importação
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
