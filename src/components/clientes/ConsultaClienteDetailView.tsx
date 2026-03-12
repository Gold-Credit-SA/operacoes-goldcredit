import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Scale, Leaf,
  Building2, FileText, Users, Database, Ban, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Category definitions ───
const CATEGORIES: { key: string; label: string; icon: any; keys: string[] }[] = [
  { key: 'compliance', label: 'Compliance', icon: Shield, keys: ['criminal', 'labour', 'kyc'] },
  { key: 'ambiental', label: 'Ambiental', icon: Leaf, keys: ['ibama', 'icmbio', 'sema'] },
  { key: 'cnds', label: 'CNDs Estaduais', icon: FileText, keys: ['cnds-list'] },
  { key: 'juridico', label: 'Judicial', icon: Scale, keys: ['lawsuits'] },
  { key: 'grupos', label: 'Grupos', icon: Users, keys: ['grupo-familiar', 'grupo-economico'] },
  { key: 'dados_basicos', label: 'Contatos', icon: Database, keys: ['emails', 'telefones', 'enderecos'] },
  { key: 'bndes', label: 'BNDES', icon: Building2, keys: ['bndes'] },
  { key: 'bvs', label: 'Boa Vista', icon: FileText, keys: ['bvs'] },
];

// ─── Helpers ───
function formatDate(val: string): string {
  try { return format(new Date(val), 'dd/MM/yyyy HH:mm'); } catch { return val; }
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}




// ─── Transform new API format ───
interface SubItem {
  key: string;
  label: string;
  data: any;
  status: string;
}

function normalizeResponseData(rawData: Record<string, any>): Record<string, SubItem[]> {
  const result: Record<string, SubItem[]> = {};

  // Handle formats: { details: { ... } } OR flat { compliance, bvs, lawsuits, ... }
  const details = rawData?.details || rawData;
  if (!details || typeof details !== 'object') return result;

  // ── Compliance ──
  const compliance = details.compliance?.item || details.compliance;
  if (compliance) {
    const complianceItems: SubItem[] = [];

    // Criminal
    if (compliance.criminal) {
      const c = compliance.criminal;
      complianceItems.push({
        key: 'criminal',
        label: 'Antecedentes Criminais',
        status: 'DONE',
        data: {
          'Ficha Criminal': c.criminalRecord?.cleanRecord ? 'Nada consta' : 'Possui registro',
          'Mandados de Prisão': c.warrants?.quant === 0 ? 'Nenhum mandado encontrado' : `${c.warrants?.quant} mandado(s)`,
        }
      });
    }

    // Labour
    if (compliance.labour) {
      const l = compliance.labour;
      complianceItems.push({
        key: 'labour',
        label: 'Trabalhista',
        status: 'DONE',
        data: {
          'PEP (Pessoa Politicamente Exposta)': l.IsPep ? 'Sim' : 'Não',
          'Trabalho Escravo': l.IsSlaveLabour ? 'Listado' : 'Não listado',
          'TST Status': l.tst?.status ? l.tst.status.charAt(0).toUpperCase() + l.tst.status.slice(1) : '—',
        }
      });
    }

    if (complianceItems.length > 0) {
      result['compliance'] = complianceItems;
    }
  }

  // ── Ambiental ──
  const envData = compliance?.environmental;
  if (envData) {
    const ambientalItems: SubItem[] = [];

    if (envData.ibama) {
      const ibama = envData.ibama;
      const details_ibama: Record<string, any> = {};

      if (ibama.ibamaCND) {
        details_ibama['CND Status'] = ibama.ibamaCND.content?.length === 0 ? 'Nada consta' : `${ibama.ibamaCND.content?.length} registro(s)`;
        if (ibama.ibamaCND.fileUrl) details_ibama['CND Arquivo'] = ibama.ibamaCND.fileUrl;
      }
      if (ibama.embargos) {
        details_ibama['Embargos'] = ibama.embargos.content?.length === 0 ? 'Nenhum embargo' : `${ibama.embargos.content?.length} embargo(s)`;
        if (ibama.embargos.fileUrl) details_ibama['Embargos Arquivo'] = ibama.embargos.fileUrl;
      }
      if (ibama.assessments) {
        details_ibama['Autuações'] = ibama.assessments.content?.length === 0 ? 'Nenhuma autuação' : `${ibama.assessments.content?.length} autuação(ões)`;
        if (ibama.assessments.fileUrl) details_ibama['Autuações Arquivo'] = ibama.assessments.fileUrl;
      }

      ambientalItems.push({ key: 'ibama', label: 'IBAMA', status: 'DONE', data: details_ibama });
    }

    if (envData.icmbio) {
      ambientalItems.push({
        key: 'icmbio', label: 'ICMBIO', status: 'DONE',
        data: {
          'Embargos': envData.icmbio.embargos?.embargo ? 'Possui embargo' : 'Sem embargos',
          'Detalhes': envData.icmbio.embargos?.details?.length > 0 ? envData.icmbio.embargos.details : 'Nenhum detalhe',
        }
      });
    }

    if (envData.sema) {
      ambientalItems.push({
        key: 'sema', label: 'SEMA', status: 'DONE',
        data: {
          'Resultados': envData.sema.semaResultsLenth === 0 ? 'Nenhum resultado' : `${envData.sema.semaResultsLenth} resultado(s)`,
        }
      });
    }

    if (ambientalItems.length > 0) {
      result['ambiental'] = ambientalItems;
    }
  }

  // ── CNDs Estaduais ──
  const taxData = compliance?.tax;
  if (taxData?.cnd && Array.isArray(taxData.cnd) && taxData.cnd.length > 0) {
    result['cnds'] = [{
      key: 'cnds-list',
      label: 'CNDs Estaduais',
      status: 'DONE',
      data: taxData.cnd,
    }];
  }

  // ── Lawsuits ──
  if (details.lawsuits) {
    const ls = details.lawsuits;
    result['juridico'] = [{
      key: 'lawsuits',
      label: 'Processos Judiciais',
      status: 'DONE',
      data: ls,
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

  // ── Contatos ──
  if (details.contacts) {
    const contactItems: SubItem[] = [];
    if (details.contacts.emails) {
      contactItems.push({ key: 'emails', label: 'E-mails', status: 'DONE', data: details.contacts.emails });
    }
    if (details.contacts.phones) {
      contactItems.push({ key: 'telefones', label: 'Telefones', status: 'DONE', data: details.contacts.phones });
    }
    if (details.contacts.addresses) {
      contactItems.push({ key: 'enderecos', label: 'Endereços', status: 'DONE', data: details.contacts.addresses });
    }
    if (contactItems.length > 0) {
      result['dados_basicos'] = contactItems;
    }
  }

  // ── BNDES ──
  if (details.bndes) {
    result['bndes'] = [{
      key: 'bndes', label: 'BNDES', status: 'DONE',
      data: details.bndes?.items || [],
    }];
  }

  // ── BVS ──
  if (details.bvs) {
    result['bvs'] = [{
      key: 'bvs', label: 'Boa Vista (BVS)', status: 'DONE',
      data: details.bvs,
    }];
  }

  return result;
}

// ─── Renderers ───

function ComplianceContent({ items }: { items: SubItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Compliance / KYC</h2>
      <div className="space-y-4">
        {items.map(item => (
          <Card key={item.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(item.data || {}).map(([key, val]) => {
                  if (typeof val === 'string' && (val.endsWith('.pdf') || val.includes('/certificates/'))) {
                    return (
                      <div key={key} className="flex gap-3 text-sm items-center">
                        <span className="text-muted-foreground min-w-[180px] shrink-0">{key}</span>
                        <a href={buildPdfProxyUrl(val)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                          <ExternalLink className="h-3 w-3" /> Abrir PDF
                        </a>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[180px] shrink-0">{key}</span>
                      <span className="text-foreground">{String(val)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AmbientalContent({ items }: { items: SubItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Ambiental</h2>
      <div className="space-y-4">
        {items.map(item => (
          <Card key={item.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(item.data || {}).map(([key, val]) => {
                  if (typeof val === 'string' && (val.endsWith('.pdf') || val.includes('/certificates/'))) {
                    return (
                      <div key={key} className="flex gap-3 text-sm items-center">
                        <span className="text-muted-foreground min-w-[160px] shrink-0">{key}</span>
                        <a href={buildPdfProxyUrl(val)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                          <ExternalLink className="h-3 w-3" /> Abrir PDF
                        </a>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[160px] shrink-0">{key}</span>
                      <span className="text-foreground">{String(val)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CNDsContent({ items }: { items: SubItem[] }) {
  const cndList = items[0]?.data || [];
  if (!Array.isArray(cndList) || cndList.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">CNDs Estaduais</h2>
        <EmptyState title="Sem CNDs" description="Nenhuma CND estadual encontrada." />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">CNDs Estaduais</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {cndList.length} certidão(ões) encontrada(s)
      </p>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Expedição</TableHead>
                  <TableHead className="w-[60px]">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cndList.map((cnd: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{cnd.state || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {(cnd.status || '').toLowerCase() === 'negativa' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="text-sm capitalize">{cnd.status || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {cnd.certificate || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {cnd.expedition ? formatDate(cnd.expedition) : '—'}
                    </TableCell>
                    <TableCell>
                      {cnd.fileUrl && (
                        <a href={buildPdfProxyUrl(cnd.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                          <ExternalLink className="h-3 w-3" /> PDF
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LawsuitsContent({ items }: { items: SubItem[] }) {
  const ls = items[0]?.data || {};
  const list = ls.items || [];

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Processos Judiciais</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total', value: (ls.active || 0) + (ls.inactive || 0) + (ls.indefinite || 0) },
          { label: 'Ativos', value: ls.active || 0 },
          { label: 'Inativos', value: ls.inactive || 0 },
          { label: 'Autor', value: ls.author || 0 },
        ].map(s => (
          <Card key={s.label}><CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Cível', value: ls.civil || 0 },
          { label: 'Criminal', value: ls.criminal || 0 },
          { label: 'Réu', value: ls.defendant || 0 },
        ].map(s => (
          <Card key={s.label}><CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Sem Processos" description="Nenhum processo judicial encontrado." />
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
                  {list.map((p: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{p.CourtName || '—'}</TableCell>
                      <TableCell className="text-xs">{p.State || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{p.Number || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", 
                            p.Polarity === 'Ativo' ? 'border-red-500/30 text-red-600' : 'border-blue-500/30 text-blue-600'
                          )}
                        >
                          {p.Polarity || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]",
                            p.Status === 'INATIVO' || p.Status === 'BAIXADO' ? 'border-green-500/30 text-green-600' : 'border-amber-500/30 text-amber-600'
                          )}
                        >
                          {p.Status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.Value ? formatCurrency(p.Value) : '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {p.MainSubject || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GruposContent({ items }: { items: SubItem[] }) {
  const familiar = items.find(i => i.key === 'grupo-familiar');
  const economico = items.find(i => i.key === 'grupo-economico');

  const renderGrupo = (item: SubItem | undefined, title: string, emptyMsg: string) => {
    if (!item) return null;
    const members = Array.isArray(item.data) ? item.data : [];

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
              {members.map((m: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-foreground uppercase">{m.name || '—'}</p>
                    {m.taxId && <p className="text-xs text-muted-foreground">{m.taxId}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {m.type && <Badge variant="outline" className="text-xs">{m.type}</Badge>}
                    {m.level && <Badge variant="secondary" className="text-[10px]">{m.level}</Badge>}
                  </div>
                </div>
              ))}
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
        {renderGrupo(familiar, 'Familiar', 'Não foram identificados familiares.')}
        {renderGrupo(economico, 'Econômico', 'Não foram identificadas empresas.')}
      </div>
    </div>
  );
}

function ContactsContent({ items }: { items: SubItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Contatos</h2>
      <div className="space-y-4">
        {items.map(item => {
          const arr = Array.isArray(item.data) ? item.data : [];
          return (
            <Card key={item.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {arr.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                ) : (
                  <div className="space-y-2">
                    {arr.map((entry: any, idx: number) => (
                      <div key={idx} className="text-sm text-foreground border-b border-border pb-2 last:border-0">
                        {typeof entry === 'string' ? entry : JSON.stringify(entry)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GenericListContent({ title, items }: { title: string; items: SubItem[] }) {
  const item = items[0];
  const arr = Array.isArray(item?.data) ? item.data : [];
  const obj = !Array.isArray(item?.data) && typeof item?.data === 'object' ? item.data : null;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">{title}</h2>
      {arr.length === 0 && !obj ? (
        <EmptyState title={`Sem ${title}`} description="Nenhum registro encontrado." />
      ) : obj ? (
        <Card>
          <CardContent className="pt-4">
            {obj.message ? (
              <p className="text-sm text-muted-foreground">
                {Array.isArray(obj.message) ? obj.message.join(', ') : obj.message}
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(obj).filter(([k]) => k !== 'statusCode').map(([key, val]) => (
                  <div key={key} className="flex gap-3 text-sm">
                    <span className="text-muted-foreground min-w-[140px] shrink-0">{key}</span>
                    <span className="text-foreground">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {arr.map((entry: any, idx: number) => (
                <div key={idx} className="text-sm text-foreground border-b border-border pb-2 last:border-0">
                  {typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Ban className="h-12 w-12 text-muted-foreground/20 mb-3" />
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

  // Build categorized list
  const categorizedData = CATEGORIES
    .filter(cat => normalized[cat.key] && normalized[cat.key].length > 0)
    .map(cat => ({
      ...cat,
      items: normalized[cat.key],
    }));

  const selectedKey = activeCategory || (categorizedData[0]?.key || null);
  const selectedCat = categorizedData.find(c => c.key === selectedKey);

  const totalCategories = categorizedData.length;

  return (
    <div className="flex gap-0 min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-[200px] shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Consulta Cliente</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-green-600 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> {totalCategories} categorias
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
                  <span className="text-[10px] tabular-nums text-green-600">{cat.items.length}</span>
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
          selectedCat.key === 'ambiental' ? <AmbientalContent items={selectedCat.items} /> :
          selectedCat.key === 'cnds' ? <CNDsContent items={selectedCat.items} /> :
          selectedCat.key === 'juridico' ? <LawsuitsContent items={selectedCat.items} /> :
          selectedCat.key === 'grupos' ? <GruposContent items={selectedCat.items} /> :
          selectedCat.key === 'dados_basicos' ? <ContactsContent items={selectedCat.items} /> :
          selectedCat.key === 'bvs' ? <GenericListContent title="Boa Vista (BVS)" items={selectedCat.items} /> :
          selectedCat.key === 'bndes' ? <GenericListContent title="BNDES" items={selectedCat.items} /> :
          <GenericListContent title={selectedCat.label} items={selectedCat.items} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Selecione uma categoria na barra lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
}
