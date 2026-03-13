import { type ReactNode, useEffect, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, Shield, Scale, Leaf,
  Users, Ban, ChevronUp, ChevronDown, Search, Briefcase, Eye, X
} from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ─── Category definitions (removed BNDES, BVS, Contatos, CNDs) ───
const CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: 'compliance', label: 'Compliance', icon: Shield },
  { key: 'juridico', label: 'Processos Judiciais', icon: Scale },
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

function formatDocument(value?: string | null): string {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length === 14) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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

function normalizeResponseData(rawData: Record<string, any>): Record<string, SubItem[]> {
  const result: Record<string, SubItem[]> = {};
  const details = rawData?.details || rawData;
  if (!details || typeof details !== 'object') return result;

  // ── Compliance (Ambiental + Trabalhista merged) ──
  const compliance = details.compliance?.item || details.compliance;
  const complianceItems: SubItem[] = [];

  // Ambiental sub-items
  const envData = compliance?.environmental;
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

  // Trabalhista sub-items
  if (compliance?.labour || compliance?.criminal) {
    const l = compliance.labour || {};
    const c = compliance.criminal || {};
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

  // ── Lawsuits ──
  if (details.lawsuits) {
    result['juridico'] = [{
      key: 'lawsuits',
      label: 'Processos Judiciais',
      status: 'DONE',
      data: details.lawsuits,
    }];
  }

  // ── Grupos ──
  const grupoItems: SubItem[] = [];
  if (details.groups_family) {
    grupoItems.push({
      key: 'grupo-familiar', label: 'Grupo Familiar', status: 'DONE',
      data: details.groups_family?.items || [],
    });
  }
  if (details.groups_economic) {
    grupoItems.push({
      key: 'grupo-economico', label: 'Grupo Econômico', status: 'DONE',
      data: details.groups_economic?.items || [],
    });
  }
  if (grupoItems.length > 0) {
    result['grupos'] = grupoItems;
  }

  return result;
}

// ─── Compliance Renderer (Ambiental + Trabalhista accordion style) ───
function ComplianceContent({ items }: { items: SubItem[] }) {
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
  const ls = items[0]?.data || {};
  const list: any[] = ls.items || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<any | null>(null);

  const total = (ls.active || 0) + (ls.inactive || 0) + (ls.indefinite || 0);
  const civil = ls.civil || 0;
  const criminal = ls.criminal || 0;
  const trabalhista = ls.labour || 0;

  const filtered = list.filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (p.Number || '').toLowerCase().includes(s) ||
           (p.MainSubject || '').toLowerCase().includes(s) ||
           (p.CourtName || '').toLowerCase().includes(s);
  });

  function getNatureBadge(nature: string) {
    const n = nature.toLowerCase();
    const cls = n.includes('cível') || n.includes('civil') ? 'bg-blue-100 text-blue-700' :
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
              <span>Ativo <strong className="text-foreground">{ls.active || 0}</strong></span>
              <span>Passivo <strong className="text-foreground">{ls.defendant || 0}</strong></span>
              <span>Outros <strong className="text-foreground">{ls.indefinite || 0}</strong></span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
            <div className="flex gap-4 mt-2 text-xs">
              <div><p className="text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground">{ls.active || 0}</p></div>
              <div><p className="text-muted-foreground">Finalizados</p><p className="text-lg font-bold text-foreground">{ls.inactive || 0}</p></div>
              <div><p className="text-muted-foreground">Indefinidos</p><p className="text-lg font-bold text-foreground">{ls.indefinite || 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Natureza</p>
            <div className="flex gap-4 mt-2 text-xs">
              <div><p className="text-muted-foreground">Cível</p><p className="text-lg font-bold text-foreground">{civil}</p></div>
              <div><p className="text-muted-foreground">Trabalhista</p><p className="text-lg font-bold text-foreground">{trabalhista}</p></div>
              <div><p className="text-muted-foreground">Criminal</p><p className="text-lg font-bold text-foreground">{criminal}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Procedimento</p>
            <div className="mt-2">
              <p className="text-muted-foreground text-xs">Execução</p>
              <p className="text-lg font-bold text-primary">{list.filter((p: any) => (p.Nature || '').toLowerCase().includes('execu')).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Número do processo"
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
      <p className="text-[11px] font-semibold text-muted-foreground uppercase">{label}</p>
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
    const lawsuitId = process?.LawsuitId || process?._id || process?.id;
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
      if (error || !data?.data) {
        setLoadingError(error?.message || 'Não foi possível carregar o detalhe completo do processo.');
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailField label="Data Início" value={p.StartDate ? formatDate(p.StartDate) : p.DistributionDate ? formatDate(p.DistributionDate) : p.PublicationDate ? formatDate(p.PublicationDate) : '—'} />
            <DetailField label="Data Distribuição" value={p.DistributionDate ? formatDate(p.DistributionDate) : '—'} />
            <DetailField label="Última Atualização" value={p.LastUpdate ? formatDate(p.LastUpdate) : p.LastMovementDate ? formatDate(p.LastMovementDate) : '—'} />
            <DetailField label="Valor da Causa" value={typeof p.Value === 'number' ? formatCurrency(p.Value) : p.Value} />
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
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{title}</p>
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
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{title}</p>
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
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{title}</p>
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Ban className="h-10 w-10 text-muted-foreground/20 mb-3" />
      <p className="text-base font-semibold text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── Main component ───
interface Props {
  data: Record<string, any>;
  agriskClientId?: string | null;
}

export function ConsultaClienteDetailView({ data: rawData, agriskClientId }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const normalized = normalizeResponseData(rawData);

  const categorizedData = CATEGORIES
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
      <div className="flex items-center gap-1 border-b border-border">
        {categorizedData.map(cat => {
          const Icon = cat.icon;
          const isActive = cat.key === selectedKey;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {selectedCat ? (
          selectedCat.key === 'compliance' ? <ComplianceContent items={selectedCat.items} /> :
          selectedCat.key === 'juridico' ? <LawsuitsContent items={selectedCat.items} agriskClientId={agriskClientId} /> :
          selectedCat.key === 'grupos' ? <GruposContent items={selectedCat.items} /> :
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
