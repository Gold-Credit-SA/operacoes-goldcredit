import { Loader2, FileSearch, Brain, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingAnalysisProps {
  nomeArquivo?: string;
  etapa?: 'leitura' | 'analise' | 'processamento';
}

const etapas = {
  leitura: { icon: FileSearch, texto: 'Lendo documento...' },
  analise: { icon: Brain, texto: 'Analisando com IA...' },
  processamento: { icon: FileText, texto: 'Processando dados...' },
};

export function LoadingAnalysis({ nomeArquivo, etapa = 'analise' }: LoadingAnalysisProps) {
  const etapaInfo = etapas[etapa];
  const Icon = etapaInfo.icon;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header animado */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <div className="absolute inset-0 animate-ping">
            <div className="w-16 h-16 rounded-full bg-primary/20" />
          </div>
          <div className="relative p-4 rounded-full bg-primary/10">
            <Icon className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">{etapaInfo.texto}</p>
          </div>
          {nomeArquivo && (
            <p className="text-sm text-muted-foreground">{nomeArquivo}</p>
          )}
        </div>
      </div>

      {/* Skeleton do relatório */}
      <div className="space-y-6">
        {/* Identificação */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>

        {/* Score e Restrições */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-16 w-24 mb-4" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          
          <div className="bg-card border border-border rounded-xl p-6">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </div>

        {/* Comportamento Financeiro */}
        <div className="bg-card border border-border rounded-xl p-6">
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
