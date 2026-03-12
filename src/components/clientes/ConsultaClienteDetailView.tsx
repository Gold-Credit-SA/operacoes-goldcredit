import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight, AlertTriangle, Shield, Scale, Leaf, Building2, FileText, Users, MapPin, Phone, Mail, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

function formatSubQueryLabel(key: string): string {
  return key
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getStatusInfo(status: string) {
  const s = status?.toUpperCase?.() || '';
  if (s === 'FILA' || s === 'PENDING' || s === 'PROCESSING' || s === 'QUEUED') {
    return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Em fila' };
  }
  if (s === 'DONE' || s === 'SUCCESS' || s === 'COMPLETED' || s === 'OK') {
    return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-500/10', label: 'Concluído' };
  }
  if (s === 'ERROR' || s === 'FAILED') {
    return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Erro' };
  }
  if (s === 'NOT_FOUND' || s === 'EMPTY') {
    return { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Sem dados' };
  }
  return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: status || 'Desconhecido' };
}

function renderResultContent(data: any): React.ReactNode {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  // If it's an array of items with only status/queryId (no real results yet), skip
  if (Array.isArray(data) && data.length === 1 && data[0].status && !data[0].result && !data[0].data) {
    return null;
  }

  // Try to find actual result data
  const resultData = Array.isArray(data) ? data[0]?.result || data[0]?.data || data[0] : data?.result || data?.data || data;

  if (!resultData || typeof resultData !== 'object') return null;

  // Filter out metadata keys
  const displayKeys = Object.entries(resultData).filter(
    ([k]) => !['queryId', 'status', 'createdAt', 'requestedBy', 'taxId', '_id', 'id'].includes(k)
  );

  if (displayKeys.length === 0) return null;

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-md">
      {displayKeys.map(([key, val]) => (
        <div key={key} className="flex items-start gap-2 py-1">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider min-w-[100px] shrink-0 pt-0.5">
            {formatSubQueryLabel(key)}
          </span>
          <span className="text-xs text-foreground break-all">
            {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  data: Record<string, any>;
}

export function ConsultaClienteDetailView({ data }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['dados_basicos', 'compliance', 'juridico']));

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Categorize the data keys
  const categorizedData = CATEGORIES.map(cat => {
    const items = cat.keys
      .filter(k => data[k] !== undefined)
      .map(k => ({
        key: k,
        label: formatSubQueryLabel(k),
        data: data[k],
        status: Array.isArray(data[k]) ? data[k][0]?.status : data[k]?.status,
      }));
    return { ...cat, items };
  }).filter(cat => cat.items.length > 0);

  // Find uncategorized keys
  const categorizedKeys = new Set(CATEGORIES.flatMap(c => c.keys));
  const uncategorized = Object.keys(data)
    .filter(k => !categorizedKeys.has(k) && !['queryId', 'status', 'createdAt', 'requestedBy', 'taxId', '_id', 'id', 'message'].includes(k))
    .map(k => ({
      key: k,
      label: formatSubQueryLabel(k),
      data: data[k],
      status: Array.isArray(data[k]) ? data[k][0]?.status : data[k]?.status,
    }));

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
  const totalDone = allItems.filter(i => {
    const s = i.status?.toUpperCase?.() || '';
    return s === 'DONE' || s === 'SUCCESS' || s === 'COMPLETED' || s === 'OK';
  }).length;
  const totalFila = allItems.filter(i => {
    const s = i.status?.toUpperCase?.() || '';
    return s === 'FILA' || s === 'PENDING' || s === 'PROCESSING';
  }).length;
  const totalError = allItems.filter(i => {
    const s = i.status?.toUpperCase?.() || '';
    return s === 'ERROR' || s === 'FAILED';
  }).length;

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
            <CheckCircle2 className="h-3 w-3" /> {totalDone} concluídas
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
        const catDone = cat.items.filter(i => ['DONE', 'SUCCESS', 'COMPLETED', 'OK'].includes(i.status?.toUpperCase?.() || '')).length;
        const catFila = cat.items.filter(i => ['FILA', 'PENDING', 'PROCESSING'].includes(i.status?.toUpperCase?.() || '')).length;

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
                      {cat.items.length} itens
                      {catDone > 0 && <span className="text-green-600 ml-2">✓ {catDone}</span>}
                      {catFila > 0 && <span className="text-amber-500 ml-2">⏳ {catFila}</span>}
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
                      const content = renderResultContent(item.data);

                      return (
                        <div key={item.key}>
                          <div className="flex items-center gap-2.5 py-2 px-2 rounded hover:bg-muted/30">
                            <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusInfo.color}`} />
                            <span className="text-xs text-foreground flex-1">{item.label}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusInfo.bg} ${statusInfo.color} border-transparent`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          {content}
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
