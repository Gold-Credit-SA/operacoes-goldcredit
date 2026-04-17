import { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CONSULTA_GROUPS, type ConsultaTypeId } from '@/components/analise-operacao/ConsultaSelection';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { transformSmartCedenteData } from '@/lib/smartCedente';

type Status = 'idle' | 'running' | 'success' | 'error';

interface ConsultaResult {
  id: ConsultaTypeId;
  status: Status;
  error?: string;
}

interface AgriskProduct {
  name: string;
  code: string;
  _id: string;
  price: number;
}

interface ConsultaModalProps {
  cpfCnpj: string;
  clientName: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const AGRISK_TOPIC_GROUPS = [
  {
    title: 'Cliente',
    items: ['consulta_cliente'],
    description: 'Sintegra, Grupos, Compliance, Judicial',
  },
  {
    title: 'Patrimônio',
    items: ['armazens', 'patrimonio_veicular'],
  },
  {
    title: 'Imóveis Rurais',
    items: ['imoveis_simples', 'imoveis_car'],
  },
] as const;

const SMART_GROUP = {
  provider: 'Smart',
  items: [{ id: 'smart_cedente', label: 'Consulta Smart' }],
} as const;

// Map AgRisk product codes to our frontend IDs
const CODE_TO_FRONTEND_ID: Record<string, string> = {
  'consulta-cliente': 'consulta_cliente',
  'pesquisa-imoveis': 'imoveis_simples',
  'car': 'imoveis_car',
  'vehicle-assets': 'patrimonio_veicular',
};

const AGRISK_PRODUCT_MATCHERS: Record<string, string[]> = {
  consulta_cliente: ['consulta-cliente', 'consulta cliente'],
  armazens: ['armazem', 'armazens', 'armazéns', 'warehouse', 'conab', 'silo'],
  imoveis_simples: ['pesquisa-imoveis', 'imoveis rurais - simples', 'rural simples'],
  imoveis_car: ['car', 'cadastro ambiental rural', 'imoveis rurais - car'],
  patrimonio_veicular: ['vehicle-assets', 'veicular', 'patrimonio veicular'],
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLabel(id: ConsultaTypeId): string {
  for (const g of [...CONSULTA_GROUPS, SMART_GROUP]) {
    const found = g.items.find(i => i.id === id);
    if (found) return found.label;
  }
  return id;
}

function getPlatform(id: ConsultaTypeId): string {
  if (id.startsWith('serasa')) return 'serasa';
  if (id === 'scr') return 'scr';
  if (id === 'smart_cedente') return 'smart';
  return 'agrisk';
}

const CONSULTA_TIMEOUT_MS = 45000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} demorou demais para responder. Tente novamente.`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function runSingleConsulta(cnpj: string, id: ConsultaTypeId): Promise<Record<string, unknown>> {
  const getFunctionErrorMessage = (error: any, data: any, fallback: string) => {
    return data?.error || data?.message || error?.context?.error || error?.message || fallback;
  };

  if (id === 'smart_cedente') {
    // 1) Tenta como cedente
    const cedRes = await supabase.functions.invoke('external-db', {
      body: { action: 'cedente-info', filters: { cpf_cnpj: cnpj } },
    });
    if (!cedRes.error && cedRes.data?.success && cedRes.data?.data) {
      const transformed = transformSmartCedenteData(cedRes.data.data) as Record<string, unknown>;
      return { ...transformed, _smartView: 'cedente' };
    }

    // 2) Fallback: tenta como sacado
    const sacRes = await supabase.functions.invoke('external-db', {
      body: { action: 'sacado-detail', filters: { cpf_cnpj: cnpj } },
    });
    if (sacRes.error) throw new Error(sacRes.error.message || 'Erro Smart');
    if (!sacRes.data?.success || !sacRes.data?.data) {
      throw new Error('CNPJ/CPF não localizado no Smart (nem como cedente, nem como sacado).');
    }
    const sacData = sacRes.data.data as Record<string, unknown>;
    const hasAny = (sacData?.resumo as any)?.qtd_aberto > 0
      || (sacData?.resumo as any)?.qtd_quitado > 0
      || ((sacData as any)?.titulosAberto?.length ?? 0) > 0
      || ((sacData as any)?.titulosQuitados?.length ?? 0) > 0;
    if (!hasAny) {
      throw new Error('CNPJ/CPF não localizado no Smart (nem como cedente, nem como sacado).');
    }
    return { ...sacData, _smartView: 'sacado' };
  }

  if (id === 'scr') {
    const { data, error } = await supabase.functions.invoke('hbi-scr', { body: { cnpj } });
    if (error) throw new Error(getFunctionErrorMessage(error, data, 'Erro SCR'));
    if (data?.ok === false || data?.error) throw new Error(getFunctionErrorMessage(error, data, 'Erro SCR'));
    return data?.data || data;
  }
  if (id.startsWith('serasa_')) {
    const { data, error } = await supabase.functions.invoke('serasa-report', { body: { document: cnpj, consultaId: id } });
    if (error) throw new Error(getFunctionErrorMessage(error, data, 'Erro Serasa'));
    if (data?.ok === false || data?.error) throw new Error(getFunctionErrorMessage(error, data, 'Erro Serasa'));
    return data?.data || data;
  }
  const { data, error } = await supabase.functions.invoke('agrisk-query', {
    body: { taxId: cnpj.replace(/\D/g, ''), consultaType: id },
  });
  if (error) throw new Error(getFunctionErrorMessage(error, data, 'Erro AgRisk'));
  if (data?.ok === false || data?.error) throw new Error(getFunctionErrorMessage(error, data, 'Erro AgRisk'));
  return data?.data || data;
}

function hasConsultaClienteDetails(data: Record<string, unknown>): boolean {
  if (!data || typeof data !== 'object') return false;

  // New format: { details: { compliance: {...}, bvs: {...}, lawsuits: {...}, ... }, hasRealData: true }
  if ('details' in data && typeof data.details === 'object') {
    return Object.values(data.details as Record<string, unknown>).some((v) => {
      if (!v) return false;
      const str = JSON.stringify(v);
      return str.length > 50;
    });
  }

  // Enriched format (flat): { compliance: {...}, bvs: {...}, lawsuits: {...}, ... }
  const KNOWN_DETAIL_KEYS = ['compliance', 'lawsuits', 'bvs', 'contacts', 'groups_family', 'groups_economic', 'bndes'];
  const hasKnownKeys = KNOWN_DETAIL_KEYS.some(k => k in data);
  if (hasKnownKeys) {
    return KNOWN_DETAIL_KEYS.some(k => {
      const v = data[k];
      if (!v) return false;
      const str = JSON.stringify(v);
      return str.length > 50;
    });
  }

  // Legacy format fallback
  return Object.values(data).some((raw) => {
    const items = Array.isArray(raw) ? raw : [raw];
    return items.some((item: any) => {
      const result = item?.result ?? item?.data;
      if (Array.isArray(result)) return result.length > 0;
      return !!(result && typeof result === 'object' && Object.keys(result).length > 0);
    });
  });
}

export function ConsultaModal({ cpfCnpj, clientName, open, onClose, onDone }: ConsultaModalProps) {
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<Set<ConsultaTypeId>>(new Set());
  const [phase, setPhase] = useState<'select' | 'executing'>('select');
  const [results, setResults] = useState<ConsultaResult[]>([]);
  const [agriskProducts, setAgriskProducts] = useState<AgriskProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const isCpf = cpfCnpj.length === 11;

  // Fetch AgRisk products with prices when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingProducts(true);
    supabase.functions.invoke('agrisk-query', {
      body: { action: 'list-products' },
    }).then(({ data }) => {
      const products = data?.data || [];
      setAgriskProducts(products);
    }).catch(() => {
      // Silently fail — prices just won't show
    }).finally(() => setLoadingProducts(false));
  }, [open]);

  // Get price for a frontend consulta ID
  const getPrice = (id: ConsultaTypeId): number | null => {
    // Non-AgRisk items don't have AgRisk pricing
    if (id.startsWith('serasa') || id === 'scr') return null;
    const product = agriskProducts.find((p) => {
      if (CODE_TO_FRONTEND_ID[p.code] === id) return true;

      const haystack = normalizeText(`${p.code || ''} ${p.name || ''}`);
      const matchers = AGRISK_PRODUCT_MATCHERS[id] || [];
      return matchers.some((matcher) => haystack.includes(normalizeText(matcher)));
    });
    if (product) return product.price;
    return null;
  };

  // Only show specific AgRisk items (adding gradually)
  const allowedAgriskItems = new Set([
    'consulta_cliente',
    'armazens',
    'imoveis_simples',
    'imoveis_car',
    'patrimonio_veicular',
  ]);

  const modalGroups = [...CONSULTA_GROUPS, SMART_GROUP];

  const filteredGroups = modalGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if ((item.id === 'serasa_basico_pf' || item.id === 'serasa_avancado_top_score_pf') && !isCpf) return false;
      if ((item.id === 'serasa_basico_pj' || item.id === 'serasa_avancado_pj') && isCpf) return false;
      if (group.provider === 'Agrisk' && !allowedAgriskItems.has(item.id)) return false;
      return true;
    }),
  })).filter(g => g.items.length > 0);

  const agriskGroup = filteredGroups.find((group) => group.provider === 'Agrisk');
  const nonAgriskGroups = filteredGroups.filter((group) => group.provider !== 'Agrisk');

  const toggle = (id: ConsultaTypeId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Calculate total credits
  const totalCredits = Array.from(selected).reduce((sum, id) => {
    const price = getPrice(id);
    return sum + (price || 0);
  }, 0);

  const executeAll = useCallback(async () => {
    const ids = Array.from(selected);
    setPhase('executing');
    setResults(ids.map(id => ({ id, status: 'running' })));

    const promises = ids.map(async (id) => {
      try {
        const data = await withTimeout(runSingleConsulta(cpfCnpj, id), CONSULTA_TIMEOUT_MS, getLabel(id));

        if (id === 'consulta_cliente' && !hasConsultaClienteDetails(data)) {
          throw new Error('A consulta retornou somente metadados (status) sem detalhamento útil.');
        }

        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'success' as const } : r));

        if (user) {
          const extractedName = clientName
            || (data as any)?.name
            || (data as any)?.data?.name
            || null;

          // Label dinâmico para Smart: Visão Cedente / Visão Sacado
          let dynamicLabel = getLabel(id);
          if (id === 'smart_cedente') {
            const view = (data as any)?._smartView;
            dynamicLabel = view === 'sacado' ? 'Visão Sacado' : 'Visão Cedente';
          }

          await supabase.from('consulta_history').insert({
            user_id: user.id,
            cnpj: cpfCnpj,
            platform: getPlatform(id),
            consulta_type: id,
            consulta_label: dynamicLabel,
            result_data: data as any,
            status: 'success',
            entity_name: extractedName,
            consulted_by_name: profile?.name || user.email || null,
          } as any);

          // After consulta_cliente, update basic_data with fresh clientData & contacts
          if (id === 'consulta_cliente') {
            const details = (data as any)?.details || data;
            const freshClientData = details?.clientData;
            const freshContacts = details?.contacts;
            if (freshClientData || freshContacts) {
              const { data: currentClient } = await supabase
                .from('consulta_clients')
                .select('basic_data')
                .eq('cpf_cnpj', cpfCnpj)
                .maybeSingle();

              const currentBd = (currentClient?.basic_data as Record<string, unknown>) || {};
              const updatedBd = {
                ...currentBd,
                ...(freshClientData ? { clientData: freshClientData } : {}),
                ...(freshContacts ? { contacts: freshContacts } : {}),
              };

              await supabase
                .from('consulta_clients')
                .update({ basic_data: updatedBd as any })
                .eq('cpf_cnpj', cpfCnpj);
            }
          }
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
    if (phase === 'executing' && !allDone) return;
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
              {loadingProducts && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando preços...
                </div>
              )}
              {agriskGroup && (
                <div className="space-y-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                    {agriskGroup.provider}
                  </span>
                  {AGRISK_TOPIC_GROUPS.map((topicGroup) => {
                    const items = topicGroup.items
                      .map((id) => agriskGroup.items.find((item) => item.id === id))
                      .filter(Boolean) as typeof agriskGroup.items;

                    if (items.length === 0) return null;

                    return (
                      <div key={topicGroup.title} className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">{topicGroup.title}</p>
                        <div className="grid gap-1.5">
                          {items.map((ct) => {
                            const price = getPrice(ct.id);
                            const isFree = price === 0;
                            return (
                              <div
                                key={ct.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggle(ct.id)}
                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(ct.id); } }}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                                  selected.has(ct.id)
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/30'
                                }`}
                              >
                                <Checkbox checked={selected.has(ct.id)} onCheckedChange={() => toggle(ct.id)} onClick={(e) => e.stopPropagation()} />
                                <span className="text-sm text-foreground flex-1">{ct.label}</span>
                                {price !== null && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] gap-1 shrink-0 ${
                                      isFree
                                        ? 'border-green-500/30 text-green-600 bg-green-500/5'
                                        : 'border-amber-500/30 text-amber-600 bg-amber-500/5'
                                    }`}
                                  >
                                    <Coins className="h-3 w-3" />
                                    {isFree ? 'Grátis' : `${price} créd.`}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {nonAgriskGroups.map(group => (
                <div key={group.provider} className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                    {group.provider}
                  </span>
                  <div className="grid gap-1.5">
                    {group.items.map(ct => {
                      const price = getPrice(ct.id);
                      const isFree = price === 0;
                      return (
                        <div
                          key={ct.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(ct.id)}
                          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(ct.id); } }}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors select-none ${
                            selected.has(ct.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <Checkbox checked={selected.has(ct.id)} onCheckedChange={() => toggle(ct.id)} onClick={(e) => e.stopPropagation()} />
                          <span className="text-sm text-foreground flex-1">{ct.label}</span>
                          {price !== null && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] gap-1 shrink-0 ${
                                isFree
                                  ? 'border-green-500/30 text-green-600 bg-green-500/5'
                                  : 'border-amber-500/30 text-amber-600 bg-amber-500/5'
                              }`}
                            >
                              <Coins className="h-3 w-3" />
                              {isFree ? 'Grátis' : `${price} créd.`}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
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

        <div className="flex items-center justify-between pt-2 border-t border-border">
          {phase === 'select' && totalCredits > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <Coins className="h-3.5 w-3.5" />
              <span className="font-medium">{totalCredits} crédito(s)</span>
            </div>
          )}
          {phase === 'select' && totalCredits === 0 && <div />}
          <div className="flex gap-2 ml-auto">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
