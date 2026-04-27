import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, Shield, Scale, Leaf,
  Users, Ban, ChevronUp, ChevronDown, Search, Briefcase, Eye, X, UserRound,
  Warehouse, Car, MapPinOff, MapPin, ExternalLink, Download, Check
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AgriskDetailView } from '@/components/agrisk/AgriskDetailView';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ─── Category definitions (removed BNDES, BVS, Contatos, CNDs) ───
const CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: 'compliance', label: 'Compliance', icon: Shield },
  { key: 'juridico', label: 'Processos Judiciais', icon: Scale },
  { key: 'imoveis', label: 'Imóveis', icon: Leaf },
  { key: 'grupos', label: 'Grupos', icon: Users },
];

// ─── Helpers ───
function formatDate(val: string): string {
  try { return format(new Date(val), 'dd/MM/yyyy'); } catch { return val; }
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatDocument(value?: string | null): string {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length === 14) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  return String(value);
}

function formatPhone(value: unknown): string {
  if (!value) return '—';
  let raw = String(value).replace(/\D/g, '');
  // Remove country code 55
  if (raw.startsWith('55') && raw.length > 11) raw = raw.slice(2);
  if (raw.length === 11) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  if (raw.length === 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  if (raw.length === 9) return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) {
      return formatDate(trimmed);
    }
    return trimmed;
  }
  return JSON.stringify(value);
}

function sanitizeUiText(value: string): string {
  const replacements: [string, string][] = [
    ['ÃƒÂ§', 'c'], ['ÃƒÂ£', 'a'], ['ÃƒÂ¡', 'a'], ['ÃƒÂª', 'e'],
    ['ÃƒÂ©', 'e'], ['ÃƒÂ­', 'i'], ['ÃƒÂ³', 'o'], ['ÃƒÂµ', 'o'],
    ['ÃƒÂº', 'u'], ['Ãƒâ€œ', 'O'], ['Ãƒ', ''],
    ['Ã§', 'c'], ['Ã£', 'a'], ['Ã¡', 'a'], ['Ã¢', 'a'],
    ['Ãª', 'e'], ['Ã©', 'e'], ['Ã­', 'i'], ['Ã³', 'o'],
    ['Ãµ', 'o'], ['Ãº', 'u'], ['Ã"', 'O'], ['Ãš', 'U'],
    ['â€"', '-'], ['Â·', '-'],
  ];
  let result = value;
  for (const [search, replace] of replacements) {
    result = result.split(search).join(replace);
  }
  return result;
}

function getLongText(value: Record<string, any>): string | null {
  const direct = value.Description || value.Content || value.Text || value.DecisionContent || value.Resume || value.Summary;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const longest = Object.values(value)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 30)
    .sort((a, b) => b.length - a.length)[0];

  return longest || null;
}

function getBestItemDate(value: Record<string, any>): string | null {
  const rawDate = value.Date || value.date || value.DecisionDate || value.PublicationDate || value.LastUpdate || value.LastMovementDate || value.createdAt || value.updatedAt;
  if (!rawDate || typeof rawDate !== 'string') return null;
  return formatDate(rawDate);
}

function isProcessDetailLoaded(process: Record<string, any>): boolean {
  return Boolean(process.detailLoaded);
}

// ─── Transform API data ───
interface SubItem {
  key: string;
  label: string;
  data: any;
  status: string;
}

function detectAgriskConsultaType(rawData: Record<string, any>, consultaType?: string | null): string | null {
  if (consultaType) return consultaType;

  const productCode = typeof rawData?.product?.code === 'string' ? normalizeText(rawData.product.code) : '';
  if (productCode.includes('consulta-cliente')) return 'consulta_cliente';
  if (productCode.includes('credit-restrictive') || productCode.includes('restritivo')) return 'restritivos';
  if (productCode === 'scr' || productCode.includes('endividamento')) return 'endividamento';
  if (productCode === 'cpr') return 'cpr';
  if (productCode.includes('pesquisa-imoveis')) return 'imoveis_simples';
  if (productCode === 'car') return 'imoveis_car';
  if (productCode.includes('vehicle-assets') || productCode.includes('veicular')) return 'patrimonio_veicular';

  return null;
}

function normalizeResponseData(rawData: Record<string, any>, consultaType?: string | null): Record<string, SubItem[]> {
  const result: Record<string, SubItem[]> = {};
  const details = rawData?.details || rawData;
  if (!details || typeof details !== 'object') return result;
  const agriskType = detectAgriskConsultaType(rawData, consultaType);
  const isExpectedType = (expected: string, fallback: boolean) => (agriskType ? agriskType === expected : fallback);
  const hasConsultaClientePayload = isExpectedType(
    'consulta_cliente',
    Boolean(
      details.clientData ||
      details.contacts ||
      details.lawsuits ||
      details.compliance ||
      details.groups_family ||
      details.groups_economic ||
      details.sintegra,
    ),
  );

  // ── Sintegra ──
  if (hasConsultaClientePayload && details.sintegra) {
    result['sintegra'] = [{
      key: 'sintegra',
      label: 'Sintegra',
      status: 'DONE',
      data: details.sintegra,
    }];
  }
  if (!result['sintegra']) {
    result['sintegra'] = [
      { key: 'sintegra', label: 'Sintegra', status: 'NOT_CONSULTED', data: null },
    ];
  }

  // ── Grupos ──
  const grupoItems: SubItem[] = [];
  if (hasConsultaClientePayload && details.groups_family) {
    grupoItems.push({
      key: 'grupo-familiar', label: 'Grupo Familiar', status: 'DONE',
      data: details.groups_family?.items || [],
    });
  }
  if (hasConsultaClientePayload && details.groups_economic) {
    grupoItems.push({
      key: 'grupo-economico', label: 'Grupo Econômico', status: 'DONE',
      data: details.groups_economic?.items || [],
    });
  }
  if (grupoItems.length > 0) {
    result['grupos'] = grupoItems;
  }
  if (!result['grupos']) {
    result['grupos'] = [
      { key: 'grupo-familiar', label: 'Grupo Familiar', status: 'NOT_CONSULTED', data: null },
      { key: 'grupo-economico', label: 'Grupo Econômico', status: 'NOT_CONSULTED', data: null },
    ];
  }

  // ── Compliance (Ambiental + Trabalhista merged) ──
  const rawCompliance = hasConsultaClientePayload ? details.compliance : null;
  const compliance = rawCompliance
    ? (rawCompliance?.item || rawCompliance?.data || rawCompliance)
    : null;
  const complianceItems: SubItem[] = [];

  const envData = compliance?.environmental || compliance?.ambiental || compliance?.env;
  if (envData) {
    const ambientalEntries: any[] = [];

    if (envData.ibama) {
      const ibama = envData.ibama;
      ambientalEntries.push({
        title: 'IBAMA',
        items: [
          { label: 'EMBARGOS', value: ibama.embargos?.content?.length || 0, ok: (ibama.embargos?.content?.length || 0) === 0 },
          { label: 'AUTUAÇÕES', value: ibama.assessments?.content?.length || 0, ok: (ibama.assessments?.content?.length || 0) === 0 },
          { label: 'REGULARIDADE', value: ibama.ibamaCND?.content?.length === 0 ? 'Negativa' : 'Insuficiência', ok: ibama.ibamaCND?.content?.length === 0 },
          { label: 'DÉBITOS', value: 'Negativa', ok: true },
        ],
      });
    }

    if (envData.icmbio) {
      const icm = envData.icmbio;
      ambientalEntries.push({
        title: 'ICMBio',
        items: [
          { label: 'EMBARGOS', value: icm.embargos?.embargo ? 'Sim' : 0, ok: !icm.embargos?.embargo },
          { label: 'MULTAS', value: icm.multas?.content?.length || 0, ok: (icm.multas?.content?.length || 0) === 0 },
        ],
      });
    }

    if (envData.sema) {
      ambientalEntries.push({
        title: 'SEMA',
        items: [
          { label: 'EMBARGOS', value: envData.sema.semaResultsLenth || 0, ok: (envData.sema.semaResultsLenth || 0) === 0 },
        ],
      });
    }

    complianceItems.push({
      key: 'ambiental',
      label: 'Ambiental',
      status: 'DONE',
      data: ambientalEntries,
    });
  }

  if (compliance?.labour || compliance?.labor || compliance?.trabalhista || compliance?.criminal || compliance?.penal) {
    const l = compliance.labour || compliance.labor || compliance.trabalhista || {};
    const c = compliance.criminal || compliance.penal || {};
    const trabEntries: any[] = [];

    trabEntries.push({
      title: 'TST',
      items: [
        { label: 'RESULTADO', value: l.tst?.status === 'negativa' || !l.tst ? 'Negativa' : l.tst.status, ok: l.tst?.status === 'negativa' || !l.tst },
      ],
    });

    trabEntries.push({
      title: 'Trabalho Escravo',
      items: [
        { label: 'RESULTADO', value: l.IsSlaveLabour ? 'Listado' : 'Negativa', ok: !l.IsSlaveLabour },
      ],
    });

    if (c.criminalRecord) {
      trabEntries.push({
        title: 'Antecedentes Criminais',
        items: [
          { label: 'RESULTADO', value: c.criminalRecord.cleanRecord ? 'Nada consta' : 'Possui registro', ok: c.criminalRecord.cleanRecord },
        ],
      });
    }

    if (c.warrants) {
      trabEntries.push({
        title: 'Mandados de Prisão',
        items: [
          { label: 'RESULTADO', value: c.warrants.quant === 0 ? 'Nenhum' : `${c.warrants.quant} mandado(s)`, ok: c.warrants.quant === 0 },
        ],
      });
    }

    complianceItems.push({
      key: 'trabalhista',
      label: 'Trabalhista',
      status: 'DONE',
      data: trabEntries,
    });
  }

  if (complianceItems.length > 0) {
    result['compliance'] = complianceItems;
  }
  if (!result['compliance']) {
    result['compliance'] = [
      { key: 'ambiental', label: 'Ambiental', status: 'NOT_CONSULTED', data: null },
      { key: 'trabalhista', label: 'Trabalhista', status: 'NOT_CONSULTED', data: null },
    ];
  }

  // ── Judicial ──
  if (hasConsultaClientePayload && details.lawsuits) {
    result['juridico'] = [{
      key: 'lawsuits',
      label: 'Processos Judiciais',
      status: 'DONE',
      data: details.lawsuits,
    }];
  }
  if (!result['juridico']) {
    result['juridico'] = [
      { key: 'lawsuits', label: 'Processos Judiciais', status: 'NOT_CONSULTED', data: null },
    ];
  }

  // ── Armazéns ──
  const armazensData = details.armazens || details.warehouses || details.conab;
  result['armazens'] = [{
    key: 'armazens',
    label: 'Armazéns',
    status: armazensData ? 'DONE' : 'NOT_CONSULTED',
    data: armazensData || null,
  }];

  // ── Veicular ──
  // Aceita múltiplas formas: details.patrimonio_veicular, details.vehicleAssets, details.veicular,
  // details.vehicles, ou o próprio details/result com { items: [{plate,renavam,chassis,...}] }
  const veicularNested: any =
    (details as any).patrimonio_veicular ||
    (details as any).vehicleAssets ||
    (details as any).veicular ||
    (details as any).vehicles ||
    null;
  // Normaliza shapes aninhados { result: {items}, details: {items} }
  const unwrapVehicle = (val: any): any => {
    if (!val || typeof val !== 'object') return null;
    if (Array.isArray(val.items)) return val;
    if (val.details && Array.isArray(val.details.items)) return val.details;
    if (val.result && Array.isArray(val.result.items)) return val.result;
    return val;
  };
  const veicularUnwrapped = unwrapVehicle(veicularNested);
  const veicularItemsCandidate: any[] = Array.isArray(veicularUnwrapped?.items)
    ? veicularUnwrapped.items
    : (Array.isArray((details as any).items) ? (details as any).items : []);
  const looksLikeVehicle = veicularItemsCandidate.some((it: any) =>
    it && typeof it === 'object' && (
      'plate' in it || 'renavam' in it || 'chassis' in it || 'vehicle' in it || 'modelYear' in it
    ),
  );
  const veicularData =
    veicularUnwrapped ||
    (isExpectedType('patrimonio_veicular', looksLikeVehicle) ? details : null);
  result['veicular'] = [{
    key: 'veicular',
    label: 'Veicular',
    status: veicularData ? 'DONE' : 'NOT_CONSULTED',
    data: veicularData || null,
  }];

  // ── Imóveis Rurais ──
  result['imoveis'] = [
    {
      key: 'imoveis-simples',
      label: 'Simples',
      status: details.rural || details.urban || details.ruralDetails ? 'DONE' : 'NOT_CONSULTED',
      data: details.rural || details.urban || details.ruralDetails
        ? {
            rural: details.rural || null,
            urban: details.urban || null,
            ruralDetails: details.ruralDetails || [],
          }
        : null,
    },
  ];

  // ── CAR (Cadastro Ambiental Rural) — categoria própria ──
  result['car'] = [
    {
      key: 'imoveis-car',
      label: 'CAR',
      status: details.imoveis_car ? 'DONE' : 'NOT_CONSULTED',
      data: details.imoveis_car || null,
    },
  ];

  if (!result['grupos']) {
    result['grupos'] = [
      { key: 'grupo-familiar', label: 'Grupo Familiar', status: 'NOT_CONSULTED', data: null },
      { key: 'grupo-economico', label: 'Grupo Economico', status: 'NOT_CONSULTED', data: null },
    ];
  }

  return result;
}

// ─── Compliance Renderer (Ambiental + Trabalhista accordion style) ───
function ComplianceContent({ items }: { items: SubItem[] }) {
  const hasConsultedItems = items.some((section) => section.status === 'DONE' && Array.isArray(section.data) && section.data.length > 0);
  if (!hasConsultedItems) {
    return <EmptyState title="Compliance nao consultado" description="Esse topico nao foi consultado nesta execucao." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-2xl font-bold text-foreground">Compliance</h2>
        <Badge className="bg-primary/10 text-primary border-0 text-xs font-semibold">ESG</Badge>
      </div>

      {items.map(section => (
        <ComplianceSection key={section.key} section={section} />
      ))}
    </div>
  );
}

function ComplianceSection({ section }: { section: SubItem }) {
  const [open, setOpen] = useState(true);
  const entries = Array.isArray(section.data) ? section.data : [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <h3 className="text-base font-semibold text-foreground">{section.label}</h3>
            {open ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-5 px-5">
            <div className="space-y-6">
              {entries.map((entry: any, idx: number) => (
                <div key={idx}>
                  <h4 className="text-sm font-bold text-foreground mb-3">{entry.title}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {entry.items?.map((item: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className={cn("h-4 w-4", item.ok ? "text-green-500" : "text-amber-500")} />
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</span>
                        </div>
                        <p className={cn("text-sm font-medium ml-5.5", item.ok ? "text-green-600" : "text-destructive")}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Lawsuits Renderer (matches reference image 123) ───
function LawsuitsContent({ items, agriskClientId }: { items: SubItem[]; agriskClientId?: string | null }) {
  if (items[0]?.status !== 'DONE' || !items[0]?.data) {
    return <EmptyState title="Processos Judiciais nao consultado" description="Esse topico nao foi consultado nesta execucao." />;
  }

  const ls = items[0]?.data || {};
    const list: any[] = ls.items || ls.data?.items || ls.lawsuits || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);

  const activeCount = ls.active ?? ls.totalActive ?? ls.quantityActive ?? ls.activeCount ?? 0;
  const inactiveCount = ls.inactive ?? ls.totalInactive ?? ls.quantityInactive ?? ls.inactiveCount ?? 0;
  const indefiniteCount = ls.indefinite ?? ls.indeterminate ?? ls.totalIndeterminate ?? ls.indefiniteCount ?? 0;
  const total = activeCount + inactiveCount + indefiniteCount || list.length;
  const civil = ls.civil ?? ls.totalCivil ?? ls.quantityCivil ??
    list.filter((p: any) => (p.Nature || p.CourtType || p.Type || '').toLowerCase().includes('civ')).length;
  const criminal = ls.criminal ?? ls.totalCriminal ?? ls.quantityCriminal ??
    list.filter((p: any) => (p.Nature || p.CourtType || p.Type || '').toLowerCase().includes('crim')).length;
  const trabalhista = ls.labour ?? ls.labor ?? ls.totalLabour ?? ls.trabalhista ??
    list.filter((p: any) => (p.Nature || p.CourtType || p.Type || '').toLowerCase().includes('trab')).length;

  const filtered = list.filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (p.Number || '').toLowerCase().includes(s) ||
           (p.MainSubject || '').toLowerCase().includes(s) ||
           (p.CourtName || '').toLowerCase().includes(s);
  });

  function getNatureBadge(nature: string) {
    const n = nature.toLowerCase();
    const cls = n.includes('civel') || n.includes('civil') ? 'bg-blue-100 text-blue-700' :
      n.includes('criminal') ? 'bg-red-100 text-red-700' :
      n.includes('trabalh') ? 'bg-amber-100 text-amber-700' :
      n.includes('execu') ? 'bg-orange-100 text-orange-700' :
      'bg-muted text-muted-foreground';
    return <Badge className={cn("text-[10px] font-semibold border-0", cls)}>{nature.toUpperCase()}</Badge>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Processos Judiciais</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Processos</p>
            <p className="text-3xl font-bold text-foreground">{total}</p>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>Ativo <strong className="text-foreground">{activeCount}</strong></span>
              <span>Passivo <strong className="text-foreground">{(ls.defendant ?? ls.passive ?? 0)}</strong></span>
              <span>Outros <strong className="text-foreground">{indefiniteCount}</strong></span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
            <div className="flex gap-4 mt-2 text-xs">
              <div><p className="text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground">{activeCount}</p></div>
              <div><p className="text-muted-foreground">Finalizados</p><p className="text-lg font-bold text-foreground">{inactiveCount}</p></div>
              <div><p className="text-muted-foreground">Indefinidos</p><p className="text-lg font-bold text-foreground">{indefiniteCount}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Natureza</p>
            <div className="flex gap-4 mt-2 text-xs">
              <div><p className="text-muted-foreground">Civel</p><p className="text-lg font-bold text-foreground">{civil}</p></div>
              <div><p className="text-muted-foreground">Trabalhista</p><p className="text-lg font-bold text-foreground">{trabalhista}</p></div>
              <div><p className="text-muted-foreground">Criminal</p><p className="text-lg font-bold text-foreground">{criminal}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Procedimento</p>
            <div className="mt-2">
              <p className="text-muted-foreground text-xs">Execucao</p>
              <p className="text-lg font-bold text-primary">{list.filter((p: any) => (p.Nature || '').toLowerCase().includes('execu')).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Numero do processo"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} processo(s) encontrado(s)
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Sem Processos" description="Nenhum processo judicial encontrado." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any, idx: number) => {
            const polarity = p.Polarity || '—';
            const status = p.Status || '—';
            const nature = p.Nature || p.MainSubject?.split(' - ')[0] || '';
            const isActive = !(status === 'INATIVO' || status === 'BAIXADO');
            const movementCount = typeof p.QuantityMovements === 'number'
              ? p.QuantityMovements
              : Number(p.QuantityMovements || 0) || 0;

            return (
              <Card key={idx} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-medium text-foreground">{p.Number || '—'}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold",
                            polarity === 'Ativo' ? 'border-primary/40 text-primary bg-primary/5' : 'border-blue-500/30 text-blue-600 bg-blue-50'
                          )}
                        >
                          {polarity.toUpperCase()}
                        </Badge>
                        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                          {isActive ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                        {nature && getNatureBadge(nature)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{p.CourtName || '—'}</span>
                        {p.State && <Badge variant="secondary" className="text-[10px]">{p.State}</Badge>}
                        {p.Value ? <span className="font-medium text-foreground">{formatCurrency(p.Value)}</span> : null}
                        <span>Movimentacoes {movementCount}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs gap-1.5"
                      onClick={() => setSelectedProcess(p)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedProcess} onOpenChange={(open) => !open && setSelectedProcess(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes do Processo</DialogTitle>
          </DialogHeader>
          {selectedProcess && <ProcessDetailContent process={selectedProcess} agriskClientId={agriskClientId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase">{sanitizeUiText(label)}</p>
      <p className={cn("text-sm text-foreground mt-0.5", mono && "font-mono")}>{value || '—'}</p>
    </div>
  );
}

function ProcessDetailContent({ process, agriskClientId }: { process: Record<string, any>; agriskClientId?: string | null }) {
  const [detailProcess, setDetailProcess] = useState<Record<string, any>>(process);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const effectiveClientId = agriskClientId || process?.ClientId || process?.clientId || null;

  useEffect(() => {
    setDetailProcess(process);
    setLoadingError(null);
  }, [process]);

  useEffect(() => {
    const lawsuitId = process?._id || process?.LawsuitId || process?.id;
    console.log('[ProcessDetail] effectiveClientId:', effectiveClientId, '| lawsuitId (_id first):', lawsuitId, '| _id:', process?._id, '| LawsuitId:', process?.LawsuitId);
    if (!effectiveClientId || !lawsuitId || isProcessDetailLoaded(process)) return;

    let cancelled = false;
    setLoadingDetail(true);

    supabase.functions.invoke('agrisk-query', {
      body: {
        action: 'fetch-lawsuit-detail',
        clientId: effectiveClientId,
        lawsuitId,
      },
    }).then(({ data, error }) => {
      if (cancelled) return;
      console.log('[ProcessDetail] detail response:', { error, hasData: !!data?.data, updatesLength: Array.isArray(data?.data?.Updates) ? data.data.Updates.length : 'none', keys: data?.data ? Object.keys(data.data) : [] });
      if (error || data?.ok === false || !data?.data) {
        setLoadingError(data?.error || error?.message || 'Não foi possível carregar o detalhe completo do processo.');
        return;
      }
      setDetailProcess((current) => ({ ...current, ...data.data, detailLoaded: true }));
    }).catch((error) => {
      if (!cancelled) {
        setLoadingError(error instanceof Error ? error.message : 'Não foi possível carregar o detalhe completo do processo.');
      }
    }).finally(() => {
      if (!cancelled) setLoadingDetail(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveClientId, process]);

  const p = detailProcess;
  const nature = p.Nature || p.Type || p.CourtType || p.MainSubject?.split(' - ')[0] || '';
  const polarity = p.Polarity || '—';
  const status = p.Status || '—';
  const isActive = !(status === 'INATIVO' || status === 'BAIXADO');
  const movementCount = Array.isArray(p.Updates)
    ? p.Updates.length
    : typeof p.QuantityMovements === 'number'
      ? p.QuantityMovements
      : Number(p.QuantityMovements || 0) || 0;

  const knownKeys = new Set([
    '_id', 'id', 'LawsuitId', 'Number', 'CourtName', 'State', 'Nature', 'Type', 'CourtType', 'Class', 'ClassName',
    'Area', 'MainSubject', 'ExtraSubject', 'OtherSubjects', 'CourtLevel', 'Court', 'DistributionDate', 'StartDate',
    'LastUpdate', 'LastMovementDate', 'PublicationDate', 'Value', 'Polarity', 'Status', 'Parties', 'Updates',
    'Decisions', 'Petitions', 'Tags', 'NumberOfPages', 'NumberOfVolumes', 'JusticeSecret', 'CourtDistrict',
    'JudgingBody', 'createdAt', 'updatedAt', 'Base', 'Origin', 'ClientId', 'CompanyId', 'Homonym',
    'ActivePolarityTitle', 'PassivePolarityTitle', 'TimeSinceLastVerification', 'QuantityMovements',
    'SourcesCourtsAreArchived', 'IaAnalysisStatus', 'IaAnalysisHistory', 'detailLoaded'
  ]);

  const extraScalarEntries = Object.entries(p).filter(([key, value]) =>
    !knownKeys.has(key) && !Array.isArray(value) && !isPlainObject(value),
  );

  const extraComplexEntries = Object.entries(p).filter(([key, value]) =>
    !knownKeys.has(key) && (Array.isArray(value) || isPlainObject(value)),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={isActive ? "default" : "secondary"}>{isActive ? 'ATIVO' : 'INATIVO'}</Badge>
        <Badge variant="outline" className={cn("text-xs font-semibold",
          polarity === 'Ativo' ? 'border-primary/40 text-primary bg-primary/5' : 'border-blue-500/30 text-blue-600 bg-blue-50'
        )}>{String(polarity).toUpperCase()}</Badge>
        {nature && (
          <Badge className={cn(
            "text-[10px] font-semibold border-0",
            nature.toLowerCase().includes('civil') || nature.toLowerCase().includes('cível') ? 'bg-blue-100 text-blue-700' :
            nature.toLowerCase().includes('criminal') ? 'bg-red-100 text-red-700' :
            nature.toLowerCase().includes('trabalh') ? 'bg-amber-100 text-amber-700' :
            'bg-muted text-muted-foreground'
          )}>
            {String(nature).toUpperCase()}
          </Badge>
        )}
        {loadingDetail && <Badge variant="secondary">Carregando detalhe completo...</Badge>}
      </div>

      {loadingError && <p className="text-sm text-destructive">{loadingError}</p>}
      {!loadingDetail && !loadingError && (!Array.isArray(p.Updates) || p.Updates.length === 0) && typeof p.UpdateStatus === 'string' && (
        <div className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          normalizeText(p.UpdateStatus) === 'falhou'
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-muted bg-muted/40 text-muted-foreground",
        )}>
          {normalizeText(p.UpdateStatus) === 'falhou'
            ? 'O AgRisk retornou falha ao atualizar as movimentações deste processo. Os demais detalhes foram carregados, mas a API não entregou a timeline.'
            : `Status das movimentações no AgRisk: ${p.UpdateStatus}.`}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailField label="Número" value={p.Number} mono />
            <DetailField label="Tribunal" value={p.CourtName} />
            <DetailField label="UF" value={p.State} />
            <DetailField label="Natureza" value={p.Nature || p.Type || p.CourtType} />
            <DetailField label="Classe" value={p.Class || p.ClassName || p.CourtLevel} />
            <DetailField label="Área" value={p.Area || p.CourtDistrict} />
            <DetailField label="Assunto Principal" value={p.MainSubject} />
            <DetailField label="Assuntos Extras" value={Array.isArray(p.OtherSubjects) ? p.OtherSubjects.map((item: any) => formatPrimitive(item?.name || item?.description || item)).join(', ') : p.ExtraSubject} />
            <DetailField label="Vara / Foro" value={p.CourtLevel || p.Court || p.JudgingBody} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Datas e Valores</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <DetailField label="Data Início" value={p.StartDate ? formatDate(p.StartDate) : p.DistributionDate ? formatDate(p.DistributionDate) : p.PublicationDate ? formatDate(p.PublicationDate) : '—'} />
            <DetailField label="Data Distribuição" value={p.DistributionDate ? formatDate(p.DistributionDate) : '—'} />
            <DetailField label="Última Atualização" value={p.LastUpdate ? formatDate(p.LastUpdate) : p.LastMovementDate ? formatDate(p.LastMovementDate) : '—'} />
            <DetailField label="Valor da Causa" value={typeof p.Value === 'number' ? formatCurrency(p.Value) : p.Value} />
            <DetailField label="Movimentações" value={String(movementCount)} />
          </div>
        </CardContent>
      </Card>

      {Array.isArray(p.Tags) && p.Tags.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Tags</p>
            <div className="flex flex-wrap gap-2">
              {p.Tags.map((tag: any, index: number) => (
                <Badge key={index} variant="secondary">{String(tag?.tag || tag)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {Array.isArray(p.Parties) && p.Parties.length > 0 && (
        <ArraySection
          title={`Partes (${p.Parties.length})`}
          items={p.Parties}
          renderItem={(party: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">{party.Name || party.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatDocument(party.TaxId || party.taxId || party.Document || party.Doc)}</p>
                {(party.Lawyer || party.LawyerName) && (
                  <p className="text-xs text-muted-foreground mt-0.5">Advogado: {party.Lawyer || party.LawyerName}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {String(party.Polarity || party.polarity || party.Type || party.type || '—').toUpperCase()}
              </Badge>
            </div>
          )}
        />
      )}

      {Array.isArray(p.Updates) && p.Updates.length > 0 && (
        <TimelineSection title={`Movimentações (${p.Updates.length})`} items={p.Updates} />
      )}

      {(!Array.isArray(p.Updates) || p.Updates.length === 0) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              {`Movimentações (${movementCount})`}
            </p>
            <p className="text-sm text-muted-foreground">
              {typeof p.UpdateStatus === 'string'
                ? `Nenhuma movimentação detalhada retornada pelo AgRisk. Status atual: ${p.UpdateStatus}.`
                : 'Nenhuma movimentação detalhada retornada pelo AgRisk para este processo.'}
            </p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(p.Decisions) && p.Decisions.length > 0 && (
        <TimelineSection title={`Decisões (${p.Decisions.length})`} items={p.Decisions} />
      )}

      {Array.isArray(p.Petitions) && p.Petitions.length > 0 && (
        <TimelineSection title={`Petições (${p.Petitions.length})`} items={p.Petitions} />
      )}

      {isPlainObject(p.IaAnalysisHistory) && (
        <ObjectSection title="Histórico IA" value={p.IaAnalysisHistory} />
      )}

      {extraScalarEntries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Campos Extras</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {extraScalarEntries.map(([key, value]) => (
                <DetailField key={key} label={formatLabel(key)} value={formatPrimitive(value)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {extraComplexEntries.map(([key, value]) => (
        Array.isArray(value) ? (
          <TimelineSection key={key} title={formatLabel(key)} items={value} />
        ) : (
          <ObjectSection key={key} title={formatLabel(key)} value={value as Record<string, any>} />
        )
      ))}
    </div>
  );
}

function ArraySection({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: any[];
  renderItem: (item: any, index: number) => ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{sanitizeUiText(title)}</p>
        <div className="divide-y divide-border">
          {items.map((item, index) => renderItem(item, index))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineSection({ title, items }: { title: string; items: any[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{sanitizeUiText(title)}</p>
        <ScrollArea className="max-h-[360px] pr-2">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border-l-2 border-primary/30 pl-3 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-primary">{getBestItemDate(item) || '—'}</span>
                  {item.Type && <Badge variant="secondary" className="text-[10px]">{String(item.Type)}</Badge>}
                </div>
                <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{getLongText(item) || JSON.stringify(item, null, 2)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ObjectSection({ title, value }: { title: string; value: Record<string, any> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{sanitizeUiText(title)}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(value).map(([key, itemValue]) => (
            <DetailField
              key={key}
              label={formatLabel(key)}
              value={isPlainObject(itemValue) || Array.isArray(itemValue) ? JSON.stringify(itemValue) : formatPrimitive(itemValue)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grupos Renderer (matches reference image 124) ───
function GruposContent({ items }: { items: SubItem[] }) {
  const hasConsultedItems = items.some((section) => section.status === 'DONE' && Array.isArray(section.data) && section.data.length > 0);
  if (!hasConsultedItems) {
    return <EmptyState title="Grupos nÃ£o consultado" description="Esse tÃ³pico nÃ£o foi consultado nesta execuÃ§Ã£o." />;
  }

  const familiar = items.find(i => i.key === 'grupo-familiar');
  const economico = items.find(i => i.key === 'grupo-economico');

  const relationMap: Record<string, string> = {
    'MOTHER': 'MÃE', 'FATHER': 'PAI', 'BROTHER': 'IRMÃO', 'SISTER': 'IRMÃ',
    'SON': 'FILHO', 'DAUGHTER': 'FILHA', 'SPOUSE': 'CÔNJUGE', 'PARTNER': 'SÓCIO',
    'OWNER': 'PROPRIETÁRIO', 'GRANDMOTHER': 'AVÓ', 'GRANDFATHER': 'AVÔ',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Grupos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Familiar */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xl font-bold text-foreground mb-4">Familiar</h3>
            {(!familiar || (Array.isArray(familiar.data) && familiar.data.length === 0)) ? (
              <EmptyState title="Sem Familiares" description="Não foram identificados familiares." />
            ) : (
              <div className="divide-y divide-border">
                {(familiar.data as any[]).map((m: any, idx: number) => {
                  const rel = (m.type || m.relationship || '').toUpperCase();
                  const translatedRel = relationMap[rel] || rel || '—';
                  return (
                    <div key={idx} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-bold text-foreground uppercase">{m.name || '—'}</p>
                        {m.taxId && <p className="text-xs text-muted-foreground">{m.taxId}</p>}
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 border-0 text-xs font-semibold">
                        {translatedRel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Econômico */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Econômico</h3>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Vínculos ativos</span>
              </div>
            </div>
            {(!economico || (Array.isArray(economico.data) && economico.data.length === 0)) ? (
              <EmptyState title="Sem Empresas" description="Não foram identificadas empresas." />
            ) : (
              <div className="divide-y divide-border">
                {(economico.data as any[]).map((m: any, idx: number) => {
                  const role = (m.type || m.role || 'PROPRIETÁRIO').toUpperCase();
                  const translatedRole = relationMap[role] || role;
                  return (
                    <div key={idx} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-bold text-foreground uppercase">{m.name || '—'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.status && (
                            <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600">{m.status}</Badge>
                          )}
                          {m.taxId && <span className="text-xs text-muted-foreground">{m.taxId}</span>}
                        </div>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-0 text-xs font-semibold">
                        {translatedRole}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GenericTopicContent({ title, items }: { title: string; items: SubItem[] }) {
  const item = items[0];
  if (!item || item.status !== 'DONE' || !item.data) {
    return <EmptyState title={`${title} não consultado`} description="Esse tópico não foi consultado nesta execução." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <AgriskDetailView data={item.data} title={title} />
    </div>
  );
}

// ─── Veicular: layout dedicado (header + total + cards de veículos) ───
function VeicularContent({ items }: { items: SubItem[] }) {
  const item = items[0];
  if (!item || item.status !== 'DONE' || !item.data) {
    return (
      <EmptyState
        title="Veicular não consultado"
        description="Esse tópico não foi consultado nesta execução."
      />
    );
  }

  const data: any = item.data;
  const vehicles: any[] = Array.isArray(data?.items) ? data.items : [];
  const quantity: number = typeof data?.quantity === 'number' ? data.quantity : vehicles.length;
  const totalValue: number = typeof data?.totalValue === 'number'
    ? data.totalValue
    : vehicles.reduce((acc, v) => acc + (Number(v?.value) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header com título e card de total */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Patrimônio veicular{' '}
            <span className="text-base font-normal text-muted-foreground">
              - Até os últimos 10 veículos registrados
            </span>
          </h2>
        </div>
        <div className="rounded-md bg-foreground text-background px-5 py-3 min-w-[220px] text-right shadow-sm">
          <div className="text-[11px] font-semibold text-primary tracking-wide">
            Quantidade: {quantity}
          </div>
          <div className="text-base font-bold text-primary mt-0.5">
            TOTAL: {formatCurrency(totalValue)}
          </div>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum veículo retornado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v, idx) => (
            <VehicleCard key={v?._id || idx} vehicle={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: any }) {
  const v = vehicle || {};
  const fields: { label: string; value: string }[] = [
    { label: 'Cor', value: v.color ? String(v.color) : '—' },
    { label: 'Município', value: v.city ? String(v.city) : '—' },
    { label: 'UF', value: v.uf ? String(v.uf) : '—' },
    { label: 'Placa', value: v.plate ? String(v.plate) : '—' },
    { label: 'Chassi', value: v.chassis ? String(v.chassis) : '—' },
    { label: 'Renavam', value: v.renavam ? String(v.renavam) : '—' },
  ];

  return (
    <Card className="overflow-hidden border border-border">
      {/* Faixa superior: identificação do veículo */}
      <div className="bg-muted/40 px-5 py-3 flex items-center justify-between flex-wrap gap-2 border-b border-border">
        <div className="flex flex-col">
          <div className="text-sm">
            <span className="text-primary font-semibold">Veículo: </span>
            <span className="font-bold text-foreground">{v.vehicle || '—'}</span>
          </div>
          {(v.manufacturingYear || v.modelYear) && (
            <div className="text-xs text-muted-foreground mt-0.5">
              <span className="text-primary">Ano fabricação: </span>
              <span>{v.manufacturingYear || v.modelYear}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm">
            <span className="text-primary font-semibold">FIPE: </span>
            <span className="font-bold text-foreground">
              {Number.isFinite(Number(v.value)) ? formatCurrency(Number(v.value)) : '—'}
            </span>
          </div>
          {v.validity && (
            <div className="text-[11px] text-muted-foreground tracking-wide uppercase mt-0.5">
              {String(v.validity).trim()}
            </div>
          )}
        </div>
      </div>

      {/* Grid de atributos */}
      <CardContent className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[11px] font-medium text-muted-foreground">{f.label}</p>
              <p className="text-sm font-bold text-foreground mt-0.5 break-words">{f.value}</p>
            </div>
          ))}
        </div>

        {Array.isArray(v.restrictions) && v.restrictions.length > 0 && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-semibold text-destructive mb-1">Restrições</p>
            <ul className="text-xs text-destructive list-disc pl-4 space-y-0.5">
              {v.restrictions.map((r: any, i: number) => (
                <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImoveisContent({ items }: { items: SubItem[] }) {
  const simplesItem = items.find(i => i.key === 'imoveis-simples');
  const carItem = items.find(i => i.key === 'imoveis-car');

  const hasSimplesNative = simplesItem?.status === 'DONE' && !!simplesItem.data;
  const hasCar = carItem?.status === 'DONE' && !!carItem.data;

  return (
    <div className="space-y-6">
      {/* ── Imóveis Rurais (Simples) ── */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Imóveis Rurais</h2>

        {hasSimplesNative ? (
          <ImoveisSimplesView data={simplesItem!.data as Record<string, any>} />
        ) : hasCar ? (
          <ImoveisSimplesFromCarView data={carItem!.data as Record<string, unknown>} />
        ) : (
          <EmptyState
            title="Imóveis Simples não consultado"
            description="Esse tópico faz parte do bloco AgRisk, mas não foi consultado nesta execução."
          />
        )}
      </div>

      {/* ── CAR ── */}
      {carItem && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-foreground">CAR – Cadastro Ambiental Rural</h3>
          {hasCar ? (
            <CarItemsView data={carItem.data as Record<string, unknown>} />
          ) : (
            <EmptyState
              title="CAR não consultado"
              description="Esse tópico faz parte do bloco AgRisk, mas não foi consultado nesta execução."
            />
          )}
        </div>
      )}
    </div>
  );
}

// Visão "Imóveis Rurais (Simples)" do AgRisk derivada dos itens CAR.
function ImoveisSimplesFromCarView({ data }: { data: Record<string, unknown> }) {
  const d: any = data || {};
  const root: any =
    (d?.details && !Array.isArray(d.details) && typeof d.details === 'object' ? d.details : null) ||
    (d?.result && typeof d.result === 'object' ? d.result : null) ||
    d;
  const items: any[] = Array.isArray(root?.items) ? root.items : [];

  const fmtNum = (n: number, dec = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec }).format(n);
  const fmtCurr = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum imóvel encontrado"
        description="A consulta de imóveis rurais não retornou registros para este cliente."
      />
    );
  }

  const classify = (s: string) => {
    const v = (s || '').toLowerCase();
    if (v.includes('sociedade') || v.includes('society') || v.includes('partner')) return 'sociedade';
    if (v.includes('arrend')) return 'arrendada';
    if (v.includes('parc')) return 'parceria';
    return 'propria';
  };

  const totals = items.reduce(
    (acc: any, it: any) => {
      const cls = classify(it.ownership || '');
      const area = Number(it.totalArea ?? 0);
      acc.areaTotal += area;
      acc[`area_${cls}`] = (acc[`area_${cls}`] || 0) + area;
      acc[`count_${cls}`] = (acc[`count_${cls}`] || 0) + 1;
      acc.valorTotal += Number(it.vti?.mean ?? 0);
      return acc;
    },
    { areaTotal: 0, valorTotal: 0 } as any
  );

  return (
    <div className="space-y-5">
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-start">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3">Áreas (ha)</p>
              <div className="flex items-end gap-6 flex-wrap">
                <div>
                  <p className="text-3xl font-bold text-foreground leading-tight">{fmtNum(totals.areaTotal, 0)}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="border-l border-border pl-6">
                  <p className="text-2xl font-bold text-foreground leading-tight">{fmtNum(totals.area_propria || 0, 0)}</p>
                  <p className="text-xs text-muted-foreground">Própria</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{fmtNum(totals.area_sociedade || 0, 0)}</p>
                  <p className="text-xs text-muted-foreground">De sociedades</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{fmtNum(totals.area_arrendada || 0, 0)}</p>
                  <p className="text-xs text-muted-foreground">Arrendada</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{fmtNum(totals.area_parceria || 0, 0)}</p>
                  <p className="text-xs text-muted-foreground">Parcerias</p>
                </div>
              </div>
            </div>

            <div className="md:border-l md:border-border md:pl-6">
              <p className="text-sm font-semibold text-muted-foreground mb-3">Imóveis</p>
              <div className="flex items-end gap-6 flex-wrap">
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{totals.count_propria || 0}</p>
                  <p className="text-xs text-muted-foreground">Próprios</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{totals.count_sociedade || 0}</p>
                  <p className="text-xs text-muted-foreground">De sociedades</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{totals.count_arrendada || 0}</p>
                  <p className="text-xs text-muted-foreground">Arrendados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{totals.count_parceria || 0}</p>
                  <p className="text-xs text-muted-foreground">Parcerias</p>
                </div>
              </div>
            </div>

            <div className="md:border-l md:border-border md:pl-6">
              <p className="text-sm font-semibold text-muted-foreground mb-3">Valor total</p>
              <p className="text-2xl font-bold text-foreground leading-tight">
                {totals.valorTotal > 0 ? fmtCurr(totals.valorTotal) : 'R$ 0,00'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Nome/CAR</TableHead>
                <TableHead className="text-xs">Área Total</TableHead>
                <TableHead className="text-xs">Área Própria</TableHead>
                <TableHead className="text-xs">Geo</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
                <TableHead className="text-xs">UF</TableHead>
                <TableHead className="text-xs">Município</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => {
                const cls = classify(item.ownership || '');
                const labelMap: Record<string, string> = {
                  propria: 'PRÓPRIA',
                  sociedade: 'DE SOCIEDADE',
                  arrendada: 'ARRENDADA',
                  parceria: 'PARCERIA',
                };
                const colorMap: Record<string, string> = {
                  propria: 'border-emerald-500/40 text-emerald-700 bg-emerald-50',
                  sociedade: 'border-cyan-500/40 text-cyan-700 bg-cyan-50',
                  arrendada: 'border-amber-500/40 text-amber-700 bg-amber-50',
                  parceria: 'border-violet-500/40 text-violet-700 bg-violet-50',
                };

                const totalA = Number(item.totalArea ?? 0);
                const prodA = Number(item.productiveArea ?? 0);
                const pct = totalA > 0 ? (prodA / totalA) * 100 : 0;
                const valor = Number(item.vti?.mean ?? 0);
                const geoArr: any[] = Array.isArray(item.geo) ? item.geo : [];
                const hasGeo = geoArr.length > 0;
                const carCode = item.car || item.carCode || item.code || null;
                const nome = item.name || (carCode ? null : '—');

                return (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="py-3">
                      <Badge variant="outline" className={cn("text-[10px] font-semibold whitespace-nowrap", colorMap[cls])}>
                        {labelMap[cls]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground max-w-[360px]">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {nome && (
                          <span className="font-medium truncate" title={nome}>{nome}</span>
                        )}
                        {carCode && (
                          <span
                            className="font-mono text-[11px] text-muted-foreground truncate"
                            title={carCode}
                          >
                            {carCode}
                          </span>
                        )}
                        {!nome && !carCode && <span>—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {totalA > 0 ? `${fmtNum(totalA, 1)} ha` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {prodA > 0 ? `${fmtNum(prodA, 2)} ha (${fmtNum(pct, 0)}%)` : '—'}
                    </TableCell>
                    <TableCell>
                      {hasGeo ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px]">GEO</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {valor > 0 ? fmtCurr(valor) : 'R$ 0,00'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{item.state || '—'}</TableCell>
                    <TableCell className="text-sm text-foreground">{item.city || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PropertyMap({ parcels }: { parcels: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
    }).addTo(map);

    // Labels overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
    }).addTo(map);

    const allBounds: L.LatLngBounds[] = [];

    parcels.forEach((parcel: any) => {
      const geometry = parcel.geometry;
      if (!geometry?.coordinates?.length) return;

      // GeoJSON coordinates are [lng, lat, alt?] — Leaflet needs [lat, lng]
      const coords: L.LatLngExpression[][] = geometry.coordinates.map((ring: number[][]) =>
        ring.map((pt: number[]) => [pt[1], pt[0]] as L.LatLngExpression)
      );

      const polygon = L.polygon(coords, {
        color: '#22C55E',
        weight: 2,
        fillColor: '#22C55E',
        fillOpacity: 0.2,
      }).addTo(map);

      allBounds.push(polygon.getBounds());
    });

    if (allBounds.length > 0) {
      const combined = allBounds.reduce((acc, b) => acc.extend(b), allBounds[0]);
      map.fitBounds(combined, { padding: [30, 30] });
    } else {
      map.setView([-15.78, -47.93], 4);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [parcels]);

  return <div ref={mapRef} className="w-full h-full min-h-[350px] rounded-lg z-0" />;
}

function MiniPropertyMap({ parcels }: { parcels: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
    }).addTo(map);

    const allBounds: L.LatLngBounds[] = [];

    parcels.forEach((parcel: any) => {
      const geometry = parcel.geometry;
      if (!geometry?.coordinates?.length) return;
      const coords: L.LatLngExpression[][] = geometry.coordinates.map((ring: number[][]) =>
        ring.map((pt: number[]) => [pt[1], pt[0]] as L.LatLngExpression)
      );
      const polygon = L.polygon(coords, {
        color: '#22C55E',
        weight: 1.5,
        fillColor: '#22C55E',
        fillOpacity: 0.35,
      }).addTo(map);
      allBounds.push(polygon.getBounds());
    });

    if (allBounds.length > 0) {
      const combined = allBounds.reduce((acc, b) => acc.extend(b), allBounds[0]);
      map.fitBounds(combined, { padding: [4, 4] });
    } else {
      map.setView([-15.78, -47.93], 4);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [parcels]);

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-md"
      style={{ contain: 'strict' }}
    />
  );
}

function ImovelDetailDialog({ property, tipo, open: openProp, onOpenChange }: { property: any; tipo: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [detailTab, setDetailTab] = useState('matriculas');
  
  const details = property.details || {};
  const insertInfo = details.insertInfo || {};
  const cafir = details.cafir || {};

  const nome = property.name || insertInfo.name || cafir.farmName || '—';
  const tipoLower = (tipo || '').toString().toLowerCase();
  const isSociedade = tipoLower.includes('sociedade') || tipoLower.includes('society') || tipoLower.includes('partner');

  const nirf = insertInfo.nirf || cafir.nirf || '—';
  const incra = insertInfo.numIncra || cafir.numIncra || '—';
  const area = parseFloat(property.totalArea || insertInfo.totalArea || cafir.totalArea || 0);
  const areaProdutiva = insertInfo.productiveArea || cafir.productiveArea || null;
  const modFiscal = insertInfo.fiscalModule || cafir.fiscalModule || null;
  const valorEstimado = insertInfo.estimatedValue || cafir.estimatedValue || null;
  const valorAtribuido = parseFloat(property.value || insertInfo.value || 0);
  const uf = property.state || insertInfo.state || cafir.state || '—';
  const municipio = property.city || insertInfo.city || cafir.city || '—';

  // Parcels with geometry for the map
  const parcels: any[] = Array.isArray(details.parcels) ? details.parcels : [];
  const hasParcels = parcels.some((p: any) => p.geometry?.coordinates?.length > 0);

  // Geo flag detection
  const parseGeoFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', '1', 'sim'].includes(value.trim().toLowerCase());
    return false;
  };
  const hasGeo = [
    property.isGEORef, details.isGEORef, insertInfo.isGEORef, cafir.isGEORef,
  ].some(parseGeoFlag) || hasParcels;

  // Matrículas: use parcels (which have registry, area, farmName) as primary source, fallback to insertInfo.registrations
  const matriculasFromParcels = parcels.map((p: any) => ({
    registration: p.registry || p.registration || 'None',
    area: p.area,
    name: p.farmName || p.name || '—',
  }));
  const matriculasFromInsert: any[] = Array.isArray(insertInfo.registrations) ? insertInfo.registrations : [];
  const matriculas = matriculasFromParcels.length > 0 ? matriculasFromParcels : matriculasFromInsert;

  // CAR
  const cars: any[] = Array.isArray(details.car) ? details.car
    : Array.isArray(insertInfo.car) ? insertInfo.car : [];
  // Proprietários
  const proprietarios: any[] = Array.isArray(cafir.owners) ? cafir.owners : [];

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(v) ? 0 : v);

  // KML export from parcels
  const handleDownloadKml = () => {
    if (!parcels.length) return;
    const placemarks = parcels.map((p: any, i: number) => {
      const coords = (p.geometry?.coordinates?.[0] || [])
        .map((pt: number[]) => `${pt[0]},${pt[1]},${pt[2] || 0}`)
        .join(' ');
      return `<Placemark><name>${p.farmName || `Parcela ${i + 1}`}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    }).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${nome}</name>\n${placemarks}\n</Document></kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nome.replace(/\s+/g, '_')}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {openProp === undefined && (
        <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setOpen(true)}>
          Ver mais
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
              <DialogHeader className="p-0">
                <DialogTitle className="text-xl font-bold">{nome}</DialogTitle>
              </DialogHeader>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  isSociedade
                    ? "border-cyan-500/40 text-cyan-700 bg-cyan-50"
                    : "border-green-500/40 text-green-700 bg-green-50"
                )}
              >
                {isSociedade ? 'DE SOCIEDADE' : 'PRÓPRIA'}
              </Badge>
            </div>
            {hasParcels && (
              <Button variant="outline" size="sm" className="text-primary border-primary/30" onClick={handleDownloadKml}>
                <Download className="h-4 w-4 mr-1.5" />
                Baixar KML
              </Button>
            )}
          </div>

          {/* Map + Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 px-6">
            {/* Map */}
            <div className="rounded-lg overflow-hidden border border-border min-h-[350px]">
              {hasGeo && hasParcels ? (
                <PropertyMap parcels={parcels} />
              ) : hasGeo ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground bg-muted/20">
                  <MapPin className="h-10 w-10 text-primary/40" />
                  <p className="text-sm font-medium text-foreground">Geo-referenciamento disponível</p>
                  <p className="text-xs text-muted-foreground">Sem coordenadas para exibição no mapa</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground bg-muted/20">
                  <MapPinOff className="h-10 w-10" />
                  <p className="text-sm font-medium text-foreground">Imóvel sem geo-referenciamento</p>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="pl-6 space-y-4">
              <h4 className="text-lg font-semibold text-foreground">Informações</h4>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</p>
                <p className="text-base text-foreground">{nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NIRF / CIB</p>
                  <p className="text-base text-foreground">{nirf}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Núm. INCRA</p>
                  <p className="text-base text-foreground">{incra}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Área</p>
                  <p className="text-base text-foreground">{isNaN(area) ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(area)} ha`}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Área Produtiva</p>
                  <p className="text-base text-foreground">{areaProdutiva ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mod. Fiscal</p>
                  <p className="text-base text-foreground">{modFiscal ?? '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor estimado</p>
                  <p className="text-base text-foreground">{valorEstimado ? fmtCurrency(parseFloat(valorEstimado)) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor atribuído</p>
                  <p className="text-base text-foreground">{fmtCurrency(valorAtribuido)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</p>
                  <p className="text-base text-foreground">{uf}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Município</p>
                  <p className="text-base text-foreground">{municipio}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pb-6 pt-4">
            <Tabs defaultValue="matriculas">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="matriculas">Matrículas</TabsTrigger>
                <TabsTrigger value="car">CAR</TabsTrigger>
                <TabsTrigger value="proprietarios">Proprietários</TabsTrigger>
              </TabsList>
              <TabsContent value="matriculas">
                {matriculas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Matrícula</TableHead>
                        <TableHead className="text-xs">Área</TableHead>
                        <TableHead className="text-xs">Nome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matriculas.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{m.registration || m.matricula || m.number || '—'}</TableCell>
                          <TableCell className="text-sm">{m.area ?? '—'}</TableCell>
                          <TableCell className="text-sm">{m.name || m.nome || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">não há itens na lista</p>
                )}
              </TabsContent>
              <TabsContent value="car">
                {cars.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código CAR</TableHead>
                        <TableHead className="text-xs">Área</TableHead>
                        <TableHead className="text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cars.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{c.code || c.codigo || c.carCode || '—'}</TableCell>
                          <TableCell className="text-sm">{c.area ?? '—'}</TableCell>
                          <TableCell className="text-sm">{c.status || c.situacao || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">não há itens na lista</p>
                )}
              </TabsContent>
              <TabsContent value="proprietarios">
                {proprietarios.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">CPF/CNPJ</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Participação</TableHead>
                        <TableHead className="text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proprietarios.map((p: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{p.name || '—'}</TableCell>
                          <TableCell className="text-sm">{p.taxId || '—'}</TableCell>
                          <TableCell className="text-sm">{p.type || p.legalNature || '—'}</TableCell>
                          <TableCell className="text-sm">{p.share != null ? `${p.share}%` : '—'}</TableCell>
                          <TableCell className="text-sm">{p.situation || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">não há itens na lista</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CarItemsView({ data }: { data: Record<string, unknown> }) {
  const d: any = data || {};
  // Nota: CAR pode ter uma chave `details` interna do tipo array (detalhes por imóvel) — não confundir com o envelope.
  const root: any =
    (d?.details && !Array.isArray(d.details) && typeof d.details === 'object' ? d.details : null) ||
    (d?.result && typeof d.result === 'object' ? d.result : null) ||
    d;
  const items: any[] = Array.isArray(root?.items) ? root.items : [];
  // Lookup de detalhes ricos (geo, agcheck, owners, etc) indexados por _id
  const detailsArr: any[] = Array.isArray(d?.details) ? d.details
    : Array.isArray(root?.details) ? root.details : [];
  const detailsById = new Map<string, any>();
  detailsArr.forEach((det: any) => { if (det?._id) detailsById.set(det._id, det); });

  const totalArea = Number(root?.totalArea ?? 0);
  const productiveArea = Number(root?.productiveArea ?? 0);
  const properties = Number(root?.properties ?? items.length);
  const ownedProperties = Number(root?.ownedProperties ?? 0);
  const totalVti = Number(root?.totalVti ?? 0);
  const [openDetail, setOpenDetail] = useState<any | null>(null);

  const fmtNum = (n: number, dec = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec }).format(n);
  const fmtCurr = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum imóvel CAR encontrado"
        description="A consulta CAR não retornou registros para este cliente."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Áreas (ha)</p>
            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{fmtNum(totalArea, 0)}</p>
              </div>
              <div className="border-l border-border pl-8">
                <p className="text-xs text-muted-foreground">Produtiva</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{fmtNum(productiveArea, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Imóveis</p>
            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{properties}</p>
              </div>
              <div className="border-l border-border pl-8">
                <p className="text-xs text-muted-foreground">Próprios</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{ownedProperties}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Valor total dos imóveis</p>
            <div>
              <p className="text-xs text-muted-foreground">VTI total</p>
              <p className="text-3xl font-bold text-foreground leading-tight">
                {totalVti > 0 ? fmtCurr(totalVti) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-16"></TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Nome/CAR</TableHead>
                <TableHead className="text-xs text-center">Proprietários</TableHead>
                <TableHead className="text-xs">Área Total</TableHead>
                <TableHead className="text-xs">Área Consolidada</TableHead>
                <TableHead className="text-xs">VTI (média)</TableHead>
                <TableHead className="text-xs">UF</TableHead>
                <TableHead className="text-xs">Município</TableHead>
                <TableHead className="text-xs w-16 text-right pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => {
                const richDetail = (item?._id && detailsById.get(item._id)) || {};
                const ownership = (item.ownership || richDetail.ownership || '').toString().toLowerCase();
                const isSociedade = ownership.includes('sociedade') || ownership.includes('society') || ownership.includes('partner');
                const car = item.car || richDetail.car || '—';
                const displayName = item.name || richDetail.name || car;
                const totalA = Number(item.totalArea ?? richDetail.totalArea ?? 0);
                const prodA = Number(item.productiveArea ?? richDetail.productiveArea ?? 0);
                const vti = item.vti?.mean ? Number(item.vti.mean) : 0;
                const uf = item.state || richDetail.state || '—';
                const city = item.city || richDetail.city || '—';
                const ownersQty = Number(item.ownersQuantity ?? (Array.isArray(richDetail.owner) ? richDetail.owner.length : 1));

                // Geo parcels — preferir o detalhe rico (que contém coordinates de verdade)
                const richGeo: any[] = Array.isArray(richDetail.geo) ? richDetail.geo : [];
                const itemGeo: any[] = Array.isArray(item.geo) ? item.geo : [];
                const geoArr = richGeo.length > 0 ? richGeo : itemGeo;
                const areaImovelGeo = geoArr.find((g: any) => (g?.tipo || '').toString().toUpperCase() === 'AREA_IMOVEL') || geoArr[0];
                const parcels = areaImovelGeo?.geoJson?.coordinates?.length
                  ? [{ geometry: areaImovelGeo.geoJson }]
                  : [];
                const hasParcels = parcels.length > 0;
                const hasGeo = hasParcels || geoArr.length > 0;

                return (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="py-3">
                      <div
                        className={cn(
                          "relative w-12 h-12 rounded-md overflow-hidden flex items-center justify-center ring-1 ring-border",
                          hasParcels ? "" : hasGeo ? "bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-700" : "bg-muted"
                        )}
                        title={hasGeo ? "Geo disponível" : "Sem geo"}
                      >
                        {hasParcels && <MiniPropertyMap parcels={parcels} />}
                        {hasGeo && (
                          <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500 text-white pointer-events-none z-10">
                            GEO
                          </span>
                        )}
                        {!hasGeo && <MapPinOff className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold whitespace-nowrap",
                          isSociedade
                            ? "border-cyan-500/40 text-cyan-700 bg-cyan-50"
                            : "border-emerald-500/40 text-emerald-700 bg-emerald-50"
                        )}
                      >
                        {isSociedade ? 'DE SOCIEDADE' : 'PRÓPRIA'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground max-w-[320px] truncate" title={displayName}>
                      {displayName}
                    </TableCell>
                    <TableCell className="text-sm text-foreground text-center">{ownersQty}</TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {totalA > 0 ? `${fmtNum(totalA, 0)} ha` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {prodA > 0 ? `${fmtNum(prodA, 0)} ha` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {vti > 0 ? fmtCurr(vti) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{uf}</TableCell>
                    <TableCell className="text-sm text-foreground">{city}</TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary"
                        onClick={() => setOpenDetail({ item, detail: richDetail })}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CarItemDetailDialog
        open={!!openDetail}
        onOpenChange={(o) => !o && setOpenDetail(null)}
        item={openDetail?.item}
        detail={openDetail?.detail}
      />
    </div>
  );
}

// Diálogo de detalhe completo de um imóvel CAR — espelha o layout original do AgRisk:
// Dados do imóvel + Mapa + AgCheck + Proprietários
function CarItemDetailDialog({
  open,
  onOpenChange,
  item,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  detail?: any;
}) {
  if (!item) return null;
  const d = detail || {};
  const fmtNum = (n: number, dec = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec }).format(n);

  const car = item.car || d.car || '—';
  const nome = item.name || d.name || 'NÃO INFORMADO';
  const city = item.city || d.city || '—';
  const state = item.state || d.state || '—';
  const totalArea = Number(item.totalArea ?? d.totalArea ?? 0);
  const productiveArea = Number(item.productiveArea ?? d.productiveArea ?? 0);
  const description = d.description || item.description || null;
  const taxMode = d.taxMode || item.taxMode || null;

  // Geo: cores por tipo (Área do Imóvel / Consolidada / Reserva Legal / APP)
  const geoArr: any[] = Array.isArray(d.geo) ? d.geo : Array.isArray(item.geo) ? item.geo : [];
  const COLOR_MAP: Record<string, { color: string; fill: string }> = {
    AREA_IMOVEL: { color: '#FFFFFF', fill: '#FFFFFF' },
    AREA_CONSOLIDADA: { color: '#A855F7', fill: '#A855F7' },
    RESERVA_LEGAL: { color: '#22C55E', fill: '#22C55E' },
    APP: { color: '#3B82F6', fill: '#3B82F6' },
  };
  const parcels = geoArr
    .filter((g: any) => g?.geoJson?.coordinates?.length > 0)
    .map((g: any) => {
      const tipo = (g?.tipo || '').toString().toUpperCase();
      const style = COLOR_MAP[tipo] || { color: '#22C55E', fill: '#22C55E' };
      return { geometry: g.geoJson, color: style.color, fill: style.fill, fillOpacity: tipo === 'AREA_IMOVEL' ? 0 : 0.35 };
    });
  const hasParcels = parcels.length > 0;

  // AgCheck — converte o objeto em uma lista padronizada
  const agcheck = d.agcheck || item.agcheck || {};
  const AGCHECK_LABELS: Array<{ key: string; label: string }> = [
    { key: 'prodes', label: 'PRODES' },
    { key: 'ldi', label: 'LDI' },
    { key: 'settlement', label: 'Assentamento' },
    { key: 'quilombolaares', label: 'Área quilombola' },
    { key: 'indigenuoslands', label: 'Área indígena' },
    { key: 'preserv_ambiental', label: 'Unidade de conservação ambiental' },
    { key: 'cad_nacional', label: 'Cadastro Nacional de Florestas Públicas' },
  ];
  const agcheckRows = AGCHECK_LABELS.map(({ key, label }) => {
    const raw = (agcheck as any)?.[key];
    const isPositive = Array.isArray(raw) ? raw.length > 0 : !!raw;
    return { label, isPositive };
  });

  // Proprietários
  const owners: any[] = Array.isArray(d.owner) ? d.owner
    : Array.isArray(item.owner) ? item.owner
    : [];

  const formatTaxId = (tax: string) => {
    const v = (tax || '').replace(/\D/g, '');
    if (v.length === 11) return `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9)}`;
    if (v.length === 14) return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
    return tax || '—';
  };

  // KML download
  const handleDownloadKml = () => {
    if (!hasParcels) return;
    const placemarks = parcels.map((p: any, i: number) => {
      const flat = (p.geometry?.coordinates?.[0]?.[0] || p.geometry?.coordinates?.[0] || []) as number[][];
      const coords = flat.map((pt: number[]) => `${pt[0]},${pt[1]},${pt[2] || 0}`).join(' ');
      return `<Placemark><name>Parcela ${i + 1}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    }).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${car}</name>\n${placemarks}\n</Document></kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${car.replace(/[^a-z0-9_-]/gi, '_')}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold text-foreground">Detalhe do imóvel</DialogTitle>
          </DialogHeader>
          {hasParcels && (
            <Button variant="outline" size="sm" className="text-primary border-primary/30" onClick={handleDownloadKml}>
              <Download className="h-4 w-4 mr-1.5" />
              Baixar KML
            </Button>
          )}
        </div>

        {/* Top: Dados do imóvel + Valor do imóvel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">Dados do imóvel</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Nome:</p>
                  <p className="text-foreground font-medium">{nome}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Área total:</p>
                  <p className="text-foreground font-medium">{totalArea > 0 ? `${fmtNum(totalArea, 0)} ha` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Município:</p>
                  <p className="text-foreground font-medium">{city}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Área consolidada:</p>
                  <p className="text-foreground font-medium">{productiveArea > 0 ? `${fmtNum(productiveArea, 0)} ha` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado:</p>
                  <p className="text-foreground font-medium">{state}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Mod. fiscal:</p>
                  <p className="text-foreground font-medium">{taxMode ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Registro no CAR:</p>
                  <div className="px-3 py-2 bg-muted/50 rounded text-xs font-mono text-foreground break-all">{car}</div>
                </div>
                {description && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Descrição de acesso:</p>
                    <p className="text-foreground text-sm">{description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex flex-col items-center justify-center text-center min-h-[200px]">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <MapPin className="h-7 w-7 text-primary" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">Consulte o valor do imóvel</h4>
              <p className="text-sm text-muted-foreground max-w-md">
                Consulte o VTN (Valor da Terra Nua) e VTI (Valor total do imóvel) da propriedade.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Map + AgCheck + Proprietários */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-6 mt-4">
          <div className="rounded-lg overflow-hidden border border-border min-h-[420px] relative bg-muted/20">
            {hasParcels ? (
              <PropertyMap parcels={parcels} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground absolute inset-0">
                <MapPinOff className="h-10 w-10" />
                <p className="text-sm font-medium text-foreground">Sem geo-referenciamento</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Ag Check</h4>
                <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {agcheckRows.map(({ label, isPositive }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Check className={cn('h-4 w-4', isPositive ? 'text-amber-600' : 'text-emerald-600')} />
                        {label}
                      </div>
                      <span className={cn('text-xs font-bold', isPositive ? 'text-amber-600' : 'text-emerald-600')}>
                        {isPositive ? 'POSITIVA' : 'NEGATIVA'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Proprietários</h4>
                <p className="text-xs text-muted-foreground mb-3">Proprietários, Posseiros ou Concessionários</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground uppercase">
                        <th className="text-left font-semibold pb-2">Nome</th>
                        <th className="text-right font-semibold pb-2">CPF/CNPJ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owners.length === 0 ? (
                        <tr><td colSpan={2} className="text-center py-3 text-muted-foreground text-xs">Sem proprietários informados</td></tr>
                      ) : owners.map((o: any, i: number) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2 text-foreground">{o.name || '—'}</td>
                          <td className="py-2 text-foreground text-right font-mono text-xs">{formatTaxId(o.taxId || '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuralPropertyRow({ prop, fmtNum, fmtCurr }: { prop: any; fmtNum: (n: number, dec?: number) => string; fmtCurr: (n: number) => string }) {
  const [open, setOpen] = useState(false);

  const tipo = prop.type || '—';
  const details = prop.details || {};
  const insertInfo = details.insertInfo || {};
  const cafir = details.cafir || {};
  const parcels: any[] = Array.isArray(details.parcels) ? details.parcels : [];
  const hasParcels = parcels.some((p: any) => p.geometry?.coordinates?.length > 0);
  const hasGeo = hasParcels
    || [prop.isGEORef, details.isGEORef, insertInfo.isGEORef, cafir.isGEORef].some(v =>
      typeof v === 'boolean' ? v : (typeof v === 'string' && ['true', '1', 'sim'].includes(v.trim().toLowerCase()))
    );

  const carRegs: any[] = Array.isArray(details.car) ? details.car : Array.isArray(insertInfo.car) ? insertInfo.car : [];
  const carCode = carRegs[0]?.registry || carRegs[0]?.code || carRegs[0]?.car || null;
  const nomeOuCar = carCode || prop.name || '—';

  const proprietarios = Array.isArray(cafir.owners) ? cafir.owners.length
    : Array.isArray(insertInfo.owners) ? insertInfo.owners.length
    : 1;

  const areaTotal = parseFloat(prop.totalArea || 0);
  const areaConsolidada = parseFloat(prop.areaOwned || insertInfo.productiveArea || cafir.productiveArea || 0);
  const valor = parseFloat(prop.value || 0);
  const uf = prop.state || '—';
  const municipio = prop.city || '—';

  const tipoLower = tipo.toString().toLowerCase();
  const isSociedade = tipoLower.includes('sociedade') || tipoLower.includes('society') || tipoLower.includes('partner');

  return (
    <>
      <TableRow className="hover:bg-muted/30">
        {/* Thumbnail — clicável */}
        <TableCell className="py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "relative w-12 h-12 rounded-md overflow-hidden flex items-center justify-center group",
              "ring-1 ring-border hover:ring-2 hover:ring-primary transition-all",
              hasParcels ? "" : hasGeo ? "bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-700" : "bg-muted"
            )}
            title={hasGeo ? "Ver georreferenciamento" : "Sem geo"}
          >
            {hasParcels && !open && <MiniPropertyMap parcels={parcels} />}
            {hasGeo && (
              <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500 text-white pointer-events-none z-10">
                GEO
              </span>
            )}
            {!hasGeo && <MapPinOff className="h-4 w-4 text-muted-foreground" />}
          </button>
        </TableCell>
        <TableCell className="py-3">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold whitespace-nowrap",
              isSociedade
                ? "border-cyan-500/40 text-cyan-700 bg-cyan-50"
                : "border-emerald-500/40 text-emerald-700 bg-emerald-50"
            )}
          >
            {isSociedade ? 'DE SOCIEDADE' : 'PRÓPRIA'}
          </Badge>
        </TableCell>
        <TableCell className="text-sm font-medium text-foreground max-w-[280px] truncate" title={nomeOuCar}>
          {nomeOuCar}
        </TableCell>
        <TableCell className="text-sm text-foreground text-center">{proprietarios}</TableCell>
        <TableCell className="text-sm text-foreground whitespace-nowrap">
          {isNaN(areaTotal) ? '—' : `${fmtNum(areaTotal, 1)} ha`}
        </TableCell>
        <TableCell className="text-sm text-foreground whitespace-nowrap">
          {isNaN(areaConsolidada) || areaConsolidada === 0 ? '—' : `${fmtNum(areaConsolidada, 1)} ha`}
        </TableCell>
        <TableCell className="text-sm text-foreground whitespace-nowrap">
          {valor > 0 ? fmtCurr(valor) : '—'}
        </TableCell>
        <TableCell className="text-sm text-foreground">{uf}</TableCell>
        <TableCell className="text-sm text-foreground">{municipio}</TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setOpen(true)}>
            Ver
          </Button>
        </TableCell>
      </TableRow>
      <ImovelDetailDialog property={prop} tipo={tipo} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ImoveisSimplesView({ data }: { data: Record<string, any> }) {
  // Data structure from edge function: { rural: { items, areas, properties, totalArea, totalValue }, ruralDetails: [...items with details merged] }
  const rawRural = data.rural || data;

  // Use ruralDetails (items enriched with detail data) for the table, fallback to items
  const properties: any[] = Array.isArray(data.ruralDetails) ? data.ruralDetails
    : Array.isArray(rawRural.items) ? rawRural.items
    : Array.isArray(rawRural.properties) ? rawRural.properties
    : [];

  // Use API pre-computed summary when available
  const apiAreas = rawRural.areas || {};
  const apiProps = rawRural.properties || {};

  const totalArea = rawRural.totalArea ?? apiAreas.total ?? properties.reduce((sum: number, p: any) => {
    const area = parseFloat(p.totalArea || 0);
    return sum + (isNaN(area) ? 0 : area);
  }, 0);

  // Consolidated area = sum of "areaOwned" portion across properties (fallback)
  const consolidatedArea = apiAreas.consolidated ?? apiAreas.owned ?? properties.reduce((sum: number, p: any) => {
    const a = parseFloat(p.areaOwned || 0);
    return sum + (isNaN(a) ? 0 : a);
  }, 0);

  const propria = apiProps.owned ?? properties.filter((p: any) => {
    const t = (p.type || '').toString().toLowerCase();
    return !t.includes('sociedade') && !t.includes('society') && !t.includes('partner');
  }).length;

  const totalValue = rawRural.totalValue ?? properties.reduce((sum: number, p: any) => {
    const val = parseFloat(p.value || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const vtiMedia = properties.length > 0 && totalValue > 0 ? totalValue / properties.length : 0;
  const fmtNum = (n: number, dec = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec }).format(n);
  const fmtCurr = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <div className="space-y-5">
      {/* Summary cards — three independent boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Áreas (ha) */}
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Áreas (ha)</p>
            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{fmtNum(totalArea)}</p>
              </div>
              <div className="border-l border-border pl-8">
                <p className="text-xs text-muted-foreground">Consolidada</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{fmtNum(consolidatedArea)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Imóveis */}
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Imóveis</p>
            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{properties.length}</p>
              </div>
              <div className="border-l border-border pl-8">
                <p className="text-xs text-muted-foreground">Próprios</p>
                <p className="text-3xl font-bold text-foreground leading-tight">{propria}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor total dos imóveis */}
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Valor total dos imóveis</p>
            <div>
              <p className="text-xs text-muted-foreground">VTI (média)</p>
              <p className="text-3xl font-bold text-foreground leading-tight">
                {vtiMedia > 0 ? fmtCurr(vtiMedia) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties table */}
      {properties.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-16"></TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Nome/CAR</TableHead>
                  <TableHead className="text-xs text-center">Proprietários</TableHead>
                  <TableHead className="text-xs">Área Total</TableHead>
                  <TableHead className="text-xs">Área Consolidada</TableHead>
                  <TableHead className="text-xs">VTI (média)</TableHead>
                  <TableHead className="text-xs">UF</TableHead>
                  <TableHead className="text-xs">Município</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((prop: any, idx: number) => (
                  <RuralPropertyRow key={idx} prop={prop} fmtNum={fmtNum} fmtCurr={fmtCurr} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Nenhum imóvel encontrado"
          description="A consulta não retornou imóveis rurais para este cliente."
        />
      )}
    </div>
  );
}

function ConsultaClienteTopicContent({ data }: { data: Record<string, any> }) {
  const details = data?.details || data;
  const clientData = details?.clientData || {};
  const contacts = details?.contacts || {};
  const addresses: any[] = clientData.addresses || clientData.enderecos || contacts.addresses || [];
  const phones: any[] = clientData.phones || clientData.telefones || contacts.phones || [];
  const emails: any[] = clientData.emails || contacts.emails || [];
  const validations = clientData.validations || {};

  const infoFields = [
    { label: 'Nome', value: clientData.name || clientData.nome || details?.name || details?.clientName },
    { label: 'CPF/CNPJ', value: formatDocument(clientData.taxId || clientData.document || clientData.cpfCnpj || details?.taxId) },
    { label: 'Nascimento', value: clientData.birthDate ? formatDate(clientData.birthDate) : clientData.dataNascimento },
    { label: 'Idade', value: clientData.age ? `${clientData.age} anos` : null },
    { label: 'Gênero', value: clientData.gender || clientData.genero || clientData.sexo },
    { label: 'Nome da mãe', value: clientData.motherName || clientData.nomeMae },
    { label: 'Receita Federal', value: clientData.taxIdStatus || validations.receitaFederal },
    { label: 'Óbito', value: typeof clientData.hasObitIndication === 'boolean' ? (clientData.hasObitIndication ? 'Possível indicação' : 'Negativo') : validations.obito },
  ].filter((field) => field.value);

  const hasContent = infoFields.length > 0 || addresses.length > 0 || phones.length > 0 || emails.length > 0;
  if (!hasContent) {
    return (
      <EmptyState
        title="Consulta Cliente não consultado"
        description="Esse tópico faz parte da estrutura AgRisk, mas não foi consultado nesta execução."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Informações Cadastrais</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
          {infoFields.map((field) => (
            <div key={field.label}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{field.label}</p>
              <p className="text-sm text-foreground mt-0.5">{String(field.value)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Endereços</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{addresses.length}</span>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum endereço retornado.</p>
          ) : (
            <div className="space-y-1">
              {addresses.slice(0, 5).map((address: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm text-foreground">
                    {[
                      address.street || address.logradouro,
                      address.number || address.numero,
                      address.district || address.bairro,
                      address.city || address.cidade,
                      address.state || address.uf,
                    ].filter(Boolean).join(', ') || 'Endereço sem detalhamento'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Telefones</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{phones.length}</span>
          </div>
          {phones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum telefone retornado.</p>
          ) : (
            <div className="space-y-1">
              {phones.slice(0, 5).map((phone: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {formatPhone(phone.phone_number || phone.number || phone.numero || phone.phone || phone.phoneNumber || phone.telefone)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Emails</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{emails.length}</span>
          </div>
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum email retornado.</p>
          ) : (
            <div className="space-y-1">
              {emails.slice(0, 5).map((email: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm font-medium text-foreground">{formatPrimitive(email.email || email.address || email.value)}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">
                    {formatPrimitive(email.type || email.tipo || 'Não informado')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsultaClienteTopicContentClean({ data }: { data: Record<string, any> }) {
  const details = data?.details || data;
  const clientData = details?.clientData || {};
  const contacts = details?.contacts || {};
  const addresses: any[] = clientData.addresses || clientData.enderecos || contacts.addresses || [];
  const phones: any[] = clientData.phones || clientData.telefones || contacts.phones || [];
  const emails: any[] = clientData.emails || contacts.emails || [];
  const validations = clientData.validations || {};

  const infoFields = [
    { label: 'Nome', value: clientData.name || clientData.nome || details?.name || details?.clientName },
    { label: 'CPF/CNPJ', value: formatDocument(clientData.taxId || clientData.document || clientData.cpfCnpj || details?.taxId) },
    { label: 'Nascimento', value: clientData.birthDate ? formatDate(clientData.birthDate) : clientData.dataNascimento },
    { label: 'Idade', value: clientData.age ? `${clientData.age} anos` : null },
    { label: 'Gênero', value: clientData.gender || clientData.genero || clientData.sexo },
    { label: 'Nome da mãe', value: clientData.motherName || clientData.nomeMae },
    { label: 'Receita Federal', value: clientData.taxIdStatus || validations.receitaFederal },
    { label: 'Óbito', value: typeof clientData.hasObitIndication === 'boolean' ? (clientData.hasObitIndication ? 'Possível indicação' : 'Negativo') : validations.obito },
  ].filter((field) => field.value);

  const hasContent = infoFields.length > 0 || addresses.length > 0 || phones.length > 0 || emails.length > 0;
  if (!hasContent) {
    return (
      <EmptyState
        title="Consulta Cliente não consultado"
        description="Esse tópico faz parte da estrutura AgRisk, mas não foi consultado nesta execução."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações Cadastrais - flat grid, no card wrapper */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Informações Cadastrais</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
          {infoFields.map((field) => (
            <div key={field.label}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{field.label}</p>
              <p className="text-sm text-foreground mt-0.5">{String(field.value)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Contatos - 3 columns, simple lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Endereços */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Endereços</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{addresses.length}</span>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum endereço retornado.</p>
          ) : (
            <div className="space-y-1">
              {addresses.slice(0, 5).map((address: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm text-foreground">
                    {[
                      address.street || address.logradouro,
                      address.number || address.numero,
                      address.district || address.bairro,
                      address.city || address.cidade,
                      address.state || address.uf,
                    ].filter(Boolean).join(', ') || 'Endereço sem detalhamento'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telefones */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Telefones</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{phones.length}</span>
          </div>
          {phones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum telefone retornado.</p>
          ) : (
            <div className="space-y-1">
              {phones.slice(0, 5).map((phone: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {formatPhone(phone.phone_number || phone.number || phone.numero || phone.phone || phone.phoneNumber || phone.telefone)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emails */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Emails</h4>
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{emails.length}</span>
          </div>
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum email retornado.</p>
          ) : (
            <div className="space-y-1">
              {emails.slice(0, 5).map((email: any, index: number) => (
                <div key={index} className="px-1 py-1.5">
                  <p className="text-sm font-medium text-foreground">{formatPrimitive(email.email || email.address || email.value)}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">
                    {formatPrimitive(email.type || email.tipo || 'Não informado')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SintegraContent({ items }: { items: SubItem[] }) {
  const item = items[0];
  if (!item || item.status !== 'DONE' || !item.data) {
    return <EmptyState title="Sintegra não consultado" description="Esse tópico não foi consultado nesta execução." />;
  }

  const raw = item.data;
  // Sintegra can return an object with items/registrations arrays, or be an array itself
  const registrations: any[] = Array.isArray(raw)
    ? raw
    : raw.items || raw.registrations || raw.cadastros || raw.content || (raw.result ? (Array.isArray(raw.result) ? raw.result : [raw.result]) : []);

  // Extract estados (states consulted sidebar)
  const states: any[] = raw.states || raw.estados || [];

  function getAge(item: any): string {
    if (item.age || item.idade) return String(item.age || item.idade);
    const date = item.registrationDate || item.dataRegistro || item.startDate;
    if (!date) return '—';
    try {
      const years = Math.floor((Date.now() - new Date(date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return `${years} anos`;
    } catch { return '—'; }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Cadastros de Produtor</h2>
      </div>

      <div className="flex gap-6">
        {/* Main table */}
        <div className="flex-1 min-w-0">
          {registrations.length === 0 ? (
            <EmptyState title="Nenhum cadastro encontrado" description="Não foram encontrados cadastros de produtor no Sintegra." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Fazenda</TableHead>
                  <TableHead className="font-semibold text-foreground">I.E.</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Idade</TableHead>
                  <TableHead className="font-semibold text-foreground">Atividade</TableHead>
                  <TableHead className="font-semibold text-foreground">UF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg: any, idx: number) => {
                  const status = (reg.status || reg.situacao || reg.Status || '').toUpperCase();
                  const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'HABILITADO';
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm text-foreground font-medium max-w-[200px]">
                        {reg.name || reg.nome || reg.farmName || reg.razaoSocial || reg.companyName || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-foreground tabular-nums">
                        {reg.stateRegistration || reg.inscricaoEstadual || reg.ie || reg.IE || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-[11px] font-semibold border-0",
                          isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{getAge(reg)}</TableCell>
                      <TableCell className="text-sm text-foreground max-w-[300px]">
                        {reg.activity || reg.atividade || reg.mainActivity || reg.atividadePrincipal || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-medium">
                        {reg.state || reg.uf || reg.UF || reg.estado || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* States sidebar */}
        {states.length > 0 && (
          <div className="w-56 shrink-0 border-l border-border pl-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Estados Consultados</h3>
            <div className="space-y-2">
              {states.map((s: any, idx: number) => {
                const stateLabel = typeof s === 'string' ? s : (s.state || s.uf || s.sigla || '');
                const stateStatus = typeof s === 'string' ? 'FINALIZADO' : (s.status || 'FINALIZADO');
                const isDone = stateStatus.toUpperCase().includes('FINAL') || stateStatus.toUpperCase().includes('DONE') || stateStatus.toUpperCase().includes('OK');
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className={cn("h-4 w-4", isDone ? "text-green-500" : "text-muted-foreground")} />
                    <span className="text-sm text-foreground font-medium">{stateLabel}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {stateStatus.length > 12 ? stateStatus.slice(0, 12) + '…' : stateStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Ban className="h-10 w-10 text-muted-foreground/20 mb-3" />
      <p className="text-base font-semibold text-foreground mb-1">{sanitizeUiText(title)}</p>
      <p className="text-sm text-muted-foreground">{sanitizeUiText(description)}</p>
    </div>
  );
}

// ─── Main component ───
interface Props {
  data: Record<string, any>;
  agriskClientId?: string | null;
  consultaType?: string | null;
}

export function ConsultaClienteDetailView({ data: rawData, agriskClientId, consultaType }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const normalized = normalizeResponseData(rawData, consultaType);
  const categoryDefs = [
    { key: 'sintegra', label: 'Sintegra', icon: Search },
    { key: 'grupos', label: 'Grupos', icon: Users },
    { key: 'compliance', label: 'Compliance', icon: Shield },
    { key: 'juridico', label: 'Judicial', icon: Scale },
    { key: 'armazens', label: 'Armazéns', icon: Warehouse },
    { key: 'veicular', label: 'Veicular', icon: Car },
    { key: 'imoveis', label: 'Imóveis', icon: Leaf },
    { key: 'car', label: 'CAR', icon: MapPin },
  ];

  const categorizedData = categoryDefs
    .filter(cat => normalized[cat.key] && normalized[cat.key].length > 0)
    .map(cat => ({
      ...cat,
      items: normalized[cat.key],
    }));

  const selectedKey = activeCategory || (categorizedData[0]?.key || null);
  const selectedCat = categorizedData.find(c => c.key === selectedKey);

  return (
    <div className="space-y-4">
      {/* Navbar tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-thin">
        {categorizedData.map(cat => {
          const Icon = cat.icon;
          const isActive = cat.key === selectedKey;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 whitespace-nowrap',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {selectedCat ? (
          selectedCat.key === 'sintegra' ? <SintegraContent items={selectedCat.items} /> :
          selectedCat.key === 'compliance' ? <ComplianceContent items={selectedCat.items} /> :
          selectedCat.key === 'juridico' ? <LawsuitsContent items={selectedCat.items} agriskClientId={agriskClientId} /> :
          selectedCat.key === 'grupos' ? <GruposContent items={selectedCat.items} /> :
          selectedCat.key === 'armazens' ? <GenericTopicContent title="Armazéns" items={selectedCat.items} /> :
          selectedCat.key === 'veicular' ? <VeicularContent items={selectedCat.items} /> :
          selectedCat.key === 'imoveis' ? <ImoveisContent items={selectedCat.items} /> :
          selectedCat.key === 'car' ? <ImoveisContent items={selectedCat.items} /> :
          null
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground py-12">
            <p>Nenhuma categoria disponível.</p>
          </div>
        )}
      </div>
    </div>
  );
}
