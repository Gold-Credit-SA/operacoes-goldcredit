import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw, ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CONSULTA_TYPES, type ConsultaTypeId } from './ConsultaSelection';
import { SCRDetailView } from './SCRDetailView';
import { SerasaDetailView } from './serasa/SerasaDetailView';
import { isSerasaConsulta } from './serasa/config';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  saveToPlatform?: string;
  entityName?: string;
}

function formatDocDisplay(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function getLabel(id: ConsultaTypeId): string {
  return CONSULTA_TYPES.find((c) => c.id === id)?.label || id;
}

async function executeConsulta(document: string, id: ConsultaTypeId): Promise<Record<string, unknown>> {
  if (id === 'scr') {
    const { data, error } = await supabase.functions.invoke('hbi-scr', {
      body: { cnpj: document },
    });
    if (error) throw new Error(error.message || 'Erro ao consultar SCR.');
    if (data?.error) throw new Error(data.error);
    return data?.data || data;
  }

  if (isSerasaConsulta(id)) {
    const { data, error } = await supabase.functions.invoke('serasa-report', {
      body: { document, consultaId: id },
    });
    if (error) throw new Error(error.message || 'Erro ao consultar Serasa.');
    if (data?.error) {
      const msg = String(data.error);
      if (msg.toLowerCase().includes('nao encontrado') || msg.toLowerCase().includes('não encontrado')) {
        throw new Error('Documento nao encontrado. Em homologacao, use a massa de testes informada pela Serasa.');
      }
      throw new Error(msg);
    }
    return data?.data || data;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 2000));

  if (Math.random() < 0.15) {
    throw new Error('Timeout na conexao com o provedor. Tente novamente.');
  }

  return {
    consultaId: id,
    cnpj: document,
    dataConsulta: new Date().toISOString(),
    status: 'completed',
    resultado: `Resultado da consulta ${getLabel(id)} para ${formatDocDisplay(document)}.`,
  };
}

export function ConsultaExecution({
  cnpj,
  selected,
  onBack,
  onNewAnalysis,
  saveToPlatform,
  entityName,
}: ConsultaExecutionProps) {
  const { profile } = useAuth();
  const [results, setResults] = useState<ConsultaResult[]>(() =>
    selected.map((id) => ({ id, status: 'pending' as const })),
  );
  const executedRef = useRef(false);
  const [detailResult, setDetailResult] = useState<ConsultaResult | null>(null);

  const runConsulta = useCallback(async (id: ConsultaTypeId) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'running', error: undefined } : r)));
    try {
      const data = await executeConsulta(cnpj, id);
      setResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'success', data } : r)));

      if (saveToPlatform) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const extractedName =
            entityName ||
            (data as any)?.data?.name ||
            (data as any)?.name ||
            (data as any)?.response?.name ||
            (data as any)?.data?.response?.name ||
            (data as any)?.razaoSocial ||
            (data as any)?.nomeCliente ||
            (data as any)?.data?.razaoSocial ||
            null;

          await supabase.from('consulta_history').insert({
            user_id: user.id,
            cnpj,
            platform: saveToPlatform,
            consulta_type: id,
            consulta_label: getLabel(id),
            result_data: data as any,
            status: 'success',
            entity_name: extractedName,
            consulted_by_name: profile?.name || user.email || null,
          } as any);
        }
      }
    } catch (err) {
      setResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'error', error: (err as Error).message } : r)),
      );
    }
  }, [cnpj, entityName, profile?.name, saveToPlatform]);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;
    selected.forEach((id) => runConsulta(id));
  }, [selected, runConsulta]);

  const allDone = results.every((r) => r.status === 'success' || r.status === 'error');
  const hasErrors = results.some((r) => r.status === 'error');
  const successCount = results.filter((r) => r.status === 'success').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
                  {successCount}/{results.length} concluidas
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {cnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'}:{' '}
              <span className="font-mono">{formatDocDisplay(cnpj)}</span>
            </p>
          </div>
        </div>
        {allDone && (
          <Button variant="outline" size="sm" onClick={onNewAnalysis}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Nova Analise
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {results.map((r) => (
          <Card
            key={r.id}
            className={`transition-colors ${
              r.status === 'success'
                ? 'border-primary/30'
                : r.status === 'error'
                  ? 'border-destructive/30'
                  : ''
            }`}
          >
            <CardContent className="flex items-center gap-3 py-4">
              {r.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
              {r.status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {r.status === 'success' && <CheckCircle2 className="h-5 w-5 text-primary" />}
              {r.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{getLabel(r.id)}</p>
                {r.status === 'running' && <p className="text-xs text-muted-foreground">Consultando...</p>}
                {r.status === 'error' && <p className="text-xs text-destructive">{r.error}</p>}
                {r.status === 'success' && (
                  <p className="text-xs text-muted-foreground">Consulta concluida com sucesso</p>
                )}
              </div>

              {r.status === 'error' && (
                <Button variant="outline" size="sm" onClick={() => runConsulta(r.id)}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              )}
              {r.status === 'success' && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDetailResult(r)}>
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  Ver detalhes
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!detailResult} onOpenChange={(open) => !open && setDetailResult(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailResult ? getLabel(detailResult.id) : ''}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {detailResult?.data &&
              (detailResult.id === 'scr' ? (
                <SCRDetailView data={detailResult.data} />
              ) : isSerasaConsulta(detailResult.id) ? (
                <SerasaDetailView data={detailResult.data} />
              ) : (
                <div className="space-y-3">{renderDetailData(detailResult.data)}</div>
              ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderDetailData(data: Record<string, unknown>, depth = 0): React.ReactNode {
  return Object.entries(data).map(([key, value]) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} space-y-1`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formatKey(key)}</p>
          <div className="space-y-2 border-l-2 border-border pl-3">
            {renderDetailData(value as Record<string, unknown>, depth + 1)}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} space-y-1`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formatKey(key)}</p>
          {value.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nenhum item</p>
          ) : (
            <div className="space-y-2">
              {value.map((item, i) => (
                <div key={i} className="rounded-md border border-border p-2">
                  {typeof item === 'object' ? (
                    renderDetailData(item as Record<string, unknown>, depth + 1)
                  ) : (
                    <p className="text-sm text-foreground">{String(item)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={key} className={`${depth > 0 ? 'ml-4' : ''} flex items-baseline gap-2 py-0.5`}>
        <span className="shrink-0 text-xs text-muted-foreground">{formatKey(key)}:</span>
        <span className="break-all text-sm text-foreground">{String(value)}</span>
      </div>
    );
  });
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
