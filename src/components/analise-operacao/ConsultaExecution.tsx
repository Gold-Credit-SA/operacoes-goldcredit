import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw, ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CONSULTA_TYPES, type ConsultaTypeId } from './ConsultaSelection';

export type ConsultaStatus = 'pending' | 'running' | 'success' | 'error';

export interface ConsultaResult {
  id: ConsultaTypeId;
  status: ConsultaStatus;
  error?: string;
  data?: Record<string, unknown>;
}

interface ConsultaExecutionProps {
  cnpj: string;
  selected: ConsultaTypeId[];
  onBack: () => void;
  onNewAnalysis: () => void;
}

function formatCnpjDisplay(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function getLabel(id: ConsultaTypeId): string {
  return CONSULTA_TYPES.find(c => c.id === id)?.label || id;
}

async function executeConsulta(cnpj: string, id: ConsultaTypeId): Promise<Record<string, unknown>> {
  // Simulate API call - replace with real integration
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
  
  // Simulate occasional failures for demo
  if (Math.random() < 0.15) {
    throw new Error('Timeout na conexão com o provedor. Tente novamente.');
  }

  return {
    consultaId: id,
    cnpj,
    dataConsulta: new Date().toISOString(),
    status: 'completed',
    resultado: `Resultado da consulta ${getLabel(id)} para o CNPJ ${formatCnpjDisplay(cnpj)}.`,
  };
}

export function ConsultaExecution({ cnpj, selected, onBack, onNewAnalysis }: ConsultaExecutionProps) {
  const [results, setResults] = useState<ConsultaResult[]>(() =>
    selected.map(id => ({ id, status: 'pending' as const }))
  );
  const executedRef = useRef(false);

  const runConsulta = useCallback(async (id: ConsultaTypeId) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'running' as const, error: undefined } : r));
    try {
      const data = await executeConsulta(cnpj, id);
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'success' as const, data } : r));
    } catch (err) {
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'error' as const, error: (err as Error).message } : r));
    }
  }, [cnpj]);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;
    // Run all selected queries in parallel
    selected.forEach(id => runConsulta(id));
  }, [selected, runConsulta]);

  const allDone = results.every(r => r.status === 'success' || r.status === 'error');
  const hasErrors = results.some(r => r.status === 'error');
  const successCount = results.filter(r => r.status === 'success').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0" disabled={!allDone}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {allDone ? 'Resultados' : 'Executando consultas...'}
              </h2>
              {allDone && (
                <Badge variant={hasErrors ? 'destructive' : 'default'} className="text-xs">
                  {successCount}/{results.length} concluídas
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              CNPJ: <span className="font-mono">{formatCnpjDisplay(cnpj)}</span>
            </p>
          </div>
        </div>
        {allDone && (
          <Button variant="outline" size="sm" onClick={onNewAnalysis}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Nova Análise
          </Button>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map(r => (
          <Card key={r.id} className={`transition-colors ${
            r.status === 'success' ? 'border-primary/30' :
            r.status === 'error' ? 'border-destructive/30' :
            ''
          }`}>
            <CardContent className="py-4 flex items-center gap-3">
              {/* Status icon */}
              {r.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
              {r.status === 'running' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
              {r.status === 'success' && <CheckCircle2 className="h-5 w-5 text-primary" />}
              {r.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{getLabel(r.id)}</p>
                {r.status === 'running' && (
                  <p className="text-xs text-muted-foreground">Consultando...</p>
                )}
                {r.status === 'error' && (
                  <p className="text-xs text-destructive">{r.error}</p>
                )}
                {r.status === 'success' && (
                  <p className="text-xs text-muted-foreground">Consulta concluída com sucesso</p>
                )}
              </div>

              {/* Actions */}
              {r.status === 'error' && (
                <Button variant="outline" size="sm" onClick={() => runConsulta(r.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Tentar novamente
                </Button>
              )}
              {r.status === 'success' && (
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Ver detalhes
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
