import { FileText, CheckCircle, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentoAnalisado } from '@/types/analise';

interface DocumentListProps {
  documentos: DocumentoAnalisado[];
  documentoSelecionado: string | null;
  onSelecionar: (id: string) => void;
  onRemover: (id: string) => void;
}

const tipoLabels: Record<string, string> = {
  VADU: 'CreditBox/VADU',
  SCR: 'SCR',
  SERASA: 'Serasa',
  OUTRO: 'Outro',
};

export function DocumentList({ documentos, documentoSelecionado, onSelecionar, onRemover }: DocumentListProps) {
  if (documentos.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">
          Documentos Processados ({documentos.length})
        </h3>
      </div>
      
      <div className="divide-y divide-border">
        {documentos.map((doc) => (
          <div
            key={doc.id}
            className={cn(
              "flex items-center justify-between p-4 transition-colors cursor-pointer",
              documentoSelecionado === doc.id
                ? "bg-primary/5"
                : "hover:bg-muted/50"
            )}
            onClick={() => doc.status === 'concluido' && onSelecionar(doc.id)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "p-2 rounded-lg",
                doc.status === 'concluido' ? "bg-primary/10" : "bg-muted"
              )}>
                <FileText className={cn(
                  "h-5 w-5",
                  doc.status === 'concluido' ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.nomeArquivo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tipoLabels[doc.tipoDocumento] || doc.tipoDocumento}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {doc.status === 'processando' && (
                <div className="flex items-center gap-2 text-amber-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Processando</span>
                </div>
              )}
              
              {doc.status === 'concluido' && (
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Concluído</span>
                </div>
              )}
              
              {doc.status === 'erro' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Erro</span>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemover(doc.id);
                }}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
