import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, AlertTriangle, Shield, Scale, Leaf, Building2, FileText, Users, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

// Category definitions for consulta_cliente sub-queries
const CATEGORIES: { key: string; label: string; icon: any; keys: string[] }[] = [
  {
    key: 'dados_basicos',
    label: 'Dados Básicos & Contatos',
    icon: Database,
    keys: ['dados-basicos', 'emails', 'telefones', 'enderecos'],
  },
  {
    key: 'grupos',
    label: 'Grupos',
    icon: Users,
    keys: ['grupo-familiar', 'grupo-economico'],
  },
  {
    key: 'compliance',
    label: 'Compliance & KYC',
    icon: Shield,
    keys: ['kyc', 'antecedentes', 'mandados', 'trabalho-escravo'],
  },
  {
    key: 'juridico',
    label: 'Jurídico',
    icon: Scale,
    keys: ['processos-base', 'tst', 'protestos'],
  },
  {
    key: 'ambiental',
    label: 'Ambiental',
    icon: Leaf,
    keys: ['ibama-cnd', 'ibama-embargos', 'ibama-autuacoes', 'ibama-regularidade', 'icmbio-embargos', 'icmbio-infracao', 'sema', 'check-bioma', 'amazonia-protege'],
  },
  {
    key: 'cnds',
    label: 'CNDs Estaduais',
    icon: FileText,
    keys: ['cnd-am', 'cnd-ap', 'cnd-ba', 'cnd-go', 'cnd-ms', 'cnd-pa', 'cnd-rn', 'cnd-ro', 'cnd-sc', 'cnd-sp', 'cnd-to'],
  },
  {
    key: 'sintegra',
    label: 'Sintegra',
    icon: Building2,
    keys: [
      'sintegra-ac', 'sintegra-al', 'sintegra-am', 'sintegra-ba', 'sintegra-df',
      'sintegra-es', 'sintegra-mg', 'sintegra-ms', 'sintegra-pa', 'sintegra-pb',
      'sintegra-pe', 'sintegra-rj', 'sintegra-ro', 'sintegra-rr', 'sintegra-rs',
      'sintegra-se', 'sintegra-sp', 'sintegra-to',
    ],
  },
];

const METADATA_KEYS = new Set([
  'queryId', 'status', 'createdAt', 'completedAt', 'requestedBy', 'taxId',
  '_id', 'id', 'message', 'updatedAt', 'productId', 'clientId', 'type',
]);

function formatSubQueryLabel(key: string): string {
  return key
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function normalizeStatus(status: string | undefined): string {
  const s = (status || '').toUpperCase().trim();
  if (['FILA', 'PENDING', 'PROCESSING', 'QUEUED'].includes(s)) return 'FILA';
  if (['DONE', 'SUCCESS', 'COMPLETED', 'OK', 'FINALIZADO'].includes(s)) return 'DONE';
  if (['ERROR', 'FAILED', 'ERRO'].includes(s)) return 'ERROR';
  if (['NOT_FOUND', 'EMPTY'].includes(s)) return 'NOT_FOUND';
  return s;
}

function getStatusInfo(rawStatus: string | undefined) {
  const s = normalizeStatus(rawStatus);
  if (s === 'FILA') {
    return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Em fila' };
  }
  if (s === 'DONE') {
    return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-500/10', label: 'Finalizado' };
  }
  if (s === 'ERROR') {
    return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Erro' };
  }
  if (s === 'NOT_FOUND') {
    return { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Sem dados' };
  }
  return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: rawStatus || '—' };
}

function formatDate(val: string): string {
  try {
    return format(new Date(val), 'dd/MM/yyyy HH:mm');
  } catch {
    return val;
  }
}

function isDateString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'string' && isDateString(val)) return formatDate(val);
  if (typeof val === 'object') {
    if (Array.isArray(val) && val.length === 0) return 'Nenhum registro';
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

function renderResultContent(data: any): React.ReactNode {
  if (!data) return null;

  // Unwrap arrays
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== 'object') return null;

  // Get result payload - could be nested under result/data
  const payload = raw.result || raw.data || raw;
  if (!payload || typeof payload !== 'object') return null;

  // Filter out metadata
  const entries = Object.entries(payload).filter(([k]) => !METADATA_KEYS.has(k));
  if (entries.length === 0) return null;

  // Check if it's an array of records (e.g. list of processes)
  const isArrayPayload = Array.isArray(payload);
  if (isArrayPayload && payload.length === 0) return null;

  if (isArrayPayload) {
    return (
      <div className="mt-2 space-y-2 pl-6">
        {payload.slice(0, 20).map((item: any, idx: number) => {
          const itemEntries = Object.entries(item).filter(([k]) => !METADATA_KEYS.has(k));
          return (
            <div key={idx} className="p-2.5 bg-muted/40 rounded-md border border-border/50 text-xs space-y-1">
              {itemEntries.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground min-w-[120px] shrink-0">{formatFieldLabel(k)}:</span>
                  <span className="text-foreground break-all whitespace-pre-wrap">{renderValue(v)}</span>
                </div>
              ))}
            </div>
          );
        })}
        {payload.length > 20 && (
          <p className="text-xs text-muted-foreground pl-2">+ {payload.length - 20} registros adicionais</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-muted/40 rounded-md border border-border/50 ml-6 space-y-1">
      {entries.map(([key, val]) => (
        <div key={key} className="flex gap-2 text-xs">
          <span className="text-muted-foreground min-w-[120px] shrink-0">{formatFieldLabel(key)}:</span>
          <span className="text-foreground break-all whitespace-pre-wrap">{renderValue(val)}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  data: Record<string, any>;
}

export function ConsultaClienteDetailView({ data }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Categorize the data keys
  const categorizedData = CATEGORIES.map(cat => {
    const items = cat.keys
      .filter(k => data[k] !== undefined)
      .map(k => {
        const raw = data[k];
        const item = Array.isArray(raw) ? raw[0] : raw;
        return {
          key: k,
          label: formatSubQueryLabel(k),
          data: raw,
          status: item?.status,
          completedAt: item?.completedAt,
        };
      });
    return { ...cat, items };
  }).filter(cat => cat.items.length > 0);

  // Find uncategorized keys
  const categorizedKeys = new Set(CATEGORIES.flatMap(c => c.keys));
  const uncategorized = Object.keys(data)
    .filter(k => !categorizedKeys.has(k) && !METADATA_KEYS.has(k))
    .map(k => {
      const raw = data[k];
      const item = Array.isArray(raw) ? raw[0] : raw;
      return {
        key: k,
        label: formatSubQueryLabel(k),
        data: raw,
        status: item?.status,
        completedAt: item?.completedAt,
      };
    });

  if (uncategorized.length > 0) {
    categorizedData.push({
      key: 'outros',
      label: 'Outros',
      icon: FileText,
      keys: uncategorized.map(u => u.key),
      items: uncategorized,
    });
  }

  // Count totals
  const allItems = categorizedData.flatMap(c => c.items);
  const totalDone = allItems.filter(i => normalizeStatus(i.status) === 'DONE').length;
  const totalFila = allItems.filter(i => normalizeStatus(i.status) === 'FILA').length;
  const totalError = allItems.filter(i => normalizeStatus(i.status) === 'ERROR').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-foreground">{allItems.length}</span>
          <span className="text-muted-foreground">sub-consultas</span>
        </div>
        {totalDone > 0 && (
          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 bg-green-500/5 gap-1">
            <CheckCircle2 className="h-3 w-3" /> {totalDone} finalizadas
          </Badge>
        )}
        {totalFila > 0 && (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5 gap-1">
            <Clock className="h-3 w-3" /> {totalFila} em fila
          </Badge>
        )}
        {totalError > 0 && (
          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/5 gap-1">
            <XCircle className="h-3 w-3" /> {totalError} erros
          </Badge>
        )}
      </div>

      {/* Categories */}
      {categorizedData.map(cat => {
        const Icon = cat.icon;
        const isOpen = openCategories.has(cat.key);
        const catDone = cat.items.filter(i => normalizeStatus(i.status) === 'DONE').length;
        const catFila = cat.items.filter(i => normalizeStatus(i.status) === 'FILA').length;

        return (
          <Collapsible key={cat.key} open={isOpen} onOpenChange={() => toggleCategory(cat.key)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Icon className="h-4 w-4 text-primary" />
                    {cat.label}
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                      {cat.items.length} {cat.items.length === 1 ? 'item' : 'itens'}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {cat.items.map(item => {
                      const statusInfo = getStatusInfo(item.status);
                      const StatusIcon = statusInfo.icon;
                      const isExpanded = expandedItems.has(item.key);
                      const hasContent = normalizeStatus(item.status) === 'DONE';

                      return (
                        <div key={item.key}>
                          <div
                            className={`flex items-center gap-2.5 py-2 px-2 rounded transition-colors ${hasContent ? 'hover:bg-muted/30 cursor-pointer' : ''}`}
                            onClick={() => hasContent && toggleItem(item.key)}
                          >
                            {hasContent && (
                              isExpanded
                                ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            {!hasContent && <span className="w-3" />}
                            <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusInfo.color}`} />
                            <span className="text-xs text-foreground flex-1">{item.label}</span>
                            {item.completedAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(item.completedAt)}
                              </span>
                            )}
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusInfo.bg} ${statusInfo.color} border-transparent`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          {isExpanded && renderResultContent(item.data)}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}