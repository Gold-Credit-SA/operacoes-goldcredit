import { useState, useCallback } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CONSULTA_GROUPS, type ConsultaTypeId } from '@/components/analise-operacao/ConsultaSelection';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Status = 'idle' | 'running' | 'success' | 'error';

interface ConsultaResult {
  id: ConsultaTypeId;
  status: Status;
  error?: string;
}

interface ConsultaModalProps {
  cpfCnpj: string;
  clientName: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

function getLabel(id: ConsultaTypeId): string {
  for (const g of CONSULTA_GROUPS) {
    const found = g.items.find(i => i.id === id);
    if (found) return found.label;
  }
  return id;
}

function getPlatform(id: ConsultaTypeId): string {
  if (id.startsWith('serasa')) return 'serasa';
  if (id === 'scr') return 'scr';
  return 'agrisk';
}

async function runSingleConsulta(cnpj: string, id: ConsultaTypeId): Promise<Record<string, unknown>> {
  if (id === 'scr') {
    const { data, error } = await supabase.functions.invoke('hbi-scr', { body: { cnpj } });
    if (error) throw new Error(error.message || 'Erro SCR');
    if (data?.error) throw new Error(data.error);
    return data?.data || data;
  }
  if (id.startsWith('serasa_')) {
    const { data, error } = await supabase.functions.invoke('serasa-report', { body: { document: cnpj, consultaId: id } });
    if (error) throw new Error(error.message || 'Erro Serasa');
    if (data?.error) throw new Error(data.error);
    return data?.data || data;
  }
  // AgRisk
  const { data, error } = await supabase.functions.invoke('agrisk-query', {
    body: { taxId: cnpj.replace(/\D/g, ''), consultaType: id },
  });
  if (error) throw new Error(error.message || 'Erro AgRisk');
  if (data?.error) throw new Error(data.error);
  return data?.data || data;
}

export function ConsultaModal({ cpfCnpj, clientName, open, onClose, onDone }: ConsultaModalProps) {
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<Set<ConsultaTypeId>>(new Set());
  const [phase, setPhase] = useState<'select' | 'executing'>('select');
  const [results, setResults] = useState<ConsultaResult[]>([]);

  const isCpf = cpfCnpj.length === 11;

  // Only show specific AgRisk items (adding gradually)
  const allowedAgriskItems = new Set(['consulta_cliente']);

  const filteredGroups = CONSULTA_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if ((item.id === 'serasa_basico_pf' || item.id === 'serasa_avancado_top_score_pf') && !isCpf) return false;
      if ((item.id === 'serasa_basico_pj' || item.id === 'serasa_avancado_pj') && isCpf) return false;
      // For AgRisk, only show explicitly allowed items
      if (group.provider === 'Agrisk' && !allowedAgriskItems.has(item.id)) return false;
      return true;
    }),
  })).filter(g => g.items.length > 0);

  const toggle = (id: ConsultaTypeId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const executeAll = useCallback(async () => {
    const ids = Array.from(selected);
    setPhase('executing');
    setResults(ids.map(id => ({ id, status: 'running' })));

    const promises = ids.map(async (id) => {
      try {
        const data = await runSingleConsulta(cpfCnpj, id);
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'success' as const } : r));

        // Save to history
        if (user) {
          const extractedName = clientName
            || (data as any)?.name
            || (data as any)?.data?.name
            || null;

          await supabase.from('consulta_history').insert({
            user_id: user.id,
            cnpj: cpfCnpj,
            platform: getPlatform(id),
            consulta_type: id,
            consulta_label: getLabel(id),
            result_data: data as any,
            status: 'success',
            entity_name: extractedName,
            consulted_by_name: profile?.name || user.email || null,
          } as any);
        }
      } catch (err: any) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'error' as const, error: err.message } : r));
      }
    });

    await Promise.all(promises);
  }, [selected, cpfCnpj, user, profile, clientName]);

  const allDone = results.length > 0 && results.every(r => r.status === 'success' || r.status === 'error');
  const successCount = results.filter(r => r.status === 'success').length;

  const handleClose = () => {
    if (phase === 'executing' && !allDone) return; // Don't close while running
    if (phase === 'executing') {
      onDone();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            {phase === 'select' ? 'Selecionar Consultas' : 'Executando Consultas'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'select'
              ? 'Escolha os tipos de consulta para este cliente.'
              : `${successCount}/${results.length} concluída(s)`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {phase === 'select' ? (
            <div className="space-y-4 py-2">
              {filteredGroups.map(group => (
                <div key={group.provider} className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                    {group.provider}
                  </span>
                  <div className="grid gap-1.5">
                    {group.items.map(ct => (
                      <label
                        key={ct.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selected.has(ct.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <Checkbox checked={selected.has(ct.id)} onCheckedChange={() => toggle(ct.id)} />
                        <span className="text-sm text-foreground">{ct.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {results.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  {r.status === 'running' && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
                  {r.status === 'success' && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  {r.status === 'error' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{getLabel(r.id)}</p>
                    {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {phase === 'select' ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={executeAll} disabled={selected.size === 0}>
                Executar ({selected.size})
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} disabled={!allDone}>
              {allDone ? 'Fechar' : <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Aguarde...</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
