import { useMemo } from 'react';
import {
  Shield, CreditCard, TrendingUp, AlertTriangle, MapPin,
  Activity, Clock, FileWarning, CheckCircle2, Gauge, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoSerasa from '@/assets/logo-serasa.png';
import logoHbi from '@/assets/logo-hbi.png';
import logoAgrisk from '@/assets/logo-agrisk.png';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
}

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
}

interface Props {
  client: ClientRecord;
  history: HistoryEntry[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const ALWAYS_LIMITE = ['1909', '1905'];
const CONDITIONAL_LIMITE = ['0208', '0214', '0207', '1901', '1902', '1903', '1904'];

function isLimiteOp(op: any): boolean {
  if (ALWAYS_LIMITE.includes(op?.mod)) return true;
  if (CONDITIONAL_LIMITE.includes(op?.mod)) {
    return !Object.entries(op?.resVenc || {}).some(([k, v]) => {
      const num = parseInt(k.replace('v', ''));
      return num >= 110 && num < 250 && (v as number) > 0;
    });
  }
  return false;
}

function fmt(v: number) {
  if (!v) return 'R$ 0';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFull(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return 0;
    const normalized = /^-?\d{1,3}(\.\d{3})*,\d+$/.test(raw)
      ? raw.replace(/\./g, '').replace(',', '.')
      : /^-?\d+,\d+$/.test(raw) ? raw.replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function pickValue(source: any, paths: string[], fallback?: any): any {
  for (const path of paths) {
    const v = path.split('.').reduce<any>((acc, key) => acc?.[key], source);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}

function latestByPlatform(entries: HistoryEntry[], platform: string) {
  return entries
    .filter((e) => e.platform === platform && e.status === 'success')
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] || null;
}

function allByPlatform(entries: HistoryEntry[], platform: string) {
  return entries
    .filter((e) => e.platform === platform && e.status === 'success')
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

// ─────────────────────────────────────────────
// Serasa extraction
// ─────────────────────────────────────────────
function extractSerasa(entry: HistoryEntry | null) {
  if (!entry?.result_data) return null;
  const raw: any = entry.result_data;
  const report = raw?.data?.reports?.[0] || raw?.reports?.[0] || raw?.data?.report
    || raw?.report || raw?.result?.report || raw?.data || raw;
  if (!report || typeof report !== 'object') return null;

  const directScore = (report?.score || {}) as any;
  const scoreResults = asArray(
    report?.scores?.scoreResponse
    || report?.optionalFeatures?.scores?.scoreResponse
    || report?.score?.scoreResponse?.results
    || report?.score?.results
  );
  const mainScore = directScore?.score
    ? directScore
    : scoreResults.find((s: any) => !String(s?.scoreModel || '').startsWith('HLC')) || null;
  const score = mainScore ? toNumber(mainScore.score ?? mainScore.scorePoints) : null;
  const limiteScore = scoreResults.find((s: any) => String(s?.scoreModel || '').startsWith('HLC'));
  const limiteSugerido = limiteScore ? toNumber(limiteScore.score ?? limiteScore.scorePoints) : null;

  const negativeData = (report?.negativeData || {}) as any;

  const pefin = asArray(negativeData?.pefinResponse || negativeData?.pefin || negativeData?.pefinResponse?.pefins);
  const refin = asArray(negativeData?.refinResponse || negativeData?.refin);
  const protSec = (negativeData?.notaryResponse || negativeData?.notary || negativeData?.protestResponse || negativeData?.protest || {}) as any;
  const protList = asArray(protSec?.notaryResponse || protSec?.protestResponse || protSec?.results || protSec);
  const lawSec = (negativeData?.judgmentFilingResponse || negativeData?.lawSuit || negativeData?.lawsuitResponse || {}) as any;
  const lawList = asArray(lawSec?.judgmentFilingResponse || lawSec?.lawSuit || lawSec?.results || lawSec);
  const checkSec = (negativeData?.checkResponse || negativeData?.check || {}) as any;
  const checkList = asArray(checkSec?.checkResponse || checkSec?.results || checkSec);

  const pefinCount = toNumber(pickValue(negativeData?.pefinResponse, ['summary.count'], pefin.length));
  const refinCount = toNumber(pickValue(negativeData?.refinResponse, ['summary.count'], refin.length));
  const protestos = toNumber(pickValue(protSec, ['summary.count'], protList.length));
  const acoes = toNumber(pickValue(lawSec, ['summary.count'], lawList.length));
  const cheques = toNumber(pickValue(checkSec, ['summary.count'], checkList.length));

  const totalRestricoes = pefinCount + refinCount + protestos + acoes + cheques;

  const valorPefin = toNumber(pickValue(negativeData?.pefinResponse, ['summary.balance'],
    pefin.reduce((s: number, p: any) => s + toNumber(p.balance || p.amount), 0)));
  const valorRefin = toNumber(pickValue(negativeData?.refinResponse, ['summary.balance'],
    refin.reduce((s: number, p: any) => s + toNumber(p.balance || p.amount), 0)));
  const valorProtestos = toNumber(pickValue(protSec, ['summary.balance'],
    protList.reduce((s: number, p: any) => s + toNumber(p.amount || p.balance), 0)));

  const valorTotalRestricoes = valorPefin + valorRefin + valorProtestos;

  return {
    score, limiteSugerido, totalRestricoes,
    pefinCount, refinCount, protestos, acoes, cheques,
    valorTotalRestricoes,
    breakdown: [
      { name: 'PEFIN', count: pefinCount, valor: valorPefin },
      { name: 'REFIN', count: refinCount, valor: valorRefin },
      { name: 'Protestos', count: protestos, valor: valorProtestos },
      { name: 'Ações', count: acoes, valor: 0 },
      { name: 'Cheques', count: cheques, valor: 0 },
    ].filter(r => r.count > 0),
  };
}

// ─────────────────────────────────────────────
// SCR extraction
// ─────────────────────────────────────────────
function extractSCR(entry: HistoryEntry | null) {
  if (!entry?.result_data) return null;
  const raw: any = entry.result_data;
  const response = raw?.response || raw?.data?.response || raw;
  let lsDtb = response?.lsDtb || raw?.data?.lsDtb;
  if (!Array.isArray(lsDtb) || lsDtb.length === 0) return null;

  const sorted = [...lsDtb].sort((a: any, b: any) => b.dtb - a.dtb);
  const validEntries = sorted.filter((d: any) => Array.isArray(d.lsOp) && d.lsOp.length > 0);
  const current = validEntries[0] || sorted[0];
  if (!current) return null;

  const ops = (current.lsOp || []).filter((op: any) => !isLimiteOp(op));
  const limiteOps = (current.lsOp || []).filter((op: any) => isLimiteOp(op));

  let totalAVencer = 0, totalVencido = 0, totalLimites = 0;
  ops.forEach((op: any) => {
    const rv = op.resVenc || {};
    totalAVencer += (rv.v110 || 0) + (rv.v120 || 0) + (rv.v130 || 0) + (rv.v140 || 0) + (rv.v150 || 0) + (rv.v160 || 0);
    totalVencido += (rv.v10 || 0) + (rv.v20 || 0) + (rv.v30 || 0) + (rv.v40 || 0) + (rv.v50 || 0);
  });
  limiteOps.forEach((op: any) => {
    const rv = op.resVenc || {};
    totalLimites += Object.values(rv).reduce<number>((s, v) => s + ((v as number) || 0), 0);
  });

  const evolution = validEntries.slice(0, 12).reverse().map((d: any) => {
    let av = 0, vc = 0;
    (d.lsOp || []).filter((op: any) => !isLimiteOp(op)).forEach((op: any) => {
      const rv = op.resVenc || {};
      av += (rv.v110 || 0) + (rv.v120 || 0) + (rv.v130 || 0) + (rv.v140 || 0) + (rv.v150 || 0) + (rv.v160 || 0);
      vc += (rv.v10 || 0) + (rv.v20 || 0) + (rv.v30 || 0) + (rv.v40 || 0) + (rv.v50 || 0);
    });
    const dtbStr = String(d.dtb);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      month: `${months[parseInt(dtbStr.slice(4, 6)) - 1] || ''}/${dtbStr.slice(2, 4)}`,
      aVencer: av,
      vencido: vc,
    };
  });

  const inadimplenciaPerc = totalAVencer + totalVencido > 0
    ? ((totalVencido / (totalAVencer + totalVencido)) * 100)
    : 0;

  const dtbStr = String(current.dtb);
  const mm = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dtbLabel = `${mm[parseInt(dtbStr.slice(4, 6)) - 1] || ''}/${dtbStr.slice(0, 4)}`;

  return {
    totalAVencer, totalVencido, totalLimites,
    totalCarteira: totalAVencer + totalVencido,
    qtdIfs: current.qtdIfs || 0,
    qtdOps: ops.length,
    dtbLabel, evolution, inadimplenciaPerc,
  };
}

// ─────────────────────────────────────────────
// AgRisk extraction — agrega consulta_cliente, imoveis e veicular
// ─────────────────────────────────────────────
function extractAgrisk(entries: HistoryEntry[]) {
  if (!entries.length) return null;

  let totalAreaRural = 0;
  let qtdImoveisRural = 0;
  let qtdImoveisUrbanos = 0;
  let valorImoveis = 0;
  let qtdVeiculos = 0;
  let valorVeiculos = 0;
  let processosTotal = 0;
  let processosAtivos = 0;
  let processosPassivos = 0;
  let valorProcessos = 0;
  let protestosTotal = 0;
  let valorProtestos = 0;
  let bndesItens = 0;
  let scrMessage: string | null = null;
  let sintegraQtd = 0;
  let sintegraAtivos = 0;
  let qtdContatos = 0;
  let qtdEnderecos = 0;
  let gruposFamilia = 0;
  let gruposEconomicos = 0;
  const breakdownAreas = { propria: 0, sociedade: 0, arrendada: 0, parceria: 0 };
  let consultadoEm: string | null = null;
  let foundAny = false;

  for (const entry of entries) {
    const raw: any = entry.result_data;
    if (!raw) continue;
    if (!consultadoEm || +new Date(entry.created_at) > +new Date(consultadoEm)) {
      consultadoEm = entry.created_at;
    }
    const root = raw?.result || raw?.data || raw;
    const details = root?.details || root;

    // ── Consulta Cliente (details.{lawsuits,protests,bndes,scr,contacts,sintegra,groups_family,groups_economic})
    if (details?.lawsuits) {
      foundAny = true;
      const l = details.lawsuits;
      processosTotal += toNumber(l.total ?? l.todos);
      processosAtivos += toNumber(l.active ?? l.ativo);
      processosPassivos += toNumber(l.passivo);
    }
    if (details?.protests) {
      foundAny = true;
      const p = details.protests;
      protestosTotal += toNumber(p.totalCompanies);
      valorProtestos += toNumber(p.valueTotalOfProtests);
    }
    if (details?.bndes?.items) {
      foundAny = true;
      bndesItens += asArray(details.bndes.items).length;
    }
    if (details?.scr?.message) {
      foundAny = true;
      scrMessage = Array.isArray(details.scr.message) ? details.scr.message.join(' ') : String(details.scr.message);
    }
    if (details?.contacts) {
      foundAny = true;
      qtdContatos += asArray(details.contacts.emails).length + asArray(details.contacts.phones).length;
      qtdEnderecos += asArray(details.contacts.addresses).length;
    }
    if (details?.sintegra?.items) {
      foundAny = true;
      const items = asArray(details.sintegra.items);
      sintegraQtd += items.length;
      sintegraAtivos += items.filter((s: any) => String(s?.status || '').toLowerCase().includes('habilitado') && !String(s?.status || '').toLowerCase().includes('não')).length;
    }
    if (details?.groups_family?.items) {
      gruposFamilia += asArray(details.groups_family.items).length;
    }
    if (details?.groups_economic?.items) {
      gruposEconomicos += asArray(details.groups_economic.items).length;
    }

    // ── Imóveis (root.rural / root.urban)
    if (root?.rural || root?.urban) {
      foundAny = true;
      const rural = root.rural || {};
      totalAreaRural += toNumber(rural.totalArea);
      const props = rural.properties || {};
      qtdImoveisRural += toNumber(props.owned) + toNumber(props.leased) + toNumber(props.inSociety) + toNumber(props.partnership);
      breakdownAreas.propria += toNumber(rural.areas?.owned);
      breakdownAreas.sociedade += toNumber(rural.areas?.inSociety);
      breakdownAreas.arrendada += toNumber(rural.areas?.leased);
      breakdownAreas.parceria += toNumber(rural.areas?.partnership);
      valorImoveis += toNumber(rural.totalValue);
      const urban = root.urban || {};
      qtdImoveisUrbanos += toNumber(urban.totalProperties);
      valorImoveis += toNumber(urban.totalValueProperties);
    }

    // ── Veículos (root.items / root.totalValue / root.quantity)
    if (entry.consulta_type === 'patrimonio_veicular' || (root?.product?.code === 'vehicle-assets')) {
      foundAny = true;
      qtdVeiculos += toNumber(root?.quantity ?? asArray(root?.items).length);
      valorVeiculos += toNumber(root?.totalValue);
    }
  }

  if (!foundAny) return null;

  const valorPatrimonio = valorImoveis + valorVeiculos;

  return {
    totalAreaRural,
    qtdImoveisRural,
    qtdImoveisUrbanos,
    valorImoveis,
    qtdVeiculos,
    valorVeiculos,
    valorPatrimonio,
    processosTotal,
    processosAtivos,
    processosPassivos,
    valorProcessos,
    protestosTotal,
    valorProtestos,
    bndesItens,
    scrMessage,
    sintegraQtd,
    sintegraAtivos,
    qtdContatos,
    qtdEnderecos,
    gruposFamilia,
    gruposEconomicos,
    breakdownAreas,
    consultadoEm,
  };
}

// ─────────────────────────────────────────────
// Score helpers
// ─────────────────────────────────────────────
function getScoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground';
  if (score >= 600) return 'text-emerald-600';
  if (score >= 400) return 'text-amber-600';
  return 'text-destructive';
}

function getScoreFaixa(score: number | null) {
  if (score === null) return '—';
  if (score >= 700) return 'A · Baixo';
  if (score >= 500) return 'B · Moderado';
  if (score >= 300) return 'C · Alto';
  return 'D · Muito Alto';
}

function getRiskBadgeBg(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground border-border';
  if (score >= 600) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 400) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

// ─────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: {fmtFull(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Linha de resumo (label + value)
// ─────────────────────────────────────────────
function ResumoLinha({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-foreground', valueClass)}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export function ClienteCreditoConsolidadoCard({ client, history }: Props) {
  const serasa = useMemo(() => extractSerasa(latestByPlatform(history, 'serasa')), [history]);
  const scr = useMemo(() => extractSCR(latestByPlatform(history, 'scr')), [history]);
  const agrisk = useMemo(() => extractAgrisk(allByPlatform(history, 'agrisk')), [history]);

  const timeline = useMemo(() => {
    return history
      .filter(h => h.status === 'success')
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 8);
  }, [history]);

  const hasAnyData = serasa || scr || agrisk;

  if (!hasAnyData) {
    return (
      <Card className="mt-8 border-dashed">
        <CardContent className="py-10 text-center">
          <Gauge className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum birô consultado ainda. Faça uma consulta para gerar a análise consolidada do cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Score consolidado: usa o do Serasa se houver, senão deriva da inadimplência SCR
  const scoreConsolidado = serasa?.score ?? null;

  // Risco geral (combinação de sinais)
  const riscoGeral = (() => {
    let alerts = 0;
    if ((serasa?.totalRestricoes || 0) > 0) alerts++;
    if ((serasa?.score ?? 999) < 400) alerts += 2;
    else if ((serasa?.score ?? 999) < 600) alerts++;
    if ((scr?.inadimplenciaPerc ?? 0) > 5) alerts += 2;
    else if ((scr?.inadimplenciaPerc ?? 0) > 0) alerts++;
    if (alerts >= 3) return { label: 'ALTO', cls: 'bg-red-50 text-red-700 border-red-200' };
    if (alerts >= 1) return { label: 'MÉDIO', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'BAIXO', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  })();

  return (
    <Card className="mt-8 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" />
              Análise de Crédito do Cliente
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compilado consolidado de todos os birôs consultados.
            </p>
          </div>
          <Badge variant="outline" className={cn('text-xs font-semibold border', riscoGeral.cls)}>
            Risco Geral: {riscoGeral.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════ SCORES CONSOLIDADOS ════════ */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Scores e Indicadores
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Serasa Score */}
            <div className={cn(
              'rounded-lg border p-3 flex flex-col gap-1',
              getRiskBadgeBg(serasa?.score ?? null)
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                <img src={logoSerasa} alt="" className="h-3 w-auto" />
                Serasa
              </div>
              <div className={cn('text-2xl font-bold leading-none', getScoreColor(serasa?.score ?? null))}>
                {serasa?.score ?? '—'}
              </div>
              <div className="text-[10px] opacity-80">{getScoreFaixa(serasa?.score ?? null)}</div>
            </div>

            {/* SCR Carteira */}
            <div className="rounded-lg border bg-emerald-50/40 border-emerald-200 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                <img src={logoHbi} alt="" className="h-3 w-auto" />
                SCR · Carteira
              </div>
              <div className="text-lg font-bold text-emerald-900 leading-tight">
                {scr ? fmt(scr.totalCarteira) : '—'}
              </div>
              <div className="text-[10px] text-emerald-800/70">
                {scr ? `${scr.qtdIfs} IFs · ${scr.dtbLabel}` : 'Sem dados'}
              </div>
            </div>

            {/* SCR Inadimplência */}
            <div className={cn(
              'rounded-lg border p-3 flex flex-col gap-1',
              !scr ? 'bg-muted text-muted-foreground border-border'
                : scr.inadimplenciaPerc > 5 ? 'bg-red-50 border-red-200'
                : scr.inadimplenciaPerc > 0 ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                <Activity className="h-3 w-3" />
                Inadimplência
              </div>
              <div className="text-2xl font-bold leading-none">
                {scr ? `${scr.inadimplenciaPerc.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] opacity-70">
                {scr ? fmt(scr.totalVencido) + ' vencido' : 'Sem dados SCR'}
              </div>
            </div>

            {/* Restrições Serasa */}
            <div className={cn(
              'rounded-lg border p-3 flex flex-col gap-1',
              !serasa ? 'bg-muted text-muted-foreground border-border'
                : serasa.totalRestricoes === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                <Shield className="h-3 w-3" />
                Restrições
              </div>
              <div className="text-2xl font-bold leading-none">
                {serasa?.totalRestricoes ?? '—'}
              </div>
              <div className="text-[10px] opacity-70">
                {serasa
                  ? serasa.totalRestricoes === 0 ? 'Nada consta'
                    : fmt(serasa.valorTotalRestricoes)
                  : 'Sem consulta'}
              </div>
            </div>
          </div>
        </section>

        {/* ════════ GRÁFICOS SCR ════════ */}
        {scr && scr.evolution.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" />
              Endividamento SCR · Evolução
            </h3>
            <div className="rounded-lg border bg-card p-3">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">A vencer</p>
                  <p className="text-sm font-semibold text-emerald-700">{fmt(scr.totalAVencer)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Vencido</p>
                  <p className={cn('text-sm font-semibold',
                    scr.totalVencido > 0 ? 'text-red-700' : 'text-muted-foreground'
                  )}>{fmt(scr.totalVencido)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Limites</p>
                  <p className="text-sm font-semibold text-blue-700">{fmt(scr.totalLimites)}</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={scr.evolution} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-avencer" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="grad-vencido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={fmt} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="aVencer" name="A vencer" stroke="hsl(142, 76%, 36%)" fill="url(#grad-avencer)" strokeWidth={2} />
                  <Area type="monotone" dataKey="vencido" name="Vencido" stroke="hsl(0, 84%, 60%)" fill="url(#grad-vencido)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ════════ RESTRIÇÕES + PATRIMÔNIO ════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Restrições breakdown */}
          {serasa && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <FileWarning className="h-3.5 w-3.5" />
                Restrições e Negativações
              </h3>
              <div className="rounded-lg border bg-card p-3 h-full">
                {serasa.totalRestricoes === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mb-2" />
                    <p className="text-sm font-semibold text-emerald-700">Nada consta</p>
                    <p className="text-xs text-muted-foreground">Sem restrições no Serasa</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={serasa.breakdown} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          formatter={(value: any, name: any) => [value, name === 'count' ? 'Qtd' : name]}
                          contentStyle={{ fontSize: 11 }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {serasa.breakdown.map((_, i) => (
                            <Cell key={i} fill={['hsl(0,84%,60%)', 'hsl(20,84%,55%)', 'hsl(38,92%,50%)', 'hsl(280,60%,55%)', 'hsl(200,70%,50%)'][i % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Valor total em aberto</span>
                      <span className="font-semibold text-red-700">{fmtFull(serasa.valorTotalRestricoes)}</span>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* AgRisk — Patrimônio + Risco */}
          {agrisk && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Patrimônio e Risco · AgRisk
                <img src={logoAgrisk} alt="" className="h-3 w-auto ml-auto opacity-60" />
              </h3>
              <div className="rounded-lg border bg-card p-3 h-full space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/40 p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Imóveis rurais</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{agrisk.qtdImoveisRural}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {agrisk.totalAreaRural.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Veículos</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{agrisk.qtdVeiculos}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {agrisk.valorVeiculos > 0 ? fmt(agrisk.valorVeiculos) : 'Sem valor'}
                    </p>
                  </div>
                </div>

                {agrisk.valorPatrimonio > 0 && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5">
                    <p className="text-[10px] uppercase text-emerald-800">Patrimônio total</p>
                    <p className="text-lg font-bold text-emerald-900">{fmt(agrisk.valorPatrimonio)}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={cn('rounded-md border p-2',
                    agrisk.processosAtivos > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                  )}>
                    <p className="text-[10px] uppercase opacity-80">Processos</p>
                    <p className="font-semibold">
                      {agrisk.processosTotal === 0 ? 'Nada consta'
                        : `${agrisk.processosTotal} (${agrisk.processosAtivos} ativos)`}
                    </p>
                  </div>
                  <div className={cn('rounded-md border p-2',
                    agrisk.protestosTotal > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
                  )}>
                    <p className="text-[10px] uppercase opacity-80">Protestos</p>
                    <p className="font-semibold">
                      {agrisk.protestosTotal === 0 ? 'Nada consta'
                        : `${agrisk.protestosTotal} · ${fmt(agrisk.valorProtestos)}`}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ════════ RESUMO DETALHADO POR BIRÔ ════════ */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Resumo por birô
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* SERASA */}
            {serasa && (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 flex items-center gap-2">
                  <img src={logoSerasa} alt="" className="h-3.5 w-auto" />
                  <span className="text-xs font-semibold text-blue-900">Serasa</span>
                  <Badge variant="outline" className={cn('ml-auto text-[10px]', getRiskBadgeBg(serasa.score))}>
                    Score {serasa.score ?? '—'}
                  </Badge>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <ResumoLinha label="Faixa de risco" value={getScoreFaixa(serasa.score)} />
                  <ResumoLinha label="Limite sugerido" value={serasa.limiteSugerido ? fmt(serasa.limiteSugerido) : '—'} />
                  <ResumoLinha label="Total de restrições" value={String(serasa.totalRestricoes)}
                    valueClass={serasa.totalRestricoes > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'} />
                  {serasa.pefinCount > 0 && <ResumoLinha label="PEFIN" value={`${serasa.pefinCount} reg.`} />}
                  {serasa.refinCount > 0 && <ResumoLinha label="REFIN" value={`${serasa.refinCount} reg.`} />}
                  {serasa.protestos > 0 && <ResumoLinha label="Protestos" value={`${serasa.protestos} reg.`} />}
                  {serasa.acoes > 0 && <ResumoLinha label="Ações judiciais" value={`${serasa.acoes} reg.`} />}
                  {serasa.valorTotalRestricoes > 0 && (
                    <ResumoLinha label="Valor em aberto" value={fmtFull(serasa.valorTotalRestricoes)}
                      valueClass="text-red-700 font-semibold" />
                  )}
                </div>
              </div>
            )}

            {/* SCR */}
            {scr && (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center gap-2">
                  <img src={logoHbi} alt="" className="h-3.5 w-auto" />
                  <span className="text-xs font-semibold text-emerald-900">SCR · Bacen</span>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-white border-emerald-300 text-emerald-800">
                    {scr.dtbLabel}
                  </Badge>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <ResumoLinha label="Carteira ativa" value={fmt(scr.totalCarteira)} valueClass="font-semibold" />
                  <ResumoLinha label="A vencer" value={fmt(scr.totalAVencer)} valueClass="text-emerald-700" />
                  <ResumoLinha label="Vencido" value={fmt(scr.totalVencido)}
                    valueClass={scr.totalVencido > 0 ? 'text-red-700 font-semibold' : 'text-muted-foreground'} />
                  <ResumoLinha label="Limites concedidos" value={fmt(scr.totalLimites)} valueClass="text-blue-700" />
                  <ResumoLinha label="Inadimplência" value={`${scr.inadimplenciaPerc.toFixed(1)}%`}
                    valueClass={scr.inadimplenciaPerc > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'} />
                  <ResumoLinha label="Instituições financeiras" value={`${scr.qtdIfs} IF(s)`} />
                  <ResumoLinha label="Operações ativas" value={`${scr.qtdOps} op.`} />
                </div>
              </div>
            )}

            {/* AGRISK */}
            {agrisk && (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2">
                  <img src={logoAgrisk} alt="" className="h-3.5 w-auto" />
                  <span className="text-xs font-semibold text-amber-900">AgRisk</span>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-white border-amber-300 text-amber-800">
                    Cadastral
                  </Badge>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <ResumoLinha label="Área rural total" value={`${agrisk.totalAreaRural.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
                    valueClass="font-semibold" />
                  <ResumoLinha label="Imóveis rurais" value={`${agrisk.qtdImoveisRural}`} />
                  {agrisk.qtdImoveisUrbanos > 0 && (
                    <ResumoLinha label="Imóveis urbanos" value={`${agrisk.qtdImoveisUrbanos}`} />
                  )}
                  {agrisk.breakdownAreas.propria > 0 && (
                    <ResumoLinha label="Área própria" value={`${agrisk.breakdownAreas.propria.toFixed(1)} ha`}
                      valueClass="text-emerald-700" />
                  )}
                  {agrisk.breakdownAreas.arrendada > 0 && (
                    <ResumoLinha label="Área arrendada" value={`${agrisk.breakdownAreas.arrendada.toFixed(1)} ha`}
                      valueClass="text-amber-700" />
                  )}
                  <ResumoLinha label="Veículos" value={agrisk.qtdVeiculos > 0 ? `${agrisk.qtdVeiculos} (${fmt(agrisk.valorVeiculos)})` : 'Nenhum'} />
                  <ResumoLinha label="Processos judiciais" value={agrisk.processosTotal === 0 ? 'Nada consta' : `${agrisk.processosTotal}`}
                    valueClass={agrisk.processosTotal > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'} />
                  <ResumoLinha label="Protestos" value={agrisk.protestosTotal === 0 ? 'Nada consta' : `${agrisk.protestosTotal} · ${fmt(agrisk.valorProtestos)}`}
                    valueClass={agrisk.protestosTotal > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'} />
                  {agrisk.bndesItens > 0 && <ResumoLinha label="Operações BNDES" value={`${agrisk.bndesItens}`} />}
                  {agrisk.sintegraQtd > 0 && (
                    <ResumoLinha label="Inscrições Sintegra"
                      value={`${agrisk.sintegraQtd}${agrisk.sintegraAtivos > 0 ? ` (${agrisk.sintegraAtivos} ativas)` : ''}`} />
                  )}
                  {agrisk.gruposEconomicos > 0 && (
                    <ResumoLinha label="Grupos econômicos" value={`${agrisk.gruposEconomicos}`} />
                  )}
                  {agrisk.scrMessage && (
                    <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground italic">
                      {agrisk.scrMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ════════ TIMELINE ════════ */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Linha do tempo de consultas
          </h3>
          <div className="space-y-1.5">
            {timeline.map((entry) => {
              const platformLogo = entry.platform === 'serasa' ? logoSerasa
                : entry.platform === 'scr' ? logoHbi
                : entry.platform === 'agrisk' ? logoAgrisk
                : null;
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                  <div className="h-7 w-7 shrink-0 rounded-md bg-muted/40 flex items-center justify-center overflow-hidden">
                    {platformLogo
                      ? <img src={platformLogo} alt="" className="h-4 w-auto" />
                      : <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-xs">{entry.consulta_label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(entry.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    OK
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
