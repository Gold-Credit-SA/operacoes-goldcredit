import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Scale, Leaf,
  Building2, FileText, Users, Database, ChevronDown, ChevronRight,
  Ban
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Category definitions ───
const CATEGORIES: { key: string; label: string; icon: any; keys: string[] }[] = [
  { key: 'dados_basicos', label: 'Cadastro', icon: Database, keys: ['dados-basicos', 'emails', 'telefones', 'enderecos'] },
  { key: 'sintegra', label: 'Sintegras', icon: Building2, keys: [
    'sintegra-ac','sintegra-al','sintegra-am','sintegra-ba','sintegra-df','sintegra-es',
    'sintegra-mg','sintegra-ms','sintegra-pa','sintegra-pb','sintegra-pe','sintegra-rj',
    'sintegra-ro','sintegra-rr','sintegra-rs','sintegra-se','sintegra-sp','sintegra-to',
  ]},
  { key: 'grupos', label: 'Grupos', icon: Users, keys: ['grupo-familiar', 'grupo-economico'] },
  { key: 'compliance', label: 'Compliance', icon: Shield, keys: ['kyc', 'antecedentes', 'mandados', 'trabalho-escravo'] },
  { key: 'juridico', label: 'Judicial', icon: Scale, keys: ['processos-base', 'tst', 'protestos'] },
  { key: 'ambiental', label: 'Ambiental', icon: Leaf, keys: [
    'ibama-cnd','ibama-embargos','ibama-autuacoes','ibama-regularidade',
    'icmbio-embargos','icmbio-infracao','sema','check-bioma','amazonia-protege',
  ]},
  { key: 'cnds', label: 'CNDs Estaduais', icon: FileText, keys: [
    'cnd-am','cnd-ap','cnd-ba','cnd-go','cnd-ms','cnd-pa','cnd-rn','cnd-ro','cnd-sc','cnd-sp','cnd-to',
  ]},
];

const METADATA_KEYS = new Set([
  'queryId','status','createdAt','completedAt','requestedBy','taxId',
  '_id','id','message','updatedAt','productId','clientId','type',
]);

// ─── Helpers ───
function subLabel(key: string): string {
  const map: Record<string, string> = {
    'grupo-familiar': 'Familiar', 'grupo-economico': 'Econômico',
    'processos-base': 'Processos', 'tst': 'TST', 'protestos': 'Protestos',
    'kyc': 'KYC', 'antecedentes': 'Antecedentes', 'mandados': 'Mandados',
    'trabalho-escravo': 'Trabalho Escravo',
    'ibama-cnd': 'IBAMA CND', 'ibama-embargos': 'IBAMA Embargos',
    'ibama-autuacoes': 'IBAMA Autuações', 'ibama-regularidade': 'IBAMA Regularidade',
    'icmbio-embargos': 'ICMBIO Embargos', 'icmbio-infracao': 'ICMBIO Infração',
    'sema': 'SEMA', 'check-bioma': 'Check Bioma', 'amazonia-protege': 'Amazônia Protege',
    'dados-basicos': 'Dados Básicos', 'emails': 'E-mails', 'telefones': 'Telefones', 'enderecos': 'Endereços',
  };
  if (map[key]) return map[key];
  // sintegra-XX / cnd-XX → UF uppercase
  const m = key.match(/^(sintegra|cnd)-(\w+)$/);
  if (m) return m[2].toUpperCase();
  return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function normalizeStatus(status: string | undefined): string {
  const s = (status || '').toUpperCase().trim();
  if (['FILA','PENDING','PROCESSING','QUEUED'].includes(s)) return 'FILA';
  if (['DONE','SUCCESS','COMPLETED','OK','FINALIZADO'].includes(s)) return 'DONE';
  if (['ERROR','FAILED','ERRO'].includes(s)) return 'ERROR';
  if (['NOT_FOUND','EMPTY'].includes(s)) return 'NOT_FOUND';
  return s;
}

function statusIcon(s: string) {
  const n = normalizeStatus(s);
  if (n === 'DONE') return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (n === 'FILA') return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
  if (n === 'ERROR') return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function statusLabel(s: string) {
  const n = normalizeStatus(s);
  if (n === 'DONE') return 'FINALIZADO';
  if (n === 'FILA') return 'EM FILA';
  if (n === 'ERROR') return 'ERRO';
  return s?.toUpperCase() || '—';
}

function formatFieldLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
}

function formatDate(val: string): string {
  try { return format(new Date(val), 'dd/MM/yyyy HH:mm'); } catch { return val; }
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

function getPayload(raw: any): any {
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item || typeof item !== 'object') return null;
  // The enriched data has result field with actual data
  const result = item.result || item.data;
  if (result && typeof result === 'object') return result;
  // Fallback: filter out metadata from the item itself
  const filtered = Object.fromEntries(
    Object.entries(item).filter(([k]) => !METADATA_KEYS.has(k))
  );
  return Object.keys(filtered).length > 0 ? filtered : null;
}

function getPayloadEntries(payload: any): [string, unknown][] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return [];
  return Object.entries(payload).filter(([k]) => !METADATA_KEYS.has(k));
}

function getPayloadArray(payload: any): any[] | null {
  if (Array.isArray(payload) && payload.length > 0) return payload;
  return null;
}

// ─── Specialized renderers for each category ───

function SintegraContent({ items }: { items: SubItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Sintegra</h2>
      <p className="text-sm text-muted-foreground mb-4">Consulta de Inscrição Estadual por UF</p>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/30">
            {statusIcon(item.status)}
            <span className="text-sm font-medium text-foreground min-w-[40px]">{subLabel(item.key)}</span>
            <span className="text-xs text-muted-foreground ml-1">- {statusLabel(item.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GruposContent({ items }: { items: SubItem[] }) {
  const familiar = items.find(i => i.key === 'grupo-familiar');
  const economico = items.find(i => i.key === 'grupo-economico');

  const renderGrupo = (item: SubItem | undefined, title: string, emptyMsg: string) => {
    if (!item) return null;
    const payload = getPayload(item.data);
    const arr = payload ? (getPayloadArray(payload) || (payload.members || payload.membros || payload.results)) : null;
    const members = Array.isArray(arr) ? arr : [];

    return (
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ban className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <p className="text-base font-semibold text-foreground mb-1">Sem {title}</p>
              <p className="text-sm text-muted-foreground">{emptyMsg}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m: any, idx: number) => {
                const name = m.name || m.nome || m.razaoSocial || '—';
                const doc = m.taxId || m.cpf || m.cnpj || m.documento || '';
                const rel = m.relationship || m.parentesco || m.relacao || m.tipo || '';
                return (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-foreground uppercase">{name}</p>
                      {doc && <p className="text-xs text-muted-foreground">{doc}</p>}
                    </div>
                    {rel && <Badge variant="outline" className="text-xs">{rel.toUpperCase()}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Grupos</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderGrupo(familiar, 'Familiar', 'Não foram identificados familiares no CPF deste cliente.')}
        {renderGrupo(economico, 'Econômico', 'Não foram identificadas empresas em nome deste cliente.')}
      </div>
    </div>
  );
}

function ProcessosContent({ items }: { items: SubItem[] }) {
  const processos = items.find(i => i.key === 'processos-base');
  const payload = processos ? getPayload(processos.data) : null;
  const arr = payload ? (getPayloadArray(payload) || payload.processos || payload.results || []) : [];
  const list = Array.isArray(arr) ? arr : [];

  // Count stats
  const total = list.length;
  const ativos = list.filter((p: any) => (p.polo || '').toUpperCase() === 'ATIVO').length;
  const passivos = total - ativos;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Processos Judiciais</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Processos</p>
          <p className="text-2xl font-bold text-foreground">{total}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Ativo</p>
          <p className="text-2xl font-bold text-foreground">{ativos}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Passivo</p>
          <p className="text-2xl font-bold text-foreground">{passivos}</p>
        </CardContent></Card>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Ban className="h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">Sem Processos</p>
          <p className="text-sm text-muted-foreground">Nenhum processo judicial encontrado.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tribunal</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Polo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Assunto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.slice(0, 50).map((p: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{p.tribunal || p.court || '—'}</TableCell>
                      <TableCell className="text-xs">{p.uf || p.state || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{p.numero || p.number || p.cnj || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {(p.polo || p.role || '—').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.status || '—'}</TableCell>
                      <TableCell className="text-xs">{p.valor || p.value || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{p.assunto || p.subject || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other sub-items (TST, Protestos) */}
      {items.filter(i => i.key !== 'processos-base').map(item => (
        <div key={item.key} className="mt-4">
          <GenericSubContent item={item} />
        </div>
      ))}
    </div>
  );
}

function GenericSubContent({ item }: { item: SubItem }) {
  const payload = getPayload(item.data);
  const entries = getPayloadEntries(payload);
  const arr = payload ? getPayloadArray(payload) : null;

  if (normalizeStatus(item.status) !== 'DONE') {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-3">
          {statusIcon(item.status)}
          <span className="text-sm text-muted-foreground">{subLabel(item.key)} — {statusLabel(item.status)}</span>
        </CardContent>
      </Card>
    );
  }

  if (arr && arr.length > 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{subLabel(item.key)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(arr[0]).filter(k => !METADATA_KEYS.has(k)).slice(0, 6).map(k => (
                    <TableHead key={k} className="text-xs">{formatFieldLabel(k)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {arr.slice(0, 30).map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    {Object.keys(arr[0]).filter(k => !METADATA_KEYS.has(k)).slice(0, 6).map(k => (
                      <TableCell key={k} className="text-xs">{renderValue(row[k])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Ban className="h-12 w-12 text-muted-foreground/20 mb-3" />
        <p className="text-base font-semibold text-foreground mb-1">Sem dados</p>
        <p className="text-sm text-muted-foreground">Nenhum registro encontrado para {subLabel(item.key)}.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{subLabel(item.key)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex gap-3 text-sm">
              <span className="text-muted-foreground min-w-[140px] shrink-0">{formatFieldLabel(key)}</span>
              <span className="text-foreground break-all whitespace-pre-wrap">{renderValue(val)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DefaultCategoryContent({ cat, items }: { cat: typeof CATEGORIES[0]; items: SubItem[] }) {
  if (cat.key === 'sintegra') return <SintegraContent items={items} />;
  if (cat.key === 'cnds') {
    return (
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">CNDs Estaduais</h2>
        <p className="text-sm text-muted-foreground mb-4">Certidões Negativas de Débitos Estaduais</p>
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.key} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/30">
              {statusIcon(item.status)}
              <span className="text-sm font-medium text-foreground min-w-[40px]">{subLabel(item.key)}</span>
              <span className="text-xs text-muted-foreground ml-1">- {statusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For categories with multiple sub-items, show each one
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">{cat.label}</h2>
      <div className="space-y-4">
        {items.map(item => (
          <GenericSubContent key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Types ───
interface SubItem {
  key: string;
  data: any;
  status: string;
  completedAt?: string;
}

interface Props {
  data: Record<string, any>;
}

// ─── Main component ───
export function ConsultaClienteDetailView({ data }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Build categorized data
  const categorizedData = CATEGORIES.map(cat => {
    const items: SubItem[] = cat.keys
      .filter(k => data[k] !== undefined)
      .map(k => {
        const raw = data[k];
        const item = Array.isArray(raw) ? raw[0] : raw;
        return { key: k, data: raw, status: item?.status || '', completedAt: item?.completedAt };
      });
    return { ...cat, items };
  }).filter(cat => cat.items.length > 0);

  // Uncategorized
  const categorizedKeys = new Set(CATEGORIES.flatMap(c => c.keys));
  const uncategorized = Object.keys(data)
    .filter(k => !categorizedKeys.has(k) && !METADATA_KEYS.has(k))
    .map(k => {
      const raw = data[k];
      const item = Array.isArray(raw) ? raw[0] : raw;
      return { key: k, data: raw, status: item?.status || '', completedAt: item?.completedAt };
    });

  if (uncategorized.length > 0) {
    categorizedData.push({
      key: 'outros', label: 'Outros', icon: FileText, keys: uncategorized.map(u => u.key), items: uncategorized,
    });
  }

  // Auto-select first category
  const selectedKey = activeCategory || (categorizedData[0]?.key || null);
  const selectedCat = categorizedData.find(c => c.key === selectedKey);

  // Stats
  const allItems = categorizedData.flatMap(c => c.items);
  const totalDone = allItems.filter(i => normalizeStatus(i.status) === 'DONE').length;
  const totalFila = allItems.filter(i => normalizeStatus(i.status) === 'FILA').length;
  const totalError = allItems.filter(i => normalizeStatus(i.status) === 'ERROR').length;

  return (
    <div className="flex gap-0 min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-[200px] shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Consultas</p>
          <div className="flex items-center gap-1.5 mt-1">
            {totalDone > 0 && (
              <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> {totalDone}
              </span>
            )}
            {totalFila > 0 && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {totalFila}
              </span>
            )}
            {totalError > 0 && (
              <span className="text-[10px] text-destructive flex items-center gap-0.5">
                <XCircle className="h-3 w-3" /> {totalError}
              </span>
            )}
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          <nav className="py-1">
            {categorizedData.map(cat => {
              const Icon = cat.icon;
              const isActive = cat.key === selectedKey;
              const catDone = cat.items.filter(i => normalizeStatus(i.status) === 'DONE').length;
              const catTotal = cat.items.length;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{cat.label}</span>
                  <span className="text-[10px] tabular-nums">{catDone}/{catTotal}</span>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        {selectedCat ? (
          selectedCat.key === 'grupos' ? (
            <GruposContent items={selectedCat.items} />
          ) : selectedCat.key === 'juridico' ? (
            <ProcessosContent items={selectedCat.items} />
          ) : (
            <DefaultCategoryContent cat={selectedCat} items={selectedCat.items} />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Selecione uma categoria na barra lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
}
