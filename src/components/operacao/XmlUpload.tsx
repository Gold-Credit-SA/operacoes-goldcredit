import { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotaFiscalXml } from '@/lib/xml-nfe-parser';
import { parseMultipleXmls } from '@/lib/xml-nfe-parser';

interface Props {
  onNotasParsed: (notas: (NotaFiscalXml & { fileName: string })[]) => void;
}

export function XmlUpload({ onNotasParsed }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [erros, setErros] = useState<{ fileName: string; error: string }[]>([]);
  const [processing, setProcessing] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    setProcessing(true);
    setErros([]);

    const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (xmlFiles.length === 0) {
      setErros([{ fileName: '', error: 'Nenhum arquivo XML selecionado' }]);
      setProcessing(false);
      return;
    }

    const contents = await Promise.all(
      xmlFiles.map(async f => ({
        name: f.name,
        content: await f.text(),
      }))
    );

    const { notas, erros: parseErrors } = parseMultipleXmls(contents);
    setErros(parseErrors);

    if (notas.length > 0) {
      onNotasParsed(notas);
    }
    setProcessing(false);
  }, [onNotasParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          processing && "pointer-events-none opacity-50"
        )}
      >
        <input
          type="file"
          accept=".xml"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={processing}
        />
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className={cn(
            "p-3 rounded-full transition-colors",
            isDragOver ? "bg-primary/10" : "bg-muted"
          )}>
            <Upload className={cn("h-7 w-7", isDragOver ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">
              {processing ? 'Processando...' : 'Arraste XMLs de NF-e aqui ou clique para selecionar'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Notas fiscais eletrônicas no formato padrão SEFAZ
            </p>
          </div>
        </div>
      </div>

      {erros.length > 0 && (
        <div className="space-y-1.5">
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                {e.fileName && <span className="font-medium">{e.fileName}: </span>}
                {e.error}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
