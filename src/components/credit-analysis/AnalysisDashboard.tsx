import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle, Building2, CheckCircle2, CreditCard, Shield,
  TrendingUp, TrendingDown, BarChart3, FileWarning, Users, Clock,
  DollarSign, Activity, Percent, FileText, ChevronDown, ChevronRight
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface SacadoEntry {
  cpf_cnpj: string;
  name: string | null;
}

interface AnalysisDashboardProps {
  analysis: any;
  clientConsultations: any;
  /** Live (re-fetched) consultations from the page; preferred over the snapshot in clientConsultations when present. */
  liveConsultations?: any;
  cedenteData: any;
  clientName: string | null;
  clientCpfCnpj: string | null;
  cedenteName: string | null;
  cedenteCpfCnpj?: string | null;
  /** Full list of sacados (for multi-sacado operations). */
  sacados?: SacadoEntry[];
}

const PIE_COLORS = [
  'hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)', 'hsl(200, 70%, 50%)',
  'hsl(340, 82%, 52%)', 'hsl(160, 60%, 40%)'
];

const MOD_LABELS: Record<string, string> = {
  '0208': 'Cheque Especial', '0214': 'Cheque Especial', '0207': 'Cartão Crédito',
  '0301': 'Empréstimo', '0401': 'Financiamento', '0101': 'Capital Giro',
  '0199': 'Outros Créd.', '0501': 'Financ. Imob.', '1909': 'Limite Créd.',
  '1905': 'Limite Créd.', '0601': 'Créd. Rural', '0701': 'Leasing',
  '1901': 'Limite Créd.', '1902': 'Limite Créd.', '1903': 'Limite Créd.', '1904': 'Limite Créd.',
};

const ALWAYS_LIMITE = ['1909', '1905'];
const CONDITIONAL_LIMITE = ['0208', '0214', '0207', '1901', '1902', '1903', '1904'];

function isLimiteOp(op: any): boolean {
  if (ALWAYS_LIMITE.includes(op.mod)) return true;
  if (CONDITIONAL_LIMITE.includes(op.mod)) {
    return !Object.entries(op.resVenc || {}).some(([k, v]) => {
      const num = parseInt(k.replace('v', ''));
      return num >= 110 && num < 250 && (v as number) > 0;
    });
  }
  return false;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function fmtFull(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function getModLabel(mod: string) {
  return MOD_LABELS[mod] || `Mod. ${mod}`;
}

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

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function pickValue<T = any>(source: Record<string, any> | undefined, paths: string[], fallback?: T): T | undefined {
  for (const path of paths) {
    const value = path.split('.').reduce<any>((acc, key) => acc?.[key], source);
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return fallback;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return 0;

    const normalized = /^-?\d{1,3}(\.\d{3})*,\d+$/.test(raw)
      ? raw.replace(/\./g, '').replace(',', '.')
      : /^-?\d+,\d+$/.test(raw)
        ? raw.replace(',', '.')
        : raw;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDefaultRate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.includes(',') || raw.includes('.')) {
    const parsed = toNumber(raw);
    return Number.isFinite(parsed) ? String(parsed) : null;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length >= 3) {
    return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  }

  return String(Number(digits));
}

// ─────────────────────────────────────────────
// SCR Data Extraction - matches SCRDetailView's parsing
// ─────────────────────────────────────────────
function extractSCRData(scrConsulta: any) {
  if (!scrConsulta?.data) return null;
  const raw = scrConsulta.data;

  // Navigate into the response structure (same as SCRDetailView)
  const response = raw?.response || raw?.data?.response || raw;
  let lsDtb = response?.lsDtb;
  if (!lsDtb) lsDtb = raw?.data?.lsDtb;
  if (!Array.isArray(lsDtb) || lsDtb.length === 0) return null;

  const sorted = [...lsDtb].sort((a: any, b: any) => b.dtb - a.dtb);
  const validEntries = sorted.filter((d: any) => Array.isArray(d.lsOp) && d.lsOp.length > 0);
  const current = validEntries[0] || sorted[0];
  if (!current) return null;

  const entityName = raw?.data?.name || raw?.name || response?.name || '';
  const ops = (current.lsOp || []).filter((op: any) => !isLimiteOp(op));
  const limiteOps = (current.lsOp || []).filter((op: any) => isLimiteOp(op));

  let totalAVencer = 0, totalVencido = 0, totalLimites = 0;
  const modalidades: Record<string, number> = {};
  const vencBuckets = { '1-30d': 0, '31-60d': 0, '61-90d': 0, '91-180d': 0, '181-360d': 0, '+360d': 0 };
  const vencidoBuckets = { '≤15d': 0, '+15d': 0, '1-30d': 0, '31-60d': 0, '61-90d': 0 };

  ops.forEach((op: any) => {
    const rv = op.resVenc || {};
    const av = (rv.v110 || 0) + (rv.v120 || 0) + (rv.v130 || 0) + (rv.v140 || 0) + (rv.v150 || 0) + (rv.v160 || 0);
    const vc = (rv.v10 || 0) + (rv.v20 || 0) + (rv.v30 || 0) + (rv.v40 || 0) + (rv.v50 || 0);

    vencBuckets['1-30d'] += rv.v110 || 0;
    vencBuckets['31-60d'] += rv.v120 || 0;
    vencBuckets['61-90d'] += rv.v130 || 0;
    vencBuckets['91-180d'] += rv.v140 || 0;
    vencBuckets['181-360d'] += rv.v150 || 0;
    vencBuckets['+360d'] += rv.v160 || 0;

    vencidoBuckets['≤15d'] += rv.v20 || 0;
    vencidoBuckets['+15d'] += rv.v10 || 0;
    vencidoBuckets['1-30d'] += rv.v30 || 0;
    vencidoBuckets['31-60d'] += rv.v40 || 0;
    vencidoBuckets['61-90d'] += rv.v50 || 0;

    totalAVencer += av;
    totalVencido += vc;

    const modLabel = getModLabel(op.mod || 'Outros');
    modalidades[modLabel] = (modalidades[modLabel] || 0) + av + vc;
  });

  limiteOps.forEach((op: any) => {
    const rv = op.resVenc || {};
    totalLimites += Object.values(rv).reduce<number>((s, v) => s + ((v as number) || 0), 0);
  });

  // Evolution from multiple periods
  const evolution = validEntries.slice(0, 12).reverse().map((d: any) => {
    let av = 0, vc = 0;
    (d.lsOp || []).filter((op: any) => !isLimiteOp(op)).forEach((op: any) => {
      const rv = op.resVenc || {};
      av += (rv.v110 || 0) + (rv.v120 || 0) + (rv.v130 || 0) + (rv.v140 || 0) + (rv.v150 || 0) + (rv.v160 || 0);
      vc += (rv.v10 || 0) + (rv.v20 || 0) + (rv.v30 || 0) + (rv.v40 || 0) + (rv.v50 || 0);
    });
    const dtbStr = String(d.dtb);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const m = parseInt(dtbStr.slice(4, 6));
    const y = dtbStr.slice(2, 4);
    return { month: `${months[m - 1] || m}/${y}`, aVencer: av, vencido: vc };
  });

  const modChart = Object.entries(modalidades)
    .map(([name, value]) => ({ name, value }))
    .filter(m => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const vencChart = Object.entries(vencBuckets).map(([name, value]) => ({ name, value }));
  const vencidoChart = Object.entries(vencidoBuckets).map(([name, value]) => ({ name, value })).filter(v => v.value > 0);

  const inadimplenciaPerc = totalAVencer + totalVencido > 0
    ? ((totalVencido / (totalAVencer + totalVencido)) * 100).toFixed(1)
    : '0.0';

  const dtbStr = String(current.dtb);
  const mm = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dtbLabel = `${mm[parseInt(dtbStr.slice(4, 6)) - 1]}/${dtbStr.slice(0, 4)}`;

  return {
    totalAVencer,
    totalVencido,
    totalLimites,
    totalCarteira: totalAVencer + totalVencido,
    qtdIfs: current.qtdIfs || 0,
    qtdOps: ops.length,
    dtbLabel,
    entityName,
    evolution,
    modalidades: modChart,
    vencChart,
    vencidoChart,
    inadimplenciaPerc,
  };
}

// ─────────────────────────────────────────────
// Serasa Data Extraction - matches SerasaDetailView's parsing
// ─────────────────────────────────────────────
function extractSerasaData(serasaConsulta: any) {
  if (!serasaConsulta?.data) return null;
  const raw = serasaConsulta.data;

   // Navigate: session/history can store direct report, {data:{reports}}, or other wrapped shapes
   const report = raw?.data?.reports?.[0]
     || raw?.reports?.[0]
     || raw?.data?.report
     || raw?.report
     || raw?.result?.report
     || raw;

  if (!report || typeof report !== 'object') return null;

   const directScore = (report?.score || {}) as Record<string, any>;
   const scoreResults = asArray(
     report?.scores?.scoreResponse
     || report?.optionalFeatures?.scores?.scoreResponse
     || report?.score?.scoreResponse?.results
     || report?.score?.ScoreResponse?.results
     || report?.score?.results
   );

   const mainScore = directScore?.score
     ? directScore
     : scoreResults.find((s) => !String(s?.scoreModel || '').startsWith('HLC')) || null;

   const score = mainScore ? toNumber(mainScore.score ?? mainScore.scorePoints) : null;
   const scoreModel = String(mainScore?.scoreModel || '');
   const defaultRate = parseDefaultRate(mainScore?.defaultRate);

   const limiteScore = scoreResults.find((s) => String(s?.scoreModel || '').startsWith('HLC'));
   const limiteSugerido = limiteScore ? toNumber(limiteScore.score ?? limiteScore.scorePoints) : null;

   const negativeData = (report?.negativeData || {}) as Record<string, any>;

   const pefinSection = (negativeData?.pefinResponse || negativeData?.pefin || {}) as Record<string, any>;
   const pefin = asArray(pefinSection?.pefinResponse || pefinSection?.ppiResponse || pefinSection?.results || pefinSection);
   const pefinCount = toNumber(pickValue(pefinSection, ['summary.count'], pefin.length));
   const pefinValor = toNumber(pickValue(pefinSection, ['summary.balance'], pefin.reduce((s: number, p: any) => s + toNumber(p.balance || p.amount), 0)));

   const refinSection = (negativeData?.refinResponse || negativeData?.refin || {}) as Record<string, any>;
   const refin = asArray(refinSection?.refinResponse || refinSection?.rpiResponse || refinSection?.results || refinSection);
   const refinCount = toNumber(pickValue(refinSection, ['summary.count'], refin.length));
   const refinValor = toNumber(pickValue(refinSection, ['summary.balance'], refin.reduce((s: number, p: any) => s + toNumber(p.balance || p.amount), 0)));

   const dividasSection = (negativeData?.debtResponse || negativeData?.debt || negativeData?.collectionRecordsResponse || negativeData?.collectionRecords || {}) as Record<string, any>;
   const dividas = asArray(dividasSection?.debtResponse || dividasSection?.collectionRecordsResponse || dividasSection?.results || dividasSection);
   const dividasCount = toNumber(pickValue(dividasSection, ['summary.count'], dividas.length));
   const dividasValor = toNumber(pickValue(dividasSection, ['summary.balance'], dividas.reduce((s: number, d: any) => s + toNumber(d.balance || d.amount), 0)));

   const protestoSection = (negativeData?.notaryResponse || negativeData?.notary || negativeData?.protestResponse || negativeData?.protest || {}) as Record<string, any>;
   const protestoResults = asArray(protestoSection?.notaryResponse || protestoSection?.protestResponse || protestoSection?.results || protestoSection);
   const protestos = toNumber(pickValue(protestoSection, ['summary.count'], protestoResults.length));
   const protestoValor = toNumber(pickValue(protestoSection, ['summary.balance'], protestoResults.reduce((s: number, p: any) => s + toNumber(p.amount || p.balance), 0)));

   const chequesSection = (negativeData?.checkResponse || negativeData?.check || {}) as Record<string, any>;
   const cheques = asArray(chequesSection?.checkResponse || chequesSection?.checkResponseDetail || chequesSection?.results || chequesSection);
   const chequesCount = toNumber(pickValue(chequesSection, ['summary.count'], cheques.length));

   const facts = (report?.facts || {}) as Record<string, any>;
   const inquirySummary = (facts?.inquirySummary || report?.inquirySummary || report?.summaryQuery || {}) as Record<string, any>;
   const summaryQueryResults = asArray(report?.summaryQuery?.summaryQueryResponse?.results || report?.summaryQuery?.results);
   const creditInquiries = asArray(inquirySummary?.inquiryQuantity?.creditInquiriesQuantity);
   const checkInquiries = asArray(inquirySummary?.inquiryQuantity?.checkInquiriesQuantity);
   const historicalInquiries = asArray(report?.inquiry?.quantity?.historical || facts?.inquiry?.quantity?.historical);

   const totalConsultas = toNumber(
     pickValue(inquirySummary, ['summary.count'], 0)
   ) || summaryQueryResults.reduce((s: number, c: any) => s + toNumber(c.occurrences), 0)
     || creditInquiries.reduce((s: number, c: any) => s + toNumber(c.occurrences), 0) + checkInquiries.reduce((s: number, c: any) => s + toNumber(c.occurrences), 0)
     || historicalInquiries.reduce((s: number, c: any) => s + toNumber(c.occurrences), 0)
     || toNumber(pickValue(facts?.inquiry, ['summary.count'], 0));

  const restricoes = pefinCount + refinCount + dividasCount;

  // NADA CONSTA check
   const negativeSummaryMsg = pickValue<string>(report, [
     'negativeData.negativeSummary.message',
     'negativeSummary.message',
     'negativeData.message',
     'negativeData.summary.message',
     'negativeData.annotationMessage',
   ], '') || '';
  const nadaConsta = typeof negativeSummaryMsg === 'string' && negativeSummaryMsg.includes('NADA CONSTA');

  // Entity name
   const entityName = report?.registration?.companyName
     || report?.registration?.consumerName
    || raw?.data?.name || raw?.name || '';

  // Negative breakdown chart
  const negativeChart = [
    { name: 'PEFIN', count: pefinCount, valor: pefinValor },
    { name: 'REFIN', count: refinCount, valor: refinValor },
    { name: 'Protestos', count: protestos, valor: protestoValor },
    { name: 'Dívidas', count: dividasCount, valor: dividasValor },
    { name: 'Cheques', count: chequesCount, valor: 0 },
  ].filter(n => n.count > 0);

  // Score color
  const scoreColor = score === null ? 'text-muted-foreground'
    : score >= 600 ? 'text-emerald-600'
    : score >= 400 ? 'text-amber-600' : 'text-destructive';

  // Score faixa
  const scoreFaixa = score === null ? '—'
    : score >= 700 ? 'A (Baixo Risco)'
    : score >= 500 ? 'B (Risco Moderado)'
    : score >= 300 ? 'C (Risco Alto)' : 'D (Risco Muito Alto)';

  return {
    score, scoreModel, defaultRate, scoreFaixa, scoreColor, limiteSugerido,
    restricoes, pefinCount, pefinValor, refinCount, refinValor,
    dividasCount, dividasValor, protestos, protestoValor, chequesCount,
    totalConsultas, negativeChart, entityName, nadaConsta,
  };
}

// ─────────────────────────────────────────────
// Smart/Cedente Data Extraction
// ─────────────────────────────────────────────
function extractSmartData(cedenteData: any, documents?: any[]) {
  if (!cedenteData) return null;
  const d = cedenteData;

  const limiteGlobal = toNumber(d.limite_global);
  const riscoAtual = toNumber(d.risco_atual);
  const saldo = toNumber(d.saldo);
  const fator = toNumber(d.fator);
  const limiteComissaria = toNumber(d.limite_comissaria);
  const limiteClean = toNumber(d.limite_operacao_clean);
  const limiteBoleto = toNumber(d.limite_boleto_especial);
  const limiteBoletoGarantido = toNumber(d.limite_boleto_garantido);
  const limiteTranche = toNumber(d.limite_tranche);

  const utilizacao = limiteGlobal > 0 ? ((riscoAtual / limiteGlobal) * 100) : null;
  const disponivel = limiteGlobal > 0 ? limiteGlobal - riscoAtual : null;

  // Concentration on current sacado from documents
  let concentracaoSacado: string | null = null;
  if (documents && documents.length > 0 && riscoAtual > 0) {
    const totalDocs = documents.reduce((s: number, doc: any) => {
      const v = doc?.manualData?.valor || doc?.parsedNfe?.valor || 0;
      return s + toNumber(v);
    }, 0);
    if (totalDocs > 0) {
      concentracaoSacado = ((totalDocs / (riscoAtual + totalDocs)) * 100).toFixed(1);
    }
  }

  // Contract info
  const vencimentoContrato = d.vencimento_contrato || null;
  const primeiraOperacao = d.primeira_operacao || null;
  const dataCadastro = d.data_cadastro || null;

  // Days until contract expiry
  let diasContrato: number | null = null;
  if (vencimentoContrato) {
    const vc = new Date(vencimentoContrato);
    if (!isNaN(vc.getTime())) {
      diasContrato = Math.ceil((vc.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
  }

  // Limits breakdown for chart
  const limitesBreakdown = [
    { name: 'Global', value: limiteGlobal },
    { name: 'Comissária', value: limiteComissaria },
    { name: 'Clean', value: limiteClean },
    { name: 'Boleto Esp.', value: limiteBoleto },
    { name: 'Bol. Garantido', value: limiteBoletoGarantido },
    { name: 'Tranche', value: limiteTranche },
  ].filter(l => l.value > 0);

  return {
    volumeOperado: d.volume_operado || d.vlr_total_operacoes || null,
    qtdOperacoes: d.qtd_operacoes || d.qtd_total_operacoes || null,
    ticketMedio: d.ticket_medio || null,
    prazoMedio: d.prazo_medio || null,
    inadimplencia: d.inadimplencia || d.perc_inadimplencia || null,
    recompra: d.recompra || d.perc_recompra || null,
    taxaConfirmacao: d.taxa_confirmacao || null,
    chequeDevolvido: d.cheque_devolvido || d.qtd_cheque_devolvido || null,
    pontuacao: d.pontuacao || d.score_interno || null,
    limiteGlobal,
    riscoAtual,
    saldo,
    fator,
    utilizacao,
    disponivel,
    concentracaoSacado,
    vencimentoContrato,
    primeiraOperacao,
    dataCadastro,
    diasContrato,
    limitesBreakdown,
    setor: d.setor || null,
    gerente: d.gerente || null,
    captador: d.captador || null,
  };
}

// ─────────────────────────────────────────────
// DECISION CONFIG
// ─────────────────────────────────────────────
const DECISION_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  APROVAR: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', label: 'APROVAR' },
  APROVAR_COM_RESSALVAS: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', label: 'APROVAR COM RESSALVAS' },
  REPROVAR: { icon: FileWarning, color: 'text-red-700', bg: 'bg-red-50 border-red-300', label: 'REPROVAR' },
};

const RISK_COLORS: Record<string, string> = {
  BAIXO: 'text-emerald-700 bg-emerald-100 border-emerald-300',
  MEDIO: 'text-amber-700 bg-amber-100 border-amber-300',
  ALTO: 'text-red-700 bg-red-100 border-red-300',
};

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export function AnalysisDashboard({ analysis, clientConsultations, liveConsultations, cedenteData, clientName, clientCpfCnpj, cedenteName, cedenteCpfCnpj, sacados }: AnalysisDashboardProps) {
  // ─── Multi-sacado handling ───
  const sacadoList: SacadoEntry[] = useMemo(() => {
    if (sacados && sacados.length > 0) return sacados;
    if (clientCpfCnpj) return [{ cpf_cnpj: clientCpfCnpj, name: clientName }];
    return [];
  }, [sacados, clientCpfCnpj, clientName]);

  const isMultiSacado = sacadoList.length > 1;

  // Prefer live (re-fetched) consultations over the snapshot saved at session creation time.
  const consultationsSource = liveConsultations ?? clientConsultations;

  const isPerCpfMap = useMemo(() => {
    if (!consultationsSource || typeof consultationsSource !== 'object') return false;
    return Object.entries(consultationsSource).some(([k, v]) =>
      /^\d{11,14}$/.test(k) && v && typeof v === 'object' && ('scr' in (v as any) || 'serasa' in (v as any) || 'smart' in (v as any))
    );
  }, [consultationsSource]);

  const [activeSacadoCpf, setActiveSacadoCpf] = useState<string>(sacadoList[0]?.cpf_cnpj || '');
  useEffect(() => {
    if (sacadoList.length > 0 && !sacadoList.find(s => s.cpf_cnpj === activeSacadoCpf)) {
      setActiveSacadoCpf(sacadoList[0].cpf_cnpj);
    }
  }, [sacadoList, activeSacadoCpf]);

  const activeConsultations = useMemo(() => {
    if (isPerCpfMap) return (consultationsSource as any)?.[activeSacadoCpf] || null;
    return consultationsSource;
  }, [consultationsSource, activeSacadoCpf, isPerCpfMap]);

  const activeSacadoName = sacadoList.find(s => s.cpf_cnpj === activeSacadoCpf)?.name || clientName;

  const scrData = useMemo(() => extractSCRData(activeConsultations?.scr), [activeConsultations?.scr]);
  const serasaData = useMemo(() => extractSerasaData(activeConsultations?.serasa), [activeConsultations?.serasa]);
  const smartData = useMemo(() => extractSmartData(cedenteData, analysis?.documents), [cedenteData, analysis?.documents]);

  // Per-sacado summary for the comparison card (multi-sacado only)
  const sacadosSummary = useMemo(() => {
    if (!isMultiSacado) return [];
    return sacadoList.map(s => {
      const c = isPerCpfMap ? (consultationsSource as any)?.[s.cpf_cnpj] : null;
      const ser = extractSerasaData(c?.serasa);
      const scr = extractSCRData(c?.scr);
      return {
        cpf_cnpj: s.cpf_cnpj,
        name: s.name || s.cpf_cnpj,
        score: ser?.score ?? null,
        scoreColor: ser?.scoreColor || 'text-muted-foreground',
        scoreFaixa: ser?.scoreFaixa || '—',
        restricoes: ser?.restricoes ?? null,
        protestos: ser?.protestos ?? null,
        nadaConsta: ser?.nadaConsta || false,
        scrCarteira: scr?.totalCarteira ?? null,
        scrVencido: scr?.totalVencido ?? null,
        hasSerasa: !!ser,
        hasScr: !!scr,
      };
    });
  }, [isMultiSacado, sacadoList, isPerCpfMap, consultationsSource]);

  // Fetch concentration by sacado from external DB
  const [sacadoConcentracao, setSacadoConcentracao] = useState<{ nome: string; valor: number; percentual: number }[]>([]);
  useEffect(() => {
    if (!cedenteCpfCnpj) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('external-db', {
          body: { action: 'titulos-aberto', filters: { cedente: null } },
        });
        // We need titulos for this specific cedente — use cedente-info
        const { data: infoData } = await supabase.functions.invoke('external-db', {
          body: { action: 'cedente-info', filters: { cpf_cnpj: cedenteCpfCnpj } },
        });
        const titulos = infoData?.data?.titulosAberto || [];
        if (titulos.length === 0) return;

        const sacadoMap = new Map<string, { nome: string; valor: number }>();
        titulos.forEach((t: any) => {
          const key = t.cpf_cnpj_sacado || t.sacado || 'Outros';
          const nome = t.sacado || t.cpf_cnpj_sacado || 'Outros';
          const val = parseFloat(t.valor) || 0;
          const existing = sacadoMap.get(key);
          if (existing) existing.valor += val;
          else sacadoMap.set(key, { nome, valor: val });
        });

        const totalValor = Array.from(sacadoMap.values()).reduce((s, v) => s + v.valor, 0);
        const sorted = Array.from(sacadoMap.values())
          .map(s => ({ ...s, percentual: totalValor > 0 ? (s.valor / totalValor) * 100 : 0 }))
          .sort((a, b) => b.valor - a.valor);

        // Top 7 + Outros
        if (sorted.length > 7) {
          const top = sorted.slice(0, 7);
          const outros = sorted.slice(7).reduce((acc, s) => ({ nome: 'Outros', valor: acc.valor + s.valor, percentual: acc.percentual + s.percentual }), { nome: 'Outros', valor: 0, percentual: 0 });
          setSacadoConcentracao([...top, outros]);
        } else {
          setSacadoConcentracao(sorted);
        }
      } catch (e) {
        console.error('Erro ao buscar concentração:', e);
      }
    })();
  }, [cedenteCpfCnpj]);

  const decConfig = DECISION_CONFIG[analysis?.decisao] || DECISION_CONFIG.APROVAR_COM_RESSALVAS;
  const DecIcon = decConfig.icon;

  // Cross-referencing alerts
  const crossAlerts = useMemo(() => {
    const alerts: { text: string; severity: 'high' | 'medium' | 'low' }[] = [];
    if (scrData && serasaData) {
      if (scrData.totalAVencer > 500000 && serasaData.score !== null && serasaData.score < 400)
        alerts.push({ text: 'Endividamento alto no SCR com score Serasa baixo', severity: 'high' });
      if (scrData.totalVencido > 0 && serasaData.restricoes > 0)
        alerts.push({ text: 'Créditos vencidos no SCR + restrições Serasa ativas', severity: 'high' });
      if (scrData.qtdIfs > 5 && serasaData.protestos > 3)
        alerts.push({ text: `${scrData.qtdIfs} IFs no SCR com ${serasaData.protestos} protestos na Serasa`, severity: 'medium' });
    }
    if (smartData) {
      if (smartData.recompra && parseFloat(String(smartData.recompra)) > 10)
        alerts.push({ text: `Recompra do cedente em ${smartData.recompra}%`, severity: 'medium' });
      if (smartData.inadimplencia && parseFloat(String(smartData.inadimplencia)) > 5 && serasaData?.score !== null && serasaData!.score! < 500)
        alerts.push({ text: 'Inadimplência elevada no cedente + score baixo do sacado', severity: 'high' });
    }
    return alerts;
  }, [scrData, serasaData, smartData]);

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 0) MULTI-SACADO — RESUMO COMPARATIVO + SELECTOR        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isMultiSacado && (
        <SacadosOverview
          summary={sacadosSummary}
          activeCpf={activeSacadoCpf}
          onSelect={setActiveSacadoCpf}
        />
      )}

      {/* Active sacado context badge (when multi) */}
      {isMultiSacado && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-2.5">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">Visualizando dados de:</span>
          <span className="text-sm font-bold text-foreground truncate">{activeSacadoName}</span>
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">{activeSacadoCpf}</Badge>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1) SCR — ENDIVIDAMENTO BANCÁRIO                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SectionCard
        icon={BarChart3}
        title="SCR — Endividamento Bancário"
        subtitle={scrData?.entityName || activeSacadoName || undefined}
        badge={scrData?.dtbLabel}
        available={!!scrData}
        emptyLabel="SCR — sem consulta disponível"
      >
        {scrData && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <KPICard label="Carteira Ativa" value={fmt(scrData.totalCarteira)} icon={CreditCard} />
              <KPICard label="A Vencer" value={fmt(scrData.totalAVencer)} icon={TrendingUp} color="text-primary" />
              <KPICard label="Vencido" value={fmt(scrData.totalVencido)} icon={TrendingDown}
                color={scrData.totalVencido > 0 ? 'text-destructive' : 'text-emerald-600'} />
              <KPICard label="Limites" value={fmt(scrData.totalLimites)} icon={DollarSign} />
              <KPICard label="Inadimplência" value={`${scrData.inadimplenciaPerc}%`} icon={Percent}
                color={parseFloat(scrData.inadimplenciaPerc) > 5 ? 'text-destructive' : 'text-emerald-600'} />
              <KPICard label="IFs / Ops" value={`${scrData.qtdIfs} / ${scrData.qtdOps}`} icon={Building2} />
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              {scrData.evolution.length > 1 && (
                <ChartCard title="Evolução do Endividamento">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={scrData.evolution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="aVencer" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} name="A Vencer" />
                      <Area type="monotone" dataKey="vencido" fill="hsl(0, 84%, 60%, 0.15)" stroke="hsl(0, 84%, 60%)" strokeWidth={2} name="Vencido" />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {scrData.vencChart.some(v => v.value > 0) && (
                <ChartCard title="Créditos a Vencer por Prazo">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scrData.vencChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {scrData.modalidades.length > 0 && (
                <ChartCard title="Concentração por Modalidade">
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={scrData.modalidades} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                          {scrData.modalidades.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {scrData.modalidades.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate text-muted-foreground">{m.name}</span>
                          <span className="ml-auto font-mono font-semibold text-foreground">{fmt(m.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>
              )}

              {scrData.vencidoChart.length > 0 && (
                <ChartCard title="Créditos Vencidos por Faixa">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scrData.vencidoChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" name="Vencido" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2) SERASA                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SectionCard
        icon={Shield}
        title="Serasa — Análise de Crédito"
        subtitle={serasaData?.entityName || activeSacadoName || undefined}
        available={!!serasaData}
        emptyLabel="Serasa — sem consulta disponível"
      >
        {serasaData && (
          <div className="space-y-5">
            {/* NADA CONSTA alert */}
            {serasaData.nadaConsta && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                ⚠️ NADA CONSTA — Possível Liminar Judicial ocultando registros negativos
              </div>
            )}

            {/* Score + KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {/* Score card - larger */}
              <div className="rounded-xl border-2 bg-card p-4 text-center col-span-1 row-span-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Score</p>
                <p className={cn('text-4xl font-black mt-1', serasaData.scoreColor)}>
                  {serasaData.score ?? '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{serasaData.scoreFaixa}</p>
                {serasaData.defaultRate && (
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    Chance pgto: {(100 - parseFloat(serasaData.defaultRate)).toFixed(1)}%
                  </p>
                )}
              </div>

              <KPICard label="Restrições" value={serasaData.restricoes}
                color={serasaData.restricoes > 0 ? 'text-destructive' : 'text-emerald-600'}
                sub={serasaData.restricoes > 0 ? `R$ ${(serasaData.pefinValor + serasaData.refinValor + serasaData.dividasValor).toLocaleString('pt-BR')}` : 'Nenhuma'} />
              <KPICard label="Protestos" value={serasaData.protestos}
                color={serasaData.protestos > 0 ? 'text-amber-600' : 'text-emerald-600'}
                sub={serasaData.protestoValor > 0 ? `R$ ${serasaData.protestoValor.toLocaleString('pt-BR')}` : 'Nenhum'} />
              <KPICard label="Consultas 13m" value={serasaData.totalConsultas || 0} />
              <KPICard label={serasaData.limiteSugerido ? 'Limite Sugerido' : 'Cheques Dev.'}
                value={serasaData.limiteSugerido ? fmt(serasaData.limiteSugerido) : serasaData.chequesCount} />
            </div>

            {/* Negative breakdown */}
            {serasaData.negativeChart.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                <ChartCard title="Anotações Negativas — Quantidade">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={serasaData.negativeChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="count" name="Quantidade" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Anotações Negativas — Valores">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={serasaData.negativeChart.filter(n => n.valor > 0)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="valor" name="Valor" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 3) CEDENTE — DADOS OPERACIONAIS SMART                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SectionCard
        icon={Building2}
        title="Cedente — Dados Operacionais"
        subtitle={cedenteName || undefined}
        available={!!smartData}
        emptyLabel="Cedente — sem dados disponíveis"
      >
        {smartData && (
          <div className="space-y-5">
            {/* Row 1: Core KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <KPICard label="Limite Global" value={smartData.limiteGlobal > 0 ? fmt(smartData.limiteGlobal) : '—'} icon={CreditCard} />
              <KPICard label="Risco Atual" value={smartData.riscoAtual > 0 ? fmt(smartData.riscoAtual) : '—'} icon={AlertTriangle}
                color={smartData.utilizacao && smartData.utilizacao > 80 ? 'text-destructive' : undefined} />
              <KPICard label="Utilização" value={smartData.utilizacao != null ? `${smartData.utilizacao.toFixed(1)}%` : '—'} icon={Percent}
                color={smartData.utilizacao && smartData.utilizacao > 80 ? 'text-destructive' : smartData.utilizacao && smartData.utilizacao > 60 ? 'text-amber-600' : 'text-emerald-600'} />
              <KPICard label="Disponível" value={smartData.disponivel != null ? fmt(smartData.disponivel) : '—'} icon={DollarSign}
                color={smartData.disponivel != null && smartData.disponivel < 0 ? 'text-destructive' : 'text-primary'} />
              <KPICard label="Saldo Trustee" value={smartData.saldo > 0 ? fmt(smartData.saldo) : '—'} icon={DollarSign} />
              <KPICard label="Fator" value={smartData.fator > 0 ? `${smartData.fator}%` : '—'} icon={Percent} />
            </div>

            {/* Row 2: Operational metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {smartData.concentracaoSacado != null && (
                <KPICard label="Concentração Sacado" value={`${smartData.concentracaoSacado}%`} icon={Users}
                  sub="Nesta operação"
                  color={parseFloat(smartData.concentracaoSacado) > 30 ? 'text-amber-600' : 'text-emerald-600'} />
              )}
              {smartData.inadimplencia != null && (
                <KPICard label="Inadimplência" value={`${smartData.inadimplencia}%`} icon={TrendingDown}
                  color={parseFloat(String(smartData.inadimplencia)) > 5 ? 'text-destructive' : 'text-emerald-600'} />
              )}
              {smartData.recompra != null && (
                <KPICard label="Recompra" value={`${smartData.recompra}%`}
                  color={parseFloat(String(smartData.recompra)) > 10 ? 'text-destructive' : undefined} />
              )}
              {smartData.taxaConfirmacao != null && (
                <KPICard label="Tx. Confirmação" value={`${smartData.taxaConfirmacao}%`} icon={CheckCircle2} />
              )}
              {smartData.volumeOperado != null && (
                <KPICard label="Volume Operado" value={typeof smartData.volumeOperado === 'number' ? fmt(smartData.volumeOperado) : smartData.volumeOperado} icon={DollarSign} />
              )}
            </div>

            {/* Row 3: Concentration on top, Info cards below */}
            <div className="space-y-4" data-testid="grid-cedente-concentracao">
              {/* Concentration by sacado */}
              {sacadoConcentracao.length > 0 && (
                <ChartCard title="Concentração por Sacado">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={sacadoConcentracao}
                        dataKey="valor"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={35}
                        paddingAngle={2}
                        label={({ nome, percentual }) => `${(nome || '').substring(0, 12)}${(nome || '').length > 12 ? '…' : ''} ${percentual.toFixed(1)}%`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {sacadoConcentracao.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmtFull(v)}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 max-h-[120px] overflow-y-auto space-y-1 px-1">
                    {sacadoConcentracao.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate text-muted-foreground">{s.nome}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{fmt(s.valor)}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s.percentual.toFixed(1)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              )}

              {/* Info panel */}
              <div className="space-y-2 flex flex-col">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações do Cedente</p>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm flex-1">
                  {smartData.setor && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Setor</span><span className="font-medium">{smartData.setor}</span></div>
                  )}
                  {smartData.gerente && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Gerente</span><span className="font-medium">{smartData.gerente}</span></div>
                  )}
                  {smartData.captador && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Captador</span><span className="font-medium">{smartData.captador}</span></div>
                  )}
                  {smartData.dataCadastro && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Cadastro</span><span className="font-medium">{new Date(smartData.dataCadastro).toLocaleDateString('pt-BR')}</span></div>
                  )}
                  {smartData.primeiraOperacao && (
                    <div className="flex justify-between"><span className="text-muted-foreground">1ª Operação</span><span className="font-medium">{new Date(smartData.primeiraOperacao).toLocaleDateString('pt-BR')}</span></div>
                  )}
                  {smartData.vencimentoContrato && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Venc. Contrato</span>
                      <span className={cn('font-medium', smartData.diasContrato != null && smartData.diasContrato < 30 ? 'text-destructive' : '')}>
                        {new Date(smartData.vencimentoContrato).toLocaleDateString('pt-BR')}
                        {smartData.diasContrato != null && (
                          <span className="text-xs ml-1">({smartData.diasContrato}d)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Limits breakdown chart */}
            {smartData.limitesBreakdown.length > 1 && (
              <ChartCard title="Limites por Modalidade">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={smartData.limitesBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={85} />
                    <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Limite" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        )}
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 4) PARECER EXECUTIVO — MEMORANDO                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      {analysis && (
        <ParecerMemorando
          analysis={analysis}
          decConfig={decConfig}
          DecIcon={DecIcon}
          clientName={clientName}
        />
      )}

      {analysis && (() => {
        const sacadosArr: any[] = Array.isArray(analysis?.blocos?.sacados) ? analysis.blocos.sacados : [];
        const isMulti = sacadosArr.length > 0;
        const ressalvasValid = analysis.ressalvas?.length > 0 && analysis.ressalvas[0] !== 'Sem ressalvas relevantes.';
        const faltantesValid = analysis.dadosFaltantes?.length > 0;
        const atencaoCount =
          (ressalvasValid ? analysis.ressalvas.length : 0) +
          (faltantesValid ? analysis.dadosFaltantes.length : 0) +
          crossAlerts.length;
        const sacadoAlertCount = isMulti
          ? sacadosArr.reduce((acc, s) => acc + (s.alertas?.length || 0) + (s.relacaoComCedente?.alertas?.length || 0), 0)
          : (analysis?.blocos?.sacado?.alertas?.length || 0);
        const cedenteAlertCount = analysis?.blocos?.cedente?.alertas?.length || 0;
        const titulosAlertCount = analysis?.blocos?.titulosLastro?.alertas?.length || 0;

        return (
          <Card className="border-border overflow-hidden">
            {/* Institutional gold header */}
            <div
              className="px-5 py-3 border-b border-border flex items-center gap-3"
              style={{ background: 'linear-gradient(90deg, #fdf6e3 0%, #ffffff 100%)' }}
            >
              <div className="h-8 w-1 rounded-full" style={{ background: '#e5b970' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#a07d2a' }}>
                  Parecer Estruturado
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  Cedente · Sacados · Títulos · Pontos de Atenção
                </p>
              </div>
              {analysis.resumoSacados && isMulti && (
                <Badge variant="outline" className="text-[10px] border-[#e5b970]/60 bg-[#fdf6e3] text-[#a07d2a] font-semibold">
                  {sacadosArr.length} sacados
                </Badge>
              )}
            </div>

            <CardContent className="pt-5 space-y-4">
              {analysis.resumoSacados && (
                <div className="rounded-md border-l-2 px-4 py-2.5 bg-[#fdf6e3]/50" style={{ borderColor: '#e5b970' }}>
                  <p className="text-xs leading-relaxed text-foreground/85 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0" style={{ color: '#a07d2a' }} />
                    {analysis.resumoSacados}
                  </p>
                </div>
              )}

              <Tabs defaultValue="cedente" className="w-full">
                <TabsList className="w-full justify-start gap-1 h-auto p-1 bg-muted/40 border border-border rounded-lg flex-wrap">
                  <ParecerTab value="cedente" icon={Building2} label="Cedente" alerts={cedenteAlertCount} />
                  <ParecerTab value="sacados" icon={Users} label={isMulti ? `Sacados (${sacadosArr.length})` : 'Sacado'} alerts={sacadoAlertCount} />
                  <ParecerTab value="titulos" icon={CreditCard} label="Títulos / Lastro" alerts={titulosAlertCount} />
                  <ParecerTab value="atencao" icon={AlertTriangle} label="Pontos de Atenção" alerts={atencaoCount} />
                </TabsList>

                {/* Cedente */}
                <TabsContent value="cedente" className="mt-4">
                  <AnalysisBlock icon={Building2} title="Cedente" data={analysis?.blocos?.cedente} keyPoint={analysis?.pontosChave?.cedente} defaultOpen />
                </TabsContent>

                {/* Sacados */}
                <TabsContent value="sacados" className="mt-4 space-y-3">
                  {isMulti ? (
                    <div className="rounded-xl border border-border bg-white p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0" style={{ color: '#a07d2a' }} />
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
                          Sacados <span className="text-muted-foreground font-normal">({sacadosArr.length})</span>
                        </p>
                      </div>
                      {analysis.pontosChave?.sacados && (
                        <p className="text-sm leading-relaxed text-foreground/90">{analysis.pontosChave.sacados}</p>
                      )}
                      <Accordion type="multiple" className="border-t border-border/60 pt-1" defaultValue={
                        sacadosArr
                          .map((s: any, i: number) => (s.risco === 'ALTO' || s.risco === 'MEDIO') ? `sacado-${i}` : null)
                          .filter(Boolean) as string[]
                      }>
                        {sacadosArr.map((sacado: any, idx: number) => {
                          const tone =
                            sacado.risco === 'BAIXO' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                            sacado.risco === 'MEDIO' ? 'text-[#a07d2a] border-[#e5b970]/50 bg-[#fdf6e3]' :
                            sacado.risco === 'ALTO' ? 'text-red-700 border-red-200 bg-red-50' :
                            'text-muted-foreground border-border bg-muted/40';
                          return (
                            <AccordionItem key={idx} value={`sacado-${idx}`} className="border-b border-border/60 last:border-b-0">
                              <AccordionTrigger className="py-2.5 hover:no-underline gap-2">
                                <div className="flex items-center gap-2 text-left flex-1 min-w-0">
                                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', tone)}>
                                    {sacado.risco || '—'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate" title={sacado.nome || ''}>
                                      {sacado.nome || `Sacado ${idx + 1}`}
                                    </p>
                                    {sacado.percentualOperacao && (
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {sacado.valorExposicao} · {sacado.percentualOperacao}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2.5 pl-1 pb-1">
                                  {sacado.cpfCnpj && (
                                    <p className="text-[10px] text-muted-foreground font-mono tracking-wider">{sacado.cpfCnpj}</p>
                                  )}
                                  {sacado.resumo && (
                                    <p className="text-xs leading-relaxed text-foreground/85">{sacado.resumo}</p>
                                  )}
                                  {sacado.alertas?.length > 0 && (
                                    <div className="space-y-1.5">
                                      {sacado.alertas.map((a: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/85 rounded-md border border-[#e5b970]/40 bg-[#fdf6e3]/60 px-2.5 py-1.5">
                                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#a07d2a' }} />
                                          <span>{a}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {sacado.relacaoComCedente && (
                                    <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-1.5 mt-1">
                                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] flex items-center gap-1" style={{ color: '#a07d2a' }}>
                                        <TrendingUp className="h-3 w-3" /> Relação Comercial
                                      </p>
                                      {sacado.relacaoComCedente.resumo && (
                                        <p className="text-xs leading-relaxed text-foreground/85">{sacado.relacaoComCedente.resumo}</p>
                                      )}
                                      {sacado.relacaoComCedente.alertas?.length > 0 && sacado.relacaoComCedente.alertas.map((a: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/85 rounded-md border border-[#e5b970]/40 bg-[#fdf6e3]/60 px-2 py-1">
                                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#a07d2a' }} />
                                          <span>{a}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </div>
                  ) : (
                    <>
                      <AnalysisBlock icon={Users} title="Sacado" data={analysis?.blocos?.sacado} keyPoint={analysis?.pontosChave?.sacado} defaultOpen />
                      {analysis?.blocos?.relacaoCedenteSacado && (
                        <AnalysisBlock icon={TrendingUp} title="Relação Comercial" data={analysis?.blocos?.relacaoCedenteSacado} keyPoint={analysis?.pontosChave?.relacao} defaultOpen />
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Títulos / Lastro */}
                <TabsContent value="titulos" className="mt-4">
                  <AnalysisBlock icon={CreditCard} title="Títulos / Lastro" data={analysis?.blocos?.titulosLastro} keyPoint={analysis?.pontosChave?.titulos} defaultOpen />
                </TabsContent>

                {/* Pontos de Atenção */}
                <TabsContent value="atencao" className="mt-4 space-y-3">
                  {atencaoCount === 0 && (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                      <p className="text-xs text-muted-foreground">Nenhum ponto de atenção identificado.</p>
                    </div>
                  )}

                  {crossAlerts.length > 0 && (
                    <div className="rounded-xl border border-[#e5b970]/50 bg-[#fdf6e3]/40 p-4 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] flex items-center gap-1.5" style={{ color: '#a07d2a' }}>
                        <AlertTriangle className="h-3.5 w-3.5" /> Cruzamento entre Birôs
                      </p>
                      {crossAlerts.map((a, i) => (
                        <div key={i} className={cn(
                          'flex items-start gap-2 text-xs rounded-lg px-3 py-2 font-medium',
                          a.severity === 'high' ? 'bg-red-50 text-red-800 border border-red-200' :
                          a.severity === 'medium' ? 'bg-[#fdf6e3] text-[#a07d2a] border border-[#e5b970]/50' :
                          'bg-white text-foreground/80 border border-border'
                        )}>
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          {a.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {(ressalvasValid || faltantesValid) && (
                    <div className="grid gap-4 md:grid-cols-2 items-start">
                      {ressalvasValid && (
                        <div className="rounded-xl border border-border bg-white p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: '#a07d2a' }}>
                            Ressalvas
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-foreground leading-relaxed">
                            {analysis.ressalvas.map((r: string, i: number) => <li key={i}>{r}</li>)}
                          </ol>
                        </div>
                      )}
                      {faltantesValid && (
                        <div className="rounded-xl border border-border bg-white p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2 text-muted-foreground">
                            Dados Faltantes
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-xs text-foreground leading-relaxed">
                            {analysis.dadosFaltantes.map((d: string, i: number) => <li key={i}>{d}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function ParecerTab({ value, icon: Icon, label, alerts }: { value: string; icon: any; label: string; alerts?: number }) {
  return (
    <TabsTrigger
      value={value}
      className="gap-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-[#e5b970] rounded-md px-3 py-2"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {alerts ? (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#fdf6e3] border border-[#e5b970]/60 text-[10px] font-bold px-1" style={{ color: '#a07d2a' }}>
          {alerts}
        </span>
      ) : null}
    </TabsTrigger>
  );
}

// ─── Reusable Sub-components ───

function SectionCard({ icon: Icon, title, subtitle, badge, available, emptyLabel, children }: {
  icon: any; title: string; subtitle?: string; badge?: string; available: boolean; emptyLabel: string; children: React.ReactNode;
}) {
  if (!available) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{emptyLabel}</span>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          {subtitle && <span className="text-sm text-muted-foreground font-normal">({subtitle})</span>}
          {badge && <Badge variant="outline" className="text-[10px] ml-auto">{badge}</Badge>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KPICard({ icon: Icon, label, value, color, sub }: {
  icon?: any; label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className={cn('text-xl font-bold', color || 'text-foreground')}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

function AnalysisBlock({ icon: Icon, title, data, keyPoint, defaultOpen = false }: {
  icon: any; title: string; data: any; keyPoint?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!data) return null;
  const hasAlerts = data.alertas?.length > 0;
  const hasDetails = !!data.resumo || hasAlerts;
  const riscoTone =
    data.risco === 'BAIXO' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
    data.risco === 'MEDIO' ? 'text-[#a07d2a] border-[#e5b970]/50 bg-[#fdf6e3]' :
    data.risco === 'ALTO' ? 'text-red-700 border-red-200 bg-red-50' : '';

  return (
    <div className="rounded-xl border border-border bg-white p-5 space-y-3 h-full">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: '#a07d2a' }} />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{title}</p>
        {hasAlerts && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-[#e5b970]/50 bg-[#fdf6e3] px-1.5 py-0.5 text-[10px] font-semibold text-[#a07d2a]">
            <AlertTriangle className="h-2.5 w-2.5" />{data.alertas.length}
          </span>
        )}
        {data.risco && (
          <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', riscoTone)}>
            {data.risco}
          </span>
        )}
      </div>
      {keyPoint && <p className="text-sm leading-relaxed text-foreground/90">{keyPoint}</p>}
      {hasDetails && (
        <>
          {open && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              {data.resumo && <p className="text-xs leading-relaxed text-muted-foreground pt-2">{data.resumo}</p>}
              {hasAlerts && (
                <div className="space-y-1.5">
                  {data.alertas.map((a: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/85 rounded-md border border-[#e5b970]/40 bg-[#fdf6e3]/60 px-2.5 py-1.5">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#a07d2a' }} />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>
        </>
      )}
    </div>
  );
}

function RiskGauge({ level }: { level: string }) {
  const config: Record<string, { pct: number; color: string; ring: string; label: string }> = {
    BAIXO: { pct: 25, color: 'text-emerald-600', ring: 'stroke-emerald-500', label: 'Baixo' },
    MEDIO: { pct: 60, color: 'text-amber-600', ring: 'stroke-amber-500', label: 'Médio' },
    ALTO:  { pct: 90, color: 'text-red-600',    ring: 'stroke-red-500',    label: 'Alto' },
  };
  const c = config[level] || config.MEDIO;
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (c.pct / 100) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/70 border px-4 py-2.5 shadow-sm">
      <div className="relative h-[78px] w-[78px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} className="stroke-muted fill-none" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r}
            className={cn('fill-none transition-all', c.ring)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-lg font-black leading-none', c.color)}>{c.pct}</span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">risco</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Nível de Risco</p>
        <p className={cn('text-xl font-black leading-tight', c.color)}>{c.label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SacadosOverview — Resumo comparativo + drill-down selector for multi-sacado operations
// ─────────────────────────────────────────────
interface SacadoSummaryRow {
  cpf_cnpj: string;
  name: string;
  score: number | null;
  scoreColor: string;
  scoreFaixa: string;
  restricoes: number | null;
  protestos: number | null;
  nadaConsta: boolean;
  scrCarteira: number | null;
  scrVencido: number | null;
  hasSerasa: boolean;
  hasScr: boolean;
}

function SacadosOverview({ summary, activeCpf, onSelect }: {
  summary: SacadoSummaryRow[];
  activeCpf: string;
  onSelect: (cpf: string) => void;
}) {
  if (summary.length === 0) return null;

  return (
    <Card className="border-2 border-primary/20 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Resumo Comparativo dos Sacados
          <Badge variant="outline" className="ml-1 text-[10px]">{summary.length}</Badge>
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            Clique em um sacado para ver os detalhes
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Sacado</th>
                <th className="px-3 py-2.5 font-semibold text-center">Score</th>
                <th className="px-3 py-2.5 font-semibold text-center">Restrições</th>
                <th className="px-3 py-2.5 font-semibold text-center">Protestos</th>
                <th className="px-3 py-2.5 font-semibold text-right">Carteira SCR</th>
                <th className="px-3 py-2.5 font-semibold text-right">Vencido SCR</th>
                <th className="px-3 py-2.5 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(s => {
                const isActive = s.cpf_cnpj === activeCpf;
                return (
                  <tr
                    key={s.cpf_cnpj}
                    onClick={() => onSelect(s.cpf_cnpj)}
                    className={cn(
                      'border-b cursor-pointer transition-colors hover:bg-muted/30',
                      isActive && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[280px]">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{s.cpf_cnpj}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.score !== null ? (
                        <div>
                          <p className={cn('font-black text-base leading-none', s.scoreColor)}>{s.score}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{s.scoreFaixa}</p>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.restricoes !== null ? (
                        <Badge variant="outline" className={cn('text-[10px]',
                          s.restricoes > 0 ? 'text-destructive border-destructive/30 bg-destructive/5' : 'text-emerald-700 border-emerald-300 bg-emerald-50'
                        )}>
                          {s.restricoes}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {s.protestos !== null ? (
                        <Badge variant="outline" className={cn('text-[10px]',
                          s.protestos > 0 ? 'text-amber-700 border-amber-300 bg-amber-50' : 'text-emerald-700 border-emerald-300 bg-emerald-50'
                        )}>
                          {s.protestos}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {s.scrCarteira !== null && s.scrCarteira > 0 ? fmt(s.scrCarteira) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {s.scrVencido !== null && s.scrVencido > 0 ? (
                        <span className="text-destructive font-semibold">{fmt(s.scrVencido)}</span>
                      ) : s.scrVencido === 0 ? <span className="text-emerald-600">R$ 0</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span title="Serasa" className={cn('w-2 h-2 rounded-full', s.hasSerasa ? 'bg-blue-500' : 'bg-muted')} />
                        <span title="SCR" className={cn('w-2 h-2 rounded-full', s.hasScr ? 'bg-emerald-500' : 'bg-muted')} />
                        {s.nadaConsta && <AlertTriangle className="h-3 w-3 text-red-600" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {summary.map(s => {
            const isActive = s.cpf_cnpj === activeCpf;
            return (
              <button
                key={s.cpf_cnpj}
                onClick={() => onSelect(s.cpf_cnpj)}
                className={cn(
                  'w-full p-3 text-left transition-colors hover:bg-muted/30',
                  isActive && 'bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{s.cpf_cnpj}</p>
                  </div>
                  {s.score !== null && (
                    <p className={cn('text-2xl font-black leading-none', s.scoreColor)}>{s.score}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {s.restricoes !== null && (
                    <Badge variant="outline" className={cn(s.restricoes > 0 ? 'text-destructive border-destructive/30' : 'text-emerald-700 border-emerald-300')}>
                      {s.restricoes} restr.
                    </Badge>
                  )}
                  {s.protestos !== null && s.protestos > 0 && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300">{s.protestos} protestos</Badge>
                  )}
                  {s.scrVencido !== null && s.scrVencido > 0 && (
                    <Badge variant="outline" className="text-destructive border-destructive/30">Vencido SCR {fmt(s.scrVencido)}</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// PARECER MEMORANDO — Layout executivo (gold institucional, narrativa + KPIs sidebar)
// ─────────────────────────────────────────────
const GOLD = '#e5b970';
const GOLD_DARK = '#a07d2a';

function splitParagrafos(text?: string): [string, string, string] {
  if (!text) return ['', '', ''];
  const parts = text
    .split(/\n\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (parts.length >= 3) return [parts[0], parts[1], parts.slice(2).join(' ')];
  if (parts.length === 2) return [parts[0], parts[1], ''];
  return [text.trim(), '', ''];
}

function ParecerMemorando({
  analysis,
  decConfig,
  DecIcon,
  clientName,
}: {
  analysis: any;
  decConfig: { icon: any; color: string; bg: string; label: string };
  DecIcon: any;
  clientName: string | null;
}) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const paragrafos = useMemo(() => splitParagrafos(analysis?.parecer), [analysis?.parecer]);

  const titulos = analysis?.blocos?.titulosLastro?.detalhes || {};
  const kpis = [
    { label: 'Decisão', value: decConfig.label, icon: <DecIcon className="h-3.5 w-3.5" />, accent: true },
    { label: 'Risco geral', value: analysis?.riscoGeral || '—', icon: <Shield className="h-3.5 w-3.5" /> },
    { label: 'Valor operação', value: titulos.valorTotal || '—', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { label: 'Qtd. títulos', value: titulos.quantidadeTitulos || '—', icon: <FileText className="h-3.5 w-3.5" /> },
    { label: 'Prazo médio', value: titulos.prazoMedio || '—', icon: <Clock className="h-3.5 w-3.5" /> },
    { label: 'Ticket médio', value: titulos.ticketMedio || '—', icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <Card className="overflow-hidden border-border bg-white shadow-sm">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD}, ${GOLD_DARK})` }} />
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 p-7 sm:p-8">
          <div>
            <div className="flex items-baseline gap-3">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-full', decConfig.color.replace('text-', 'bg-').replace('-700', '-500'))} />
              <p className={cn('text-xs font-bold uppercase tracking-[0.18em]', decConfig.color)}>Parecer · {decConfig.label}</p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {clientName || 'Operação de crédito'}
            </h2>
          </div>

          {paragrafos.some(Boolean) ? (
            <div className="space-y-4 border-l-2 pl-5" style={{ borderColor: GOLD }}>
              {paragrafos[0] && (
                <p className="text-[15px] leading-[1.7] text-foreground/90 first-letter:text-2xl first-letter:font-semibold first-letter:mr-1">
                  {paragrafos[0]}
                </p>
              )}
              {paragrafos[1] && <p className="text-[15px] leading-[1.7] text-foreground/85">{paragrafos[1]}</p>}
              {paragrafos[2] && <p className="text-[15px] leading-[1.7] text-foreground/85">{paragrafos[2]}</p>}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">Sem parecer textual disponível.</p>
          )}
        </div>

        <aside className="border-t border-border bg-[#fafafa] p-6 lg:border-l lg:border-t-0">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Indicadores-chave</p>
          <div className="space-y-3">
            {kpis.map((k) => (
              <div key={k.label} className="flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${GOLD}1a`, color: GOLD_DARK }}
                >
                  {k.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className={cn('truncate text-base font-semibold leading-tight', k.accent ? decConfig.color : 'text-foreground')} title={String(k.value)}>
                    {k.value || <span className="text-muted-foreground/50">—</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Card>
  );
}
