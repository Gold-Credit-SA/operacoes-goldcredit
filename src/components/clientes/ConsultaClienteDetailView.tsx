import { useState } from 'react';
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
function LawsuitsContent({ items }: { items: SubItem[] }) {
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

      {/* Summary cards row */}
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

      {/* Search */}
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

      {/* Compact card list */}
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

      {/* Detail dialog */}
      <Dialog open={!!selectedProcess} onOpenChange={(open) => !open && setSelectedProcess(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes do Processo</DialogTitle>
          </DialogHeader>
          {selectedProcess && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Número" value={selectedProcess.Number} mono />
                <DetailField label="Tribunal" value={selectedProcess.CourtName} />
                <DetailField label="UF" value={selectedProcess.State} />
                <DetailField label="Polo" value={selectedProcess.Polarity} />
                <DetailField label="Status" value={selectedProcess.Status} />
                <DetailField label="Natureza" value={selectedProcess.Nature} />
                <DetailField label="Valor" value={selectedProcess.Value ? formatCurrency(selectedProcess.Value) : '—'} />
                <DetailField label="Data Início" value={selectedProcess.StartDate ? formatDate(selectedProcess.StartDate) : '—'} />
              </div>
              <DetailField label="Assunto Principal" value={selectedProcess.MainSubject} />
              {selectedProcess.Parties && selectedProcess.Parties.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Partes</p>
                  <div className="space-y-2">
                    {selectedProcess.Parties.map((party: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm text-foreground">{party.Name || party.name || '—'}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {(party.Polarity || party.polarity || party.Type || party.type || '—').toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedProcess.Updates && selectedProcess.Updates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Movimentações</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedProcess.Updates.map((upd: any, i: number) => (
                      <div key={i} className="text-xs border-b border-border pb-2 last:border-0">
                        <span className="text-muted-foreground">{upd.Date ? formatDate(upd.Date) : ''}</span>
                        <p className="text-foreground mt-0.5">{upd.Description || upd.Content || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
}

export function ConsultaClienteDetailView({ data: rawData }: Props) {
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
    <div className="flex gap-0 min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-[200px] shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Consulta Cliente</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-green-600 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> {categorizedData.length} categorias
            </span>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          <nav className="py-1">
            {categorizedData.map(cat => {
              const Icon = cat.icon;
              const isActive = cat.key === selectedKey;

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
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        {selectedCat ? (
          selectedCat.key === 'compliance' ? <ComplianceContent items={selectedCat.items} /> :
          selectedCat.key === 'juridico' ? <LawsuitsContent items={selectedCat.items} /> :
          selectedCat.key === 'grupos' ? <GruposContent items={selectedCat.items} /> :
          null
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Selecione uma categoria na barra lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
}
