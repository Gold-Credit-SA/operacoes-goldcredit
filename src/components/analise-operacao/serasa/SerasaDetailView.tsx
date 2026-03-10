import { useRef, type ComponentType, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { SerasaPdfExport } from './SerasaPdfExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Building2,
  FileSearch,
  Search,
  ShieldAlert,
  TrendingUp,
  User,
} from 'lucide-react';

interface SerasaDetailViewProps {
  data: Record<string, unknown>;
  document?: string;
  consultaId?: string;
  hideExportButton?: boolean;
  externalRef?: React.RefObject<HTMLDivElement>;
}

type GenericRecord = Record<string, any>;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function pick<T = any>(source: GenericRecord | undefined, paths: string[], fallback?: T): T | undefined {
  for (const path of paths) {
    const value = path.split('.').reduce<any>((acc, key) => acc?.[key], source);
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return fallback;
}

function formatCurrency(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Sem valor';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: unknown): string {
  if (!value) return '-';
  const raw = String(value);
  // Handle date-only strings (YYYY-MM-DD) without timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('pt-BR');
}

function formatDocument(value: unknown): string {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (raw.length === 11) {
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
  }
  if (raw.length === 14) {
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  }
  return raw || '-';
}

function formatCount(value: unknown, suffix = 'registros'): string {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count) || count <= 0) return `Sem ${suffix}`;
  return `${count} ${suffix}`;
}

function calcAge(birthDate: unknown): number | null {
  if (!birthDate) return null;
  const raw = String(birthDate);
  let d: Date;
  // Parse date-only strings without timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, day] = raw.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

function yesNo(value: unknown): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return String(value ?? '-');
}

function joinLocation(city: unknown, uf: unknown): string {
  if (!city && !uf) return 'Sem dados';
  if (city && uf) return `${city}/${uf}`;
  return String(city || uf);
}

export function SerasaDetailView({ data, document: docNumber, consultaId, hideExportButton, externalRef }: SerasaDetailViewProps) {
  const isPJ = consultaId?.includes('_pj');
  const isPF = !isPJ;
  const isTopScore = consultaId === 'serasa_avancado_top_score_pf';
  const isAvancadoPJ = consultaId === 'serasa_avancado_pj';
  const isBasicoPJ = consultaId === 'serasa_basico_pj';
  const hasScoreStatic = isTopScore || isPJ; // Both PJ PME reports include score
  const hasAdvancedNeg = isTopScore || isAvancadoPJ; // Ações judiciais + falências

  const internalRef = useRef<HTMLDivElement>(null);
  const contentRef = externalRef || internalRef;
  const report = ((data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data) as GenericRecord;
  const registration = (report?.registration || {}) as GenericRecord;
  const negativeData = (report?.negativeData || {}) as GenericRecord;
  const inquiry = (report?.inquiry || {}) as GenericRecord;
  const facts = (report?.facts || {}) as GenericRecord;
  const stolenDocuments = (report?.stolenDocuments || {}) as GenericRecord;
  const optionalFeatures = (report?.optionalFeatures || {}) as GenericRecord;

  // Score - PJ H4PJ is at report.score directly; PF HRLD at optionalFeatures.scoreResponse
  // Credit limit HLC1 is at report.scores.scoreResponse[]
  const directScore = (report?.score || {}) as GenericRecord;
  const scoresSection = (report?.scores || optionalFeatures?.scores || {}) as GenericRecord;
  const scoreResponseArr = asArray(scoresSection?.scoreResponse || []);
  const creditLimitScore = scoreResponseArr.find((s: any) => s.scoreModel === 'HLC1') as GenericRecord | undefined;
  // Use direct score (H4PJ/HRLD) if available, otherwise fall back to scoreResponse array
  const mainScoreFromArr = scoreResponseArr.find((s: any) => s.scoreModel !== 'HLC1');
  const score = (directScore?.score ? directScore : mainScoreFromArr || optionalFeatures?.scoreResponse || optionalFeatures?.score || {}) as GenericRecord;

  const pefin = (negativeData?.pefinResponse || negativeData?.pefin || {}) as GenericRecord;
  const refin = (negativeData?.refinResponse || negativeData?.refin || {}) as GenericRecord;
  const convem = (negativeData?.collectionRecordsResponse || negativeData?.collectionRecords || {}) as GenericRecord;
  const checks = (negativeData?.checkResponse || negativeData?.check || {}) as GenericRecord;
  const protests = (negativeData?.notaryResponse || negativeData?.notary || {}) as GenericRecord;
  const judgements = (negativeData?.judgementFilingsResponse || negativeData?.judgementFilings || {}) as GenericRecord;
  const bankrupts = (negativeData?.bankruptsResponse || negativeData?.bankrupts || {}) as GenericRecord;

  // PJ specific - company data / QSA
  const identificationReport = (report?.identificationReport || {}) as GenericRecord;
  const qsaReport = (report?.QSAReport || report?.qsaReport || {}) as GenericRecord;
  const companyData = (qsaReport?.companyData || report?.companyData || optionalFeatures?.companyData || {}) as GenericRecord;
  const partnersList = asArray(companyData?.partnersList || companyData?.partners || []);
  const directorsList = asArray(companyData?.directorsList || companyData?.directors || []);

  // QSA partners/directors from QSAReport or fallback paths
  const qsaPartnerReport = (qsaReport?.partnerCompleteReport || qsaReport?.partnerReport || {}) as GenericRecord;
  const qsaDirectorReport = (qsaReport?.directorCompleteReport || qsaReport?.directorReport || {}) as GenericRecord;
  const qsaPartners = asArray(qsaPartnerReport?.partnersList || qsaPartnerReport?.partners || report?.qsa?.partnerResponse || report?.qsa?.partners || optionalFeatures?.qsa?.partnerResponse || []);
  const qsaDirectors = asArray(qsaDirectorReport?.directorsList || qsaDirectorReport?.directors || report?.qsa?.directorResponse || report?.qsa?.directors || optionalFeatures?.qsa?.directorResponse || []);
  const allPartners = partnersList.length > 0 ? partnersList : qsaPartners;
  const allDirectors = directorsList.length > 0 ? directorsList : qsaDirectors;

  // PJ inquiry uses inquiryCompanyResponse
  const factsInquiry = (facts?.inquiry || facts?.inquiryCompanyResponse || inquiry) as GenericRecord;
  const factsInquirySummary = (facts?.inquirySummary || {}) as GenericRecord;
  const factsStolenDocs = (facts?.stolenDocuments || stolenDocuments) as GenericRecord;

  // PJ inquiry items
  const inquiryCompanyResponse = (facts?.inquiryCompanyResponse || inquiry?.inquiryCompanyResponse || inquiry) as GenericRecord;
  const inquiryItemsPJ = asArray(pick(inquiryCompanyResponse, ['results', 'inquiryCompanyResponse'], []));
  const inquiryItemsPF = asArray(pick(factsInquiry, ['inquiryResponse'], []));
  const inquiryItems = isPJ && inquiryItemsPJ.length > 0 ? inquiryItemsPJ : inquiryItemsPF;

  // PJ inquiry quantity
  const pjInquiryQuantity = (inquiryCompanyResponse?.quantity || {}) as GenericRecord;
  const pjInquiryHistorical = asArray(pjInquiryQuantity?.historical || []);

  const checkFilingsHistorical = (report?.checkFilingsHistorical || {}) as GenericRecord;

  // PF specific
  const phones = asArray(pick(registration, ['phones', 'phoneList', 'phone'], []));
  const addresses = asArray(pick(registration, ['addresses', 'addressList', 'address'], []));
  const complementaryData = (registration?.complementaryData || registration?.additionalData || {}) as GenericRecord;
  const paymentHistory = (report?.paymentHistory || report?.historicoPagamento || optionalFeatures?.paymentHistory || {}) as GenericRecord;
  const paymentItems = asArray(pick(paymentHistory, ['paymentHistoryResponse', 'payments', 'items'], []));
  const paymentSummary = (paymentHistory?.summary || paymentHistory) as GenericRecord;
  const attributes = (optionalFeatures?.attributes || optionalFeatures?.attributesResponse || report?.attributes || {}) as GenericRecord;
  const rendaEstimada = asArray(pick(attributes, ['attributesResponse'], []));

  const participation = asArray(
    pick(report, [
      'companyData.companyParticipationResponse',
      'companyParticipationResponse',
      'partnerParticipation.participationResponse',
      'partnerParticipationResponse',
      'socialParticipation.socialParticipationResponse',
      'partnershipResponse',
    ], []),
  ) || [];
  // Fallback: try optionalFeatures and facts
  const participationFinal = participation.length > 0 ? participation : asArray(
    pick(optionalFeatures, [
      'companyParticipationResponse',
      'companyParticipation.companyParticipationResponse',
    ], []),
  ) || asArray(
    pick(facts, [
      'companyParticipationResponse',
      'companyParticipation.companyParticipationResponse',
    ], []),
  );

  const pefinItems = asArray(pick(pefin, ['pefinResponse', 'ppiResponse'], []));
  const refinItems = asArray(pick(refin, ['refinResponse', 'rpiResponse'], []));
  const convemItems = asArray(pick(convem, ['collectionRecordsResponse', 'collectionRecordsResponseDetail'], []));
  const checkItems = asArray(pick(checks, ['checkResponse', 'checkResponseDetail'], []));
  const protestItems = asArray(pick(protests, ['notaryResponse', 'notaryResponseDetail'], []));
  const stolenItems = asArray(pick(factsStolenDocs, ['stolenDocumentsResponse', 'documents'], []));
  const judgementItems = asArray(pick(judgements, ['judgementFilingsResponse'], []));
  const bankruptItems = asArray(pick(bankrupts, ['bankruptsResponse'], []));
  const checkFilingsItems = asArray(pick(checkFilingsHistorical, ['checkFilingsHistoricalResponse'], []));

  const totalNegativeValue =
    Number(pick(pefin, ['summary.balance'], 0)) +
    Number(pick(refin, ['summary.balance'], 0)) +
    Number(pick(convem, ['summary.balance'], 0)) +
    Number(pick(checks, ['summary.balance'], 0)) +
    Number(pick(protests, ['summary.balance'], 0));

  const totalNegativeCount =
    Number(pick(pefin, ['summary.count'], 0)) +
    Number(pick(refin, ['summary.count'], 0)) +
    Number(pick(convem, ['summary.count'], 0)) +
    Number(pick(checks, ['summary.count'], 0)) +
    Number(pick(protests, ['summary.count'], 0));

  // Common derived values
  const scoreValue = Number(pick(score, ['score'], 0));
  const rawDefaultRate = pick<string>(score, ['defaultRate'], '');
  // Parse raw defaultRate: "01378" → "13,78%"
  const defaultRate = (() => {
    const raw = String(rawDefaultRate || '').replace(/\D/g, '');
    if (!raw || raw.length < 3) return pick<string>(score, ['message'], '') || '';
    const num = raw.slice(0, raw.length - 2) + ',' + raw.slice(raw.length - 2);
    return num + '%';
  })();
  const defaultRateNumeric = (() => {
    const raw = String(rawDefaultRate || '').replace(/\D/g, '');
    if (!raw || raw.length < 3) return NaN;
    return parseFloat(raw.slice(0, raw.length - 2) + '.' + raw.slice(raw.length - 2));
  })();
  const scoreModel = pick<string>(score, ['scoreModel'], '');
  // Show score if statically expected OR if API returned score data
  const hasScore = hasScoreStatic || scoreValue > 0;

  // PF values
  const consumerName = String(pick(registration, ['consumerName', 'name']) || '-');
  const birthDateRaw = pick<string>(registration, ['birthDate'], '');
  const birthAge = calcAge(birthDateRaw);
  const motherName = String(pick(registration, ['motherName']) || '-');
  const gender = String(pick(registration, ['gender', 'sex']) || '-');

  // PJ values
  const companyName = String(pick(registration, ['companyName']) || pick(identificationReport, ['companyName']) || '-');
  const companyAlias = String(pick(identificationReport, ['companyAlias']) || '-');
  const companyDocument = String(pick(registration, ['companyDocument']) || '');
  const foundationDate = pick<string>(registration, ['foundationDate']) || pick<string>(identificationReport, ['companyFoundation']) || '';
  const economicActivity = String(pick(identificationReport, ['economicActivity']) || '-');
  const cnae = String(pick(identificationReport, ['cnae']) || '-');
  const numberEmployees = pick(identificationReport, ['numberEmployees']);
  const socialCapital = pick(companyData, ['socialCapitalValue', 'capitalValue', 'accomplishedValue']);
  const companyAddress = pick(registration, ['address']) || pick(identificationReport, ['address']) || {} as GenericRecord;

  const rawStatusRF = String(pick(registration, ['statusRegistration', 'documentStatus']) || pick(identificationReport, ['statusRegistration', 'statusCodeDescription']) || '-');
  // Clean "SITUACAO DO CNPJ EM DD/MM/YYYY: ATIVA" → "ATIVA"
  const statusRF = rawStatusRF.replace(/SITUACAO\s+DO\s+CNPJ\s+EM\s+\S+:\s*/i, '').trim() || rawStatusRF;
  const statusDate = formatDate(pick(registration, ['statusDate', 'updateDate']) || pick(identificationReport, ['updateDate']));

  const consultasAtual = isPJ
    ? Number(pjInquiryQuantity?.actual || 0)
    : Number(pick(factsInquirySummary, ['inquiryQuantity.actual'], 0));
  const consultasMesAnterior = isPF
    ? Number(pick(factsInquirySummary, ['inquiryQuantity.lastMonth', 'inquiryQuantity.previous'], 0))
    : 0;
  const consultasBankAtual = isPJ ? Number(pjInquiryQuantity?.bankActual || 0) : 0;
  const inquiryCount = isPJ
    ? inquiryItems.length
    : Number(pick(factsInquiry, ['summary.count'], 0));

  const displayName = isPJ ? companyName : consumerName;
  const displayDoc = isPJ
    ? formatDocument(companyDocument || docNumber)
    : formatDocument(pick(registration, ['documentNumber', 'document']) || docNumber);
  const docLabel = isPJ ? 'CNPJ' : 'CPF';
  const reportName = String(pick(report, ['reportName']) || 'RELATÓRIO').replace(/_/g, ' ');
  const docForExport = docNumber || String(pick(registration, ['documentNumber', 'document', 'companyDocument']) || 'sem-doc');

  return (
    <div className="space-y-4">
      {!hideExportButton && (
        <div className="flex justify-start">
          <SerasaPdfExport contentRef={contentRef} document={docForExport} />
        </div>
      )}
      <div ref={contentRef} className="space-y-6">

      {/* ── Header Strip ── */}
      <div className="border border-border rounded-lg bg-muted/30 px-5 py-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
        <p className="text-sm font-bold text-foreground">{reportName}</p>
        <p className="text-sm text-muted-foreground">{docLabel}: {displayDoc} | {displayName}</p>
      </div>

      {/* ── Informações fixadas ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-3">Informações fixadas</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Situação na Receita Federal */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Situação na Receita Federal</p>
            <p className="text-sm font-bold text-foreground mt-1">{statusRF}</p>
            {statusDate && statusDate !== '-' && (
              <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em {statusDate}</p>
            )}
          </div>
          {/* Score with risk level */}
          {hasScore && (() => {
            const riskLabel = scoreValue >= 801 ? 'Risco mínimo' : scoreValue >= 601 ? 'Risco muito baixo' : scoreValue >= 401 ? 'Risco baixo' : scoreValue >= 201 ? 'Risco médio' : scoreValue > 0 ? 'Risco alto' : '';
            const riskColor = scoreValue >= 601 ? 'border-green-500 text-green-600' : scoreValue >= 401 ? 'border-blue-500 text-blue-600' : scoreValue >= 201 ? 'border-amber-500 text-amber-600' : 'border-destructive text-destructive';
            return (
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{scoreValue || '-'}</span>
                {riskLabel && (
                  <Badge variant="outline" className={`${riskColor} text-[10px] px-1.5 py-0.5 whitespace-nowrap`}>
                    {riskLabel}
                  </Badge>
                )}
              </div>
              <div className="mt-2 relative h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  style={{ width: `${Math.min((scoreValue / 1000) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0</span>
                <span className="text-[10px] text-muted-foreground">500</span>
                <span className="text-[10px] text-muted-foreground">1000</span>
              </div>
            </div>
            );
          })()}
          {/* Ocorrência de anotações negativas */}
          {isPJ ? (() => {
            const partnersWithAnnotations = allPartners.filter((p: any) => p.hasNegativeData === true || p.negativeData === true || p.hasAnnotations === true || p.restrictionSign === true || String(p.annotations || '').toLowerCase() === 'sim').length;
            const directorsWithAnnotations = allDirectors.filter((d: any) => d.hasNegativeData === true || d.negativeData === true || d.hasAnnotations === true || d.restrictionSign === true || String(d.annotations || '').toLowerCase() === 'sim').length;
            const totalAnnotations = partnersWithAnnotations + directorsWithAnnotations;
            return (
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Ocorrência de anotações negativas</p>
              {totalAnnotations > 0 ? (
                <>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {partnersWithAnnotations} | {directorsWithAnnotations}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Sócios | Administradores</p>
                </>
              ) : (
                <p className="text-sm font-bold text-foreground mt-1">Sem registros</p>
              )}
            </div>
            );
          })() : (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Total em anotações negativas</p>
            <p className={`text-sm font-bold mt-1 ${totalNegativeCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {totalNegativeValue > 0 ? formatCurrency(totalNegativeValue) : 'Sem registros'}
            </p>
            {totalNegativeCount > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{totalNegativeCount} registros</p>
            )}
          </div>
          )}
          {/* Consultas últimos 13 meses (PJ) / Consultas mês (PF) */}
          {isPJ ? (() => {
            const total13Months = pjInquiryHistorical.reduce((sum: number, item: any) => sum + Number(item?.occurrences || item?.quantity || item?.count || 0), 0) + consultasAtual;
            return (
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {total13Months > 0 ? `${total13Months} consultas` : 'Sem consultas'}
                </p>
                {total13Months > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Consultas nos últimos 13 meses</p>
            </div>
            );
          })() : (
          <>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              {consultasAtual > 0 ? `${consultasAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Consultas neste mês</p>
          </div>
          </>
          )}
          {/* Capital social (PJ) / Participação societária (PF) */}
          {isPJ ? (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Capital social</p>
            <p className="text-sm font-bold text-foreground mt-1">{socialCapital ? formatCurrency(socialCapital) : 'Sem dados'}</p>
          </div>
          ) : (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Participação societária</p>
            <p className="text-sm font-bold text-foreground mt-1">{participation.length}</p>
          </div>
          )}
        </div>
        {/* Consultas no mês passado (PF only) */}
        {isPF && consultasMesAnterior > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {consultasMesAnterior} consulta{consultasMesAnterior !== 1 ? 's' : ''}
                </p>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Consultas no mês passado</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ PJ-SPECIFIC SECTIONS ═══════════════════ */}
      {isPJ && (
      <>
      {/* ── Dados Cadastrais PJ ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Dados Cadastrais</p>
        <p className="text-[11px] text-muted-foreground mb-3">Atualizado em {statusDate}</p>

        {/* Top summary grid */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Situação Cadastral</p>
            <p className="text-xs font-bold text-foreground mt-1">{statusRF}</p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Fundação em</p>
            <p className="text-xs font-bold text-foreground mt-1">{formatDate(foundationDate)}</p>
            {foundationDate && (() => {
              const fd = new Date(String(foundationDate));
              if (!isNaN(fd.getTime())) {
                const years = Math.floor((Date.now() - fd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                return <p className="text-[10px] text-muted-foreground">{years} anos</p>;
              }
              return null;
            })()}
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Município/UF</p>
            <p className="text-xs font-bold text-foreground mt-1">
              {joinLocation(companyAddress?.city || pick(registration, ['address.city']), companyAddress?.state || companyAddress?.federalUnit || pick(registration, ['address.state']))}
            </p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Ramo de atividade</p>
            <p className="text-xs font-bold text-foreground mt-1 leading-tight">{economicActivity}</p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Tipo de sociedade</p>
            <p className="text-xs font-bold text-foreground mt-1 leading-tight">
              {String(pick(identificationReport, ['companyType', 'socialObject', 'natureOfBusiness']) || 'Sem dados')}
            </p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Nº funcionários</p>
            <p className="text-xs font-bold text-foreground mt-1">{numberEmployees ?? 'Sem dados'}</p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Filiais</p>
            <p className="text-xs font-bold text-foreground mt-1">
              {String(pick(identificationReport, ['branchesQuantity', 'branches', 'filials']) || 'Sem dados')}
            </p>
          </div>
          <div className="border border-border rounded-lg p-2 aspect-square flex flex-col justify-center">
            <p className="text-[10px] font-medium text-muted-foreground">Opção Tributária</p>
            <p className="text-xs font-bold text-foreground mt-1">
              {String(pick(identificationReport, ['taxOption', 'tributaryOption', 'opcaoTributaria', 'taxRegime']) || 'Sem dados')}
            </p>
          </div>
        </div>

        {/* Detailed data - list format */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Dados cadastrais</p>
        <div className="border border-border rounded-lg divide-y divide-border text-sm">
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Nome fantasia:</span>
            <span className="text-xs text-foreground">{companyAlias !== '-' ? companyAlias : '-'}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Endereço:</span>
            <span className="text-xs text-foreground">
              {(() => {
                const addr = companyAddress;
                if (!addr || typeof addr !== 'object') return '-';
                const parts = [addr.street, addr.number, addr.complement, addr.neighborhood ? `- ${addr.neighborhood}` : '', addr.city ? `${addr.city}` : '', addr.state ? `- ${addr.state}` : '', addr.zipCode].filter(Boolean);
                return parts.join(', ') || '-';
              })()}
            </span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Site:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['website', 'site']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Telefone:</span>
            <span className="text-xs text-foreground">{String(pick(registration, ['phone', 'telephone']) || pick(identificationReport, ['phone', 'telephone']) || '-')}</span>
          </div>
        </div>

        {/* Outros dados */}
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Outros dados</p>
        <div className="border border-border rounded-lg divide-y divide-border text-sm">
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">CNAE:</span>
            <span className="text-xs text-foreground">{cnae}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Ramo de atividade econômica:</span>
            <span className="text-xs text-foreground">{economicActivity}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Inscrição estadual:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['stateRegistration', 'inscricaoEstadual']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">NIRE:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['nire', 'boardOfTradeRegistration']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Registro:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['registrationNumber', 'registro']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Data do registro:</span>
            <span className="text-xs text-foreground">{formatDate(pick(identificationReport, ['registrationDate', 'dataRegistro']))}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Código de atividade Serasa:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['serasaActivityCode', 'activityCode']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Empresa antecessora:</span>
            <span className="text-xs text-foreground">
              {(() => {
                const predecessors = asArray(pick(identificationReport, ['predecessorList', 'predecessorCompany'], []));
                if (predecessors.length > 0) {
                  return predecessors.map((p: any, i: number) => (
                    <span key={i}>{typeof p === 'string' ? p : (p.companyName || p.name || '-')}{p.documentId ? ` (${formatDocument(p.documentId)})` : ''}{i < predecessors.length - 1 ? '; ' : ''}</span>
                  ));
                }
                const single = pick(identificationReport, ['predecessorCompany', 'previousCompany', 'antecessora']);
                return String(single || '-');
              })()}
            </span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Importação sobre compras:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['importPercentage', 'importOnPurchases', 'importacaoCompras']) || '-')}</span>
          </div>
          <div className="px-4 py-2 flex gap-2">
            <span className="text-muted-foreground text-xs font-medium shrink-0">Exportação sobre vendas:</span>
            <span className="text-xs text-foreground">{String(pick(identificationReport, ['exportPercentage', 'exportOnSales', 'exportacaoVendas']) || '-')}</span>
          </div>
        </div>
      </div>

      {/* ── Serasa Score Empresas ── */}
      {hasScore && (() => {
        const riskLabel = scoreValue >= 801 ? 'Risco mínimo' : scoreValue >= 601 ? 'Risco muito baixo' : scoreValue >= 401 ? 'Risco baixo' : scoreValue >= 201 ? 'Risco médio' : scoreValue > 0 ? 'Risco alto' : '';
        const riskColor = scoreValue >= 601 ? 'border-green-500 text-green-600' : scoreValue >= 401 ? 'border-blue-500 text-blue-600' : scoreValue >= 201 ? 'border-amber-500 text-amber-600' : 'border-destructive text-destructive';
        const riskCreditLabel = scoreValue >= 601 ? 'Baixo' : scoreValue >= 401 ? 'Médio' : scoreValue >= 201 ? 'Médio' : 'Alto';
        const marketPractice = scoreValue >= 601 ? 'Venda a prazo' : scoreValue >= 401 ? 'Venda a prazo com cautela' : scoreValue >= 201 ? 'Venda com garantias adicionais' : 'Venda somente à vista';

        // Score range interpretation
        const scoreLow = Math.floor(scoreValue / 50) * 50 + 1;
        const scoreHigh = scoreLow + 49;

        return (
        <div>
          <p className="text-sm font-semibold text-primary mb-1">Serasa Score Empresas</p>
          <p className="text-[11px] text-muted-foreground mb-3">Nossa análise de risco de crédito que indica a probabilidade da empresa pagar suas contas em dia nos próximos 12 meses</p>
          <hr className="border-border mb-4" />

          {/* Score bar */}
          <div className="border border-border rounded-lg p-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl font-bold text-foreground">{scoreValue || '-'}</span>
              {riskLabel && (
                <Badge variant="outline" className={`${riskColor} text-xs px-2 py-0.5`}>
                  {riskLabel}
                </Badge>
              )}
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-1">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
                style={{ width: `${Math.min((scoreValue / 1000) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">0</span>
              <span className="text-[10px] text-muted-foreground">500</span>
              <span className="text-[10px] text-muted-foreground">1000</span>
            </div>
          </div>

          {/* 3 info cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground">{defaultRate || '-'}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Probabilidade de inadimplência</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground">{riskCreditLabel}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Risco de Crédito</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-sm font-bold text-foreground">{marketPractice}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Prática de Mercado</p>
            </div>
          </div>

          {/* Interpretação */}
          <div className="border border-border rounded-lg p-4 mb-3">
            <p className="text-xs font-semibold text-foreground mb-2">Interpretação</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              <li>A pontuação enquadra-se na faixa de {scoreLow} a {scoreHigh} e representa {scoreValue >= 601 ? 'bons indicadores' : scoreValue >= 401 ? 'indicadores moderados' : scoreValue >= 201 ? 'sinais de vulnerabilidades' : 'sinais críticos de vulnerabilidades'} da sua capacidade de pagamento.</li>
              <li>Para empresas com este perfil de risco, é prática de mercado {scoreValue >= 601 ? 'conceder crédito com políticas padrão de venda a prazo.' : scoreValue >= 401 ? 'conceder crédito com acompanhamento periódico do perfil de risco.' : 'conceder crédito com maior rigor na decisão, valendo-se de garantias adicionais e constantes monitoramentos do perfil de risco.'}</li>
              {!isNaN(defaultRateNumeric) && <li>Empresas com esta categoria de risco costumam honrar os compromissos de pagamentos assumidos em {(100 - defaultRateNumeric).toFixed(2).replace('.', ',')}% das operações</li>}
            </ul>
          </div>

          {/* Atenção */}
          <div className="border border-amber-300 rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground mb-1">Atenção</p>
            <p className="text-[11px] text-muted-foreground">
              A decisão da aprovação ou não do crédito é de exclusiva responsabilidade do concedente. As informações prestadas pela Serasa Experian têm o objetivo de subsidiar essas decisões e, em hipótese alguma, devem ser utilizadas como justificativa pelo concedente do crédito, para a tomada da referida decisão.
            </p>
          </div>
        </div>
        );
      })()}

      {/* ── Anotações Negativas PJ ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Anotações Negativas</p>
        <p className="text-xs text-muted-foreground mb-4">
          Detalhamento sobre as anotações negativas da empresa de acordo com diversas fontes.
        </p>

        {/* Resumo */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-primary mb-1">Resumo</p>
          <p className="text-xs text-foreground mb-3">
            Total de dívidas: <span className="font-bold">{formatCurrency(totalNegativeValue)}</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <NegSummaryBox label="PEFIN" value={pick(pefin, ['summary.balance'], 0)} count={pick(pefin, ['summary.count'], 0)} />
            <NegSummaryBox label="REFIN" value={pick(refin, ['summary.balance'], 0)} count={pick(refin, ['summary.count'], 0)} />
            <NegSummaryBox label="Dívidas vencidas" value={pick(convem, ['summary.balance'], 0)} count={pick(convem, ['summary.count'], 0)} />
            <NegSummaryBox label="Falência / Rec. judicial" value={pick(bankrupts, ['summary.balance'], 0)} count={pick(bankrupts, ['summary.count'], bankruptItems.length)} />
            <NegSummaryBox label="Ações Judiciais" value={pick(judgements, ['summary.balance'], 0)} count={pick(judgements, ['summary.count'], judgementItems.length)} />
            <NegSummaryBox label="Protestos" value={pick(protests, ['summary.balance'], 0)} count={pick(protests, ['summary.count'], 0)} />
            <NegSummaryBox label="Cheque" value={pick(checks, ['summary.balance'], 0)} count={pick(checks, ['summary.count'], 0)} />
          </div>
        </div>

        {/* Tabelas individuais PJ */}
        <NegDetailTable title="REFIN" rows={refinItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Valor', render: (item) => formatCurrency(item.amount) },
          { header: 'Modalidade', render: (item) => item.legalNature || '-' },
          { header: 'Contrato', render: (item) => item.contractId || '-' },
          { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
        ]} />
        <NegDetailTable title="PEFIN" rows={pefinItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Valor', render: (item) => formatCurrency(item.amount) },
          { header: 'Modalidade', render: (item) => item.legalNature || '-' },
          { header: 'Contrato', render: (item) => item.contractId || '-' },
          { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
        ]} />
        <NegDetailTable title="Dívidas vencidas" rows={convemItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Valor', render: (item) => formatCurrency(item.amount) },
          { header: 'Modalidade', render: (item) => item.legalNature || '-' },
          { header: 'Contrato', render: (item) => item.contractId || '-' },
          { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
        ]} />
        <NegDetailTable title="Protestos" rows={protestItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Valor', render: (item) => formatCurrency(item.amount) },
          { header: 'Cidade', render: (item) => item.city || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
          { header: 'N° do Cartório', render: (item) => item.notaryOfficeNumber || item.officeNumber || '-' },
        ]} />
        <NegDetailTable title="Cheques sem fundo" rows={checkItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Banco', render: (item) => item.bankName || '-' },
          { header: 'Agência', render: (item) => item.bankAgencyId || item.branch || '-' },
          { header: 'Nº Cheque', render: (item) => item.checkNumber || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
        ]} />
        {hasAdvancedNeg && (
        <NegDetailTable title="Ações Judiciais" rows={judgementItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Valor', render: (item) => formatCurrency(item.amount) },
          { header: 'Natureza', render: (item) => item.legalNature || '-' },
          { header: 'Distribuidor', render: (item) => item.distributor || '-' },
          { header: 'Vara', render: (item) => item.civilCourt || '-' },
          { header: 'Cidade', render: (item) => item.city || '-' },
          { header: 'UF', render: (item) => item.state || item.federalUnit || '-' },
        ]} />
        )}
        {hasAdvancedNeg && (
        <NegDetailTable title="Falências / Recuperação Judicial" rows={bankruptItems} columns={[
          { header: 'Data', render: (item) => formatDate(item.eventDate || item.occurrenceDate) },
          { header: 'Tipo', render: (item) => item.eventType || '-' },
          { header: 'Origem', render: (item) => item.origin || '-' },
          { header: 'Vara', render: (item) => item.varaCourt || '-' },
          { header: 'Cidade', render: (item) => item.city || '-' },
          { header: 'UF', render: (item) => item.state || '-' },
        ]} />
        )}
      </div>

      {/* ── Quadro Societário PJ ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Quadro Societário</p>
        <p className="text-xs text-muted-foreground mb-3">
          Composição dos sócios e administradores da empresa. Atualizado em {statusDate}
        </p>

        {/* Capital info grid */}
        {(() => {
          const capitalSocialFmt = socialCapital ? formatCurrency(socialCapital) : '-';
          const capitalRealizado = pick(companyData, ['capitalRealized', 'realizedCapitalValue']);
          const capitalType = String(pick(companyData, ['capitalType', 'typeOfCapital']) || 'FECHADO');
          const controlType = String(pick(companyData, ['controlType', 'typeOfControl']) || 'PRIVADO');
          const origin = String(pick(companyData, ['origin', 'capitalOrigin']) || 'BRASIL');
          const pAnnot = allPartners.filter((p: any) => p.hasNegative === true || p.restrictionSign === true || String(p.annotations || '').toLowerCase() === 'sim').length;
          const dAnnot = allDirectors.filter((d: any) => d.hasNegative === true || d.restrictionSign === true || String(d.annotations || '').toLowerCase() === 'sim').length;
          return (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Capital social</p>
              <p className="text-xs font-bold text-foreground mt-1">{capitalSocialFmt}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Capital realizado</p>
              <p className="text-xs font-bold text-foreground mt-1">{capitalRealizado ? formatCurrency(capitalRealizado) : capitalSocialFmt}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Tipo de capital</p>
              <p className="text-xs font-bold text-foreground mt-1">{capitalType}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Tipo de controle</p>
              <p className="text-xs font-bold text-foreground mt-1">{controlType}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Origem</p>
              <p className="text-xs font-bold text-foreground mt-1">{origin}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Ocorrência de anotações negativas</p>
              <p className="text-xs font-bold text-foreground mt-1">{pAnnot} | {dAnnot}</p>
              <p className="text-[10px] text-muted-foreground">Sócios | Administradores</p>
            </div>
          </div>
          );
        })()}

        {/* Sócios e acionistas */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Sócios e acionistas</p>
        {allPartners.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-4">Nenhum sócio encontrado.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Capital</TableHead>
                  <TableHead className="text-xs font-medium">Capital votante</TableHead>
                  <TableHead className="text-xs font-medium">Sócio/Acionista</TableHead>
                  <TableHead className="text-xs font-medium">CPF/CNPJ</TableHead>
                  <TableHead className="text-xs font-medium">Entrada</TableHead>
                  <TableHead className="text-xs font-medium">Nacionalidade</TableHead>
                  <TableHead className="text-xs font-medium">Anotações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPartners.map((p: any, i: number) => {
                  const hasNeg = p.hasNegative === true || p.restrictionSign === true || String(p.annotations || '').toLowerCase() === 'sim';
                  return (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{p.participationPercentage != null ? `${p.participationPercentage}%` : p.capitalTotalValue != null ? `${p.capitalTotalValue}%` : '-'}</TableCell>
                    <TableCell className="text-xs py-2">{p.votingCapitalPercentage != null ? `${p.votingCapitalPercentage}%` : '0%'}</TableCell>
                    <TableCell className="text-xs py-2 font-medium">{p.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDocument(p.documentId || p.document || '')}</TableCell>
                    <TableCell className="text-xs py-2">{formatDate(p.entryDate || p.startDate)}</TableCell>
                    <TableCell className="text-xs py-2">{p.nationality || 'BRASIL'}</TableCell>
                    <TableCell className="text-xs py-2">
                      {hasNeg ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">Sim <AlertTriangle className="h-3.5 w-3.5" /></span>
                      ) : <span className="text-muted-foreground">Não</span>}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Administradores */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Administradores</p>
        {allDirectors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum administrador encontrado.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Nome</TableHead>
                  <TableHead className="text-xs font-medium">Cargo</TableHead>
                  <TableHead className="text-xs font-medium">CPF/CNPJ</TableHead>
                  <TableHead className="text-xs font-medium">Entrada</TableHead>
                  <TableHead className="text-xs font-medium">Mandato</TableHead>
                  <TableHead className="text-xs font-medium">Nacionalidade</TableHead>
                  <TableHead className="text-xs font-medium">Estado Civil</TableHead>
                  <TableHead className="text-xs font-medium">Anotações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDirectors.map((d: any, i: number) => {
                  const hasNeg = d.hasNegative === true || d.restrictionSign === true || String(d.annotations || '').toLowerCase() === 'sim';
                  return (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2 font-medium">{d.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{d.role || d.office || 'ADMINISTRADOR'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDocument(d.documentId || d.document || '')}</TableCell>
                    <TableCell className="text-xs py-2">{formatDate(d.entryDate || d.startDate)}</TableCell>
                    <TableCell className="text-xs py-2">{d.mandate || d.mandatePeriod || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{d.nationality || 'BRASIL'}</TableCell>
                    <TableCell className="text-xs py-2">{d.maritalStatus || d.civilStatus || '-'}</TableCell>
                    <TableCell className="text-xs py-2">
                      {hasNeg ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">Sim <AlertTriangle className="h-3.5 w-3.5" /></span>
                      ) : <span className="text-muted-foreground">Não</span>}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Warning if annotations exist */}
        {(() => {
          const hasAnyNeg = allPartners.some((p: any) => p.hasNegative === true || p.restrictionSign === true || String(p.annotations || '').toLowerCase() === 'sim')
            || allDirectors.some((d: any) => d.hasNegative === true || d.restrictionSign === true || String(d.annotations || '').toLowerCase() === 'sim');
          if (!hasAnyNeg) return null;
          return (
          <div className="border border-amber-300 rounded-lg p-3 mt-2">
            <p className="text-xs font-semibold text-foreground mb-1">Alguns sócios e administradores possuem anotações negativas</p>
            <p className="text-[11px] text-muted-foreground">
              A informação disponibilizada está de acordo com a última atualização do órgão emissor responsável, contudo, a somatória do percentual de participação do capital difere de 100%.
            </p>
          </div>
          );
        })()}
      </div>
      </>
      )}

      {/* ═══════════════════ PF-SPECIFIC SECTIONS ═══════════════════ */}
      {isPF && (
      <>
      {/* ── Identificação Cadastral PF ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-3">Identificação Cadastral</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Situação na Receita Federal</p>
            <p className="text-sm font-bold text-foreground mt-1">{statusRF}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em {statusDate}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Data de Nascimento</p>
            <p className="text-sm font-bold text-foreground mt-1">{birthAge !== null ? `${birthAge} anos` : '-'}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(birthDateRaw)}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Município/UF</p>
            <p className="text-sm font-bold text-foreground mt-1">{joinLocation(pick(registration, ['city']), pick(registration, ['federalUnit']))}</p>
          </div>
        </div>

        {isTopScore && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Dados cadastrais</p>
        <div className="overflow-x-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium">Nome completo</TableHead>
                <TableHead className="text-xs font-medium">CPF</TableHead>
                <TableHead className="text-xs font-medium">Data de nascimento</TableHead>
                <TableHead className="text-xs font-medium">Nome da mãe</TableHead>
                <TableHead className="text-xs font-medium">Sexo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs py-2">{consumerName}</TableCell>
                <TableCell className="text-xs py-2">{displayDoc}</TableCell>
                <TableCell className="text-xs py-2">{formatDate(birthDateRaw)}</TableCell>
                <TableCell className="text-xs py-2">{motherName}</TableCell>
                <TableCell className="text-xs py-2">{gender}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        </>
        )}

        {!isTopScore && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Outros Dados Cadastrais</p>
        <div className="border border-border rounded-lg p-3">
          <p className="text-sm text-foreground">
            <span className="font-bold">Nome da Mãe:</span>{' '}
            {motherName}
          </p>
        </div>
        </>
        )}

        {isTopScore && phones.length > 0 && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Telefones</p>
        <div className="overflow-x-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium">Prioridade</TableHead>
                <TableHead className="text-xs font-medium">Tipo</TableHead>
                <TableHead className="text-xs font-medium">Telefone</TableHead>
                <TableHead className="text-xs font-medium">Data de atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phones.map((phone: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs py-2">{phone.priority || phone.phonePriority || '-'}</TableCell>
                  <TableCell className="text-xs py-2">{phone.type || phone.phoneType || '-'}</TableCell>
                  <TableCell className="text-xs py-2">{phone.phoneNumber || phone.number || phone.areaCode ? `${phone.areaCode || ''}${phone.phoneNumber || phone.number || ''}` : '-'}</TableCell>
                  <TableCell className="text-xs py-2">{formatDate(phone.updateDate || phone.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
        )}

        {isTopScore && addresses.length > 0 && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Endereços</p>
        <div className="overflow-x-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium">Prioridade</TableHead>
                <TableHead className="text-xs font-medium">Endereço</TableHead>
                <TableHead className="text-xs font-medium">Data de atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addresses.map((addr: any, i: number) => {
                const fullAddr = [addr.streetTitle, addr.streetName, addr.houseNumber, addr.complement, addr.neighborhood ? `- ${addr.neighborhood}` : '', addr.city, addr.federalUnit ? `- ${addr.federalUnit}` : '', addr.zipCode].filter(Boolean).join(' ') || addr.address || addr.fullAddress || '-';
                return (
                <TableRow key={i}>
                  <TableCell className="text-xs py-2">{addr.priority || addr.addressPriority || '-'}</TableCell>
                  <TableCell className="text-xs py-2 max-w-md">{fullAddr}</TableCell>
                  <TableCell className="text-xs py-2">{formatDate(addr.updateDate || addr.date)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </>
        )}

        {isTopScore && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Informações cadastrais complementares</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Estado civil</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['maritalStatus', 'civilStatus']) || pick(complementaryData, ['maritalStatus']) || '-')}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Escolaridade</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['educationLevel', 'education']) || pick(complementaryData, ['educationLevel']) || '-')}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Profissão</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['profession', 'occupation']) || pick(complementaryData, ['profession']) || '-')}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Dependentes</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['dependents', 'numberOfDependents']) || pick(complementaryData, ['dependents']) || '-')}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">UF de Nascimento</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['birthFederalUnit', 'birthState']) || pick(complementaryData, ['birthFederalUnit']) || '-')}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Cidade de nascimento</p>
            <p className="text-sm font-bold text-foreground mt-1">{String(pick(registration, ['birthCity']) || pick(complementaryData, ['birthCity']) || '-')}</p>
          </div>
        </div>
        </>
        )}
      </div>

      {/* ── Serasa Score PF (show when score data available) ── */}
      {scoreValue > 0 && (() => {
        const paymentChance = !isNaN(defaultRateNumeric) ? (100 - defaultRateNumeric).toFixed(2).replace('.', ',') + '%' : '';
        const paymentChanceLabel = paymentChance ? `${paymentChance} de chance de pagamento` : '';
        return (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Serasa Score</p>
        <p className="text-xs text-muted-foreground mb-3">
          Nossa análise de risco de crédito que indica a probabilidade do indivíduo pagar suas contas em dia nos próximos 12 meses
        </p>

        <div className="border border-border rounded-lg p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold text-foreground">{scoreValue || '-'}</span>
            {paymentChanceLabel && (
              <Badge variant="outline" className="border-green-500 text-green-600 text-[11px] px-2 py-0.5">
                {paymentChanceLabel}
              </Badge>
            )}
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              style={{ width: `${Math.min((scoreValue / 1000) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">500</span>
            <span className="text-[10px] text-muted-foreground">1000</span>
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 mb-3">
          <p className="text-xs font-bold text-foreground mb-1">Interpretação</p>
          <p className="text-xs text-muted-foreground">
            {`A chance de um consumidor, com score entre ${Math.floor(scoreValue / 100) * 100 + 1} e ${(Math.floor(scoreValue / 100) + 1) * 100}, pagar seus compromissos financeiros nos próximos 12 meses é de ${paymentChance || '-'}`}
          </p>
        </div>

        <div className="border border-border rounded-lg p-3 border-dashed">
          <p className="text-xs font-bold text-foreground mb-1">Atenção</p>
          <p className="text-xs text-muted-foreground">
            A decisão da aprovação ou não do crédito é de exclusiva responsabilidade do concedente. As informações prestadas pela Serasa Experian têm o objetivo de subsidiar essas decisões e, em hipótese alguma, devem ser utilizadas como justificativa pelo concedente do crédito, para tomada da referida decisão.
          </p>
        </div>
      </div>
        );
      })()}
      </>
      )}

      {/* ═══════════════════ SHARED SECTIONS ═══════════════════ */}

      {/* ── Anotações Negativas (PF) ── */}
      {isPF && (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Anotações Negativas</p>
        <p className="text-xs text-muted-foreground mb-4">
          Detalhamento sobre as anotações negativas {isPJ ? 'da empresa' : 'do indivíduo'} de acordo com diversas fontes.
        </p>

        {/* Resumo */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-primary mb-1">Resumo</p>
          <p className="text-xs text-foreground mb-3">
            Total de dívidas: <span className="font-bold">{formatCurrency(totalNegativeValue)}</span>
          </p>

          <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${hasAdvancedNeg ? 'xl:grid-cols-4' : 'xl:grid-cols-6'}`}>
            <NegSummaryBox label="Total em anotações negativas" value={totalNegativeValue} count={totalNegativeCount} />
            <NegSummaryBox label="Dívidas comerciais - Pefin" value={pick(pefin, ['summary.balance'], 0)} count={pick(pefin, ['summary.count'], 0)} />
            <NegSummaryBox label="Dívidas em Instituições Financeiras - Refin" value={pick(refin, ['summary.balance'], 0)} count={pick(refin, ['summary.count'], 0)} />
            <NegSummaryBox label="Dívidas vencidas - Convem" value={pick(convem, ['summary.balance'], 0)} count={pick(convem, ['summary.count'], 0)} />
            <NegSummaryBox label="Dívidas Protestadas" value={pick(protests, ['summary.balance'], 0)} count={pick(protests, ['summary.count'], 0)} />
            <NegSummaryBox label="Cheques sem fundo BACEN" value={pick(checks, ['summary.balance'], 0)} count={pick(checks, ['summary.count'], 0)} />
            {hasAdvancedNeg && (
            <>
            <NegSummaryBox label="Ações Judiciais" value={pick(judgements, ['summary.balance'], 0)} count={pick(judgements, ['summary.count'], judgementItems.length)} />
            <NegSummaryBox label="Falências" value={pick(bankrupts, ['summary.balance'], 0)} count={pick(bankrupts, ['summary.count'], bankruptItems.length)} />
            </>
            )}
          </div>
        </div>

        {/* Tabelas individuais */}
        <NegDetailTable
          title="Dívidas em Instituições Financeiras - Refin"
          rows={refinItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Valor', render: (item) => formatCurrency(item.amount) },
            { header: 'Modalidade', render: (item) => item.legalNature || '-' },
            { header: 'Contrato', render: (item) => item.contractId || '-' },
            { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
            { header: 'Avalista', render: (item) => yesNo(item.principal === false) },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />

        <NegDetailTable
          title="Dívidas comerciais - Pefin"
          rows={pefinItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Valor', render: (item) => formatCurrency(item.amount) },
            { header: 'Modalidade', render: (item) => item.legalNature || '-' },
            { header: 'Contrato', render: (item) => item.contractId || '-' },
            { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
            { header: 'Avalista', render: (item) => yesNo(item.principal === false) },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />

        <NegDetailTable
          title="Dívidas vencidas - Convem"
          rows={convemItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Valor', render: (item) => formatCurrency(item.amount) },
            { header: 'Modalidade', render: (item) => item.legalNature || '-' },
            { header: 'Contrato', render: (item) => item.contractId || '-' },
            { header: 'Origem', render: (item) => item.creditorName || item.bankName || '-' },
            { header: 'Avalista', render: (item) => yesNo(item.principal === false) },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />

        <NegDetailTable
          title={isPJ ? 'Protestos Nacionais' : 'Dívidas Protestadas (Registradas em cartório)'}
          rows={protestItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Valor', render: (item) => formatCurrency(item.amount) },
            { header: 'Cidade', render: (item) => item.city || '-' },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
            { header: 'N° do Cartório', render: (item) => item.notaryOfficeNumber || item.officeNumber || '-' },
          ]}
        />

        <NegDetailTable
          title="Cheques sem fundo BACEN"
          rows={checkItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Quantidade', render: (item) => item.checkCount || item.quantity || '-' },
            { header: 'Banco', render: (item) => item.bankName || '-' },
            { header: 'Agência', render: (item) => item.bankAgencyId || item.branch || '-' },
            { header: 'Nº Cheque', render: (item) => item.checkNumber || '-' },
            { header: 'Cidade', render: (item) => item.city || '-' },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />

        {hasAdvancedNeg && (
        <NegDetailTable
          title="Ações Judiciais"
          rows={judgementItems}
          columns={[
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'Valor', render: (item) => formatCurrency(item.amount) },
            { header: 'Natureza', render: (item) => item.legalNature || '-' },
            { header: 'Distribuidor', render: (item) => item.distributor || '-' },
            { header: 'Vara', render: (item) => item.civilCourt || '-' },
            { header: 'Cidade', render: (item) => item.city || '-' },
            { header: 'UF', render: (item) => item.state || item.federalUnit || '-' },
          ]}
        />
        )}

        {hasAdvancedNeg && (
        <NegDetailTable
          title="Falências"
          rows={bankruptItems}
          columns={isPJ ? [
            { header: 'Data', render: (item) => formatDate(item.eventDate || item.occurrenceDate) },
            { header: 'Tipo', render: (item) => item.eventType || '-' },
            { header: 'Origem', render: (item) => item.origin || '-' },
            { header: 'Vara', render: (item) => item.varaCourt || '-' },
            { header: 'Cidade', render: (item) => item.city || '-' },
            { header: 'UF', render: (item) => item.state || '-' },
          ] : [
            { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
            { header: 'CNPJ', render: (item) => item.companyDocumentId || '-' },
            { header: 'Empresa', render: (item) => item.companyName || '-' },
            { header: 'Tipo', render: (item) => item.companyLegalNature || item.eventType || '-' },
          ]}
        />
        )}
      </div>
      )}

      {/* ── Participações Societárias (PF only) ── */}
      {isPF && (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Participações Societárias</p>
        <p className="text-xs text-muted-foreground mb-3">
          Vínculos do documento como sócio em outras empresas.
        </p>

        <div className="border border-border rounded-lg p-3 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground">Participação societária</p>
          <p className="text-sm font-bold text-foreground">{participation.length}</p>
        </div>

        <p className="text-xs text-muted-foreground mb-2">Detalhes das participações societárias</p>
        {participation.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro para este documento.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Empresa</TableHead>
                  <TableHead className="text-xs font-medium">Documento</TableHead>
                  <TableHead className="text-xs font-medium">Participação</TableHead>
                  <TableHead className="text-xs font-medium">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participation.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{item.companyName || item.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDocument(item.documentNumber || item.document)}</TableCell>
                    <TableCell className="text-xs py-2">{item.percentage || item.participationPercentage || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.status || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      )}

      {/* ── Renda Estimada (PF Top Score only) ── */}
      {isTopScore && rendaEstimada.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-primary mb-3">Renda Estimada</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rendaEstimada.map((item: any, i: number) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Modelo: {item.attributeModel || '-'}</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  {item.scoring ? formatCurrency(item.scoring) : '-'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.message || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cheques Sustados (PF Top Score only) ── */}
      {isTopScore && checkFilingsItems.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-primary mb-3">Cheques Sustados (Contumácia)</p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Banco</TableHead>
                  <TableHead className="text-xs font-medium">Agência</TableHead>
                  <TableHead className="text-xs font-medium">Conta</TableHead>
                  <TableHead className="text-xs font-medium">Cheque Inicial</TableHead>
                  <TableHead className="text-xs font-medium">Cheque Final</TableHead>
                  <TableHead className="text-xs font-medium">Valor</TableHead>
                  <TableHead className="text-xs font-medium">Motivo</TableHead>
                  <TableHead className="text-xs font-medium">Data Inclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkFilingsItems.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{item.bankName || item.bankNumber || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.agencyNumber || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.accountNumberCheck || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.initialCheckNumber || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.finalCheckNumber || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatCurrency(item.checkAmount)}</TableCell>
                    <TableCell className="text-xs py-2">{item.briefDescriptionReason || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDate(item.dateTimeInclusion)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Documentos Roubados (PF) ── */}
      {isPF && (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Documentos Roubados</p>

        <div className="border border-border rounded-lg p-3 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground">Documentos roubados</p>
          <p className="text-sm font-bold text-foreground">{stolenItems.length > 0 ? `${stolenItems.length} ocorrências` : 'Sem ocorrências'}</p>
        </div>

        <p className="text-xs text-muted-foreground mb-2">Documentos roubados, furtados ou extraviados</p>
        {stolenItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro para este documento.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Documento</TableHead>
                  <TableHead className="text-xs font-medium">Data</TableHead>
                  <TableHead className="text-xs font-medium">Origem</TableHead>
                  <TableHead className="text-xs font-medium">UF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stolenItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{item.documentType || item.type || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDate(item.occurrenceDate || item.date)}</TableCell>
                    <TableCell className="text-xs py-2">{item.source || item.institution || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.federalUnit || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      )}

      {/* ── Consultas à Serasa Experian ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Consultas à Serasa Experian</p>
        <p className="text-xs text-muted-foreground mb-3">
          Detalhamento {isPJ ? 'das consultas ao CNPJ consultado' : 'do mês atual e do mês anterior de consultas deste documento'}.
        </p>

        {/* Bar chart - pure divs for PDF export compatibility */}
        {isPJ ? (
          <InquiryBarChartPJ historical={pjInquiryHistorical} />
        ) : (
          <InquiryBarChart inquiryItems={inquiryItems} />
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-[11px] text-muted-foreground">{isPJ ? 'Empresas' : 'Crédito'}</span>
          {isPJ && (
          <>
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-[11px] text-muted-foreground">Bancos/Financeiras</span>
          </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-bold text-foreground">
              {consultasAtual > 0 ? `${consultasAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isPJ ? 'Consultas de empresas neste mês' : 'Consultas neste mês'}
            </p>
          </div>
          {isPJ ? (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-bold text-foreground">
              {consultasBankAtual > 0 ? `${consultasBankAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground">Consultas de bancos neste mês</p>
          </div>
          ) : (
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-foreground">
                {inquiryCount > 0 ? `${inquiryCount} consultas` : 'Sem consultas'}
              </p>
              {inquiryCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-[11px] text-muted-foreground">Consultas últimos 4 meses</p>
          </div>
          )}
        </div>

        {inquiryItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma consulta registrada.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              Consultas à Serasa Experian  Exibindo {inquiryItems.length} registros.
              {isPJ && (() => {
                const sourcesCount = Number(pjInquiryQuantity?.sourcesConsulted || pjInquiryQuantity?.fontesConsultadas || 0);
                return sourcesCount > 0 ? <span className="ml-2 font-medium">Fontes Consultadas: {sourcesCount}</span> : null;
              })()}
            </p>
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Data da consulta</TableHead>
                    <TableHead className="text-xs font-medium">{isPJ ? 'Nome do consultante' : 'Segmento do consultante'}</TableHead>
                    {isPJ && <TableHead className="text-xs font-medium">CNPJ do consultante</TableHead>}
                    <TableHead className="text-xs font-medium">Quantidade de consultas no dia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiryItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-2">{formatDate(item.occurrenceDate)}</TableCell>
                      <TableCell className="text-xs py-2">{item.companyName || item.segmentDescription || '-'}</TableCell>
                      {isPJ && <TableCell className="text-xs py-2">{item.companyDocumentId ? formatDocument(item.companyDocumentId) : '-'}</TableCell>}
                      <TableCell className="text-xs py-2">{item.daysQuantity || item.inquiryQuantity || item.quantity || 1}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Informações */}
        <div className="border border-border rounded-lg p-3 mt-3">
          <p className="text-xs font-bold text-foreground mb-1">Informações</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {isPJ
              ? 'Simples consulta ao CNPJ no cadastro da Serasa. Essa informação de consulta não significa negócio realizado, nem se confunde com anotação negativa no cadastro de inadimplentes.'
              : 'Simples consulta ao CPF no cadastro da Serasa. Essa informação de consulta não significa negócio realizado, nem se confunde com anotação negativa no cadastro de inadimplentes. Quando houver consulta do CNPJ consultante, será apresentada a Razão Social.'
            }
          </p>
        </div>
      </div>

      {/* ── Informações Comportamentais (Avançado PJ only) ── */}
      {isAvancadoPJ && (() => {
        const behavioralData = (report?.behavioralData || optionalFeatures?.behavioralData || report?.positiveData || optionalFeatures?.positiveData || {}) as GenericRecord;
        const marketRelationship = (behavioralData?.marketRelationship || report?.marketRelationship || optionalFeatures?.marketRelationship || {}) as GenericRecord;
        const paymentHistoryPJ = (behavioralData?.paymentHistory || report?.paymentHistoryCompany || optionalFeatures?.paymentHistoryCompany || {}) as GenericRecord;
        const commitmentEvolution = (behavioralData?.commitmentEvolution || report?.commitmentEvolution || optionalFeatures?.commitmentEvolution || {}) as GenericRecord;
        const businessReferences = (behavioralData?.businessReferences || report?.businessReferences || optionalFeatures?.businessReferences || {}) as GenericRecord;

        const marketItems = asArray(marketRelationship?.marketRelationshipResponse || marketRelationship?.results || marketRelationship?.items || []);
        const pjPayItems = asArray(paymentHistoryPJ?.paymentHistoryResponse || paymentHistoryPJ?.payments || paymentHistoryPJ?.items || paymentHistoryPJ?.results || []);
        const commitmentItems = asArray(commitmentEvolution?.commitmentEvolutionResponse || commitmentEvolution?.results || commitmentEvolution?.items || []);
        const businessRefItems = asArray(businessReferences?.businessReferencesResponse || businessReferences?.results || businessReferences?.items || []);
        const pjPaySummary = (paymentHistoryPJ?.summary || paymentHistoryPJ) as GenericRecord;

        return (
        <div>
          <p className="text-sm font-semibold text-primary mb-1">Informações Comportamentais</p>
          <p className="text-xs text-muted-foreground mb-4">
            Dados de comportamento de pagamento e relacionamento da empresa com o mercado.
          </p>

          {/* Relacionamento com o Mercado */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Relacionamento com o Mercado</p>
            {marketItems.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Período</TableHead>
                      <TableHead className="text-xs font-medium">Segmento</TableHead>
                      <TableHead className="text-xs font-medium">Valor Total</TableHead>
                      <TableHead className="text-xs font-medium">Qtd. Operações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2">{item.period || item.month || formatDate(item.date) || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.segment || item.type || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.totalAmount ? formatCurrency(item.totalAmount) : item.amount ? formatCurrency(item.amount) : '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.operationsCount || item.quantity || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sem dados de relacionamento com o mercado.</p>
              </div>
            )}
          </div>

          {/* Histórico de Pagamentos */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Histórico de Pagamentos</p>
            {pjPayItems.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Período</TableHead>
                      <TableHead className="text-xs font-medium">Pontual</TableHead>
                      <TableHead className="text-xs font-medium">1-14 dias</TableHead>
                      <TableHead className="text-xs font-medium">15-30 dias</TableHead>
                      <TableHead className="text-xs font-medium">31-60 dias</TableHead>
                      <TableHead className="text-xs font-medium">61-90 dias</TableHead>
                      <TableHead className="text-xs font-medium">{'>'}90 dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pjPayItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2">{item.period || item.month || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.onTime || item.punctual || item.onTimePayment || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.delay1to14 || item.late1to14 || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.delay15to30 || item.late15to30 || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.delay31to60 || item.late31to60 || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.delay61to90 || item.late61to90 || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.delayOver90 || item.lateOver90 || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : pjPaySummary?.onTimePayment ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Pontual</p>
                  <p className="text-sm font-bold text-foreground mt-1">{pjPaySummary.onTimePayment}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Com atraso</p>
                  <p className="text-sm font-bold text-foreground mt-1">{pjPaySummary.latePayment || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sem dados de histórico de pagamentos.</p>
              </div>
            )}
          </div>

          {/* Evolução de Compromissos */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Evolução de Compromissos</p>
            {commitmentItems.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Período</TableHead>
                      <TableHead className="text-xs font-medium">Valor Assumido</TableHead>
                      <TableHead className="text-xs font-medium">Valor Liquidado</TableHead>
                      <TableHead className="text-xs font-medium">Valor a Vencer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commitmentItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2">{item.period || item.month || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.assumedAmount ? formatCurrency(item.assumedAmount) : item.totalAmount ? formatCurrency(item.totalAmount) : '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.settledAmount ? formatCurrency(item.settledAmount) : item.paidAmount ? formatCurrency(item.paidAmount) : '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.toExpireAmount ? formatCurrency(item.toExpireAmount) : item.pendingAmount ? formatCurrency(item.pendingAmount) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sem dados de evolução de compromissos.</p>
              </div>
            )}
          </div>

          {/* Referenciais de Negócio */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Referenciais de Negócio</p>
            {businessRefItems.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Segmento</TableHead>
                      <TableHead className="text-xs font-medium">Data Início</TableHead>
                      <TableHead className="text-xs font-medium">Última Compra</TableHead>
                      <TableHead className="text-xs font-medium">Maior Compra</TableHead>
                      <TableHead className="text-xs font-medium">Maior Atraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessRefItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2">{item.segment || item.type || '-'}</TableCell>
                        <TableCell className="text-xs py-2">{formatDate(item.startDate || item.firstPurchase)}</TableCell>
                        <TableCell className="text-xs py-2">{formatDate(item.lastPurchase || item.lastDate)}</TableCell>
                        <TableCell className="text-xs py-2">{item.highestPurchase ? formatCurrency(item.highestPurchase) : '-'}</TableCell>
                        <TableCell className="text-xs py-2">{item.longestDelay || item.maxDelay || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sem dados de referenciais de negócio.</p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            As informações comportamentais refletem o histórico de relacionamento comercial e financeiro da empresa. Dados sujeitos à atualização conforme fontes disponíveis.
          </p>
        </div>
        );
      })()}

      {/* ── Limite de Crédito PJ (Avançado PJ only) ── */}
      {isAvancadoPJ && (() => {
        // Try dedicated creditLimit fields first, then fall back to HLC1 score model
        const creditLimitDedicated = (pick(optionalFeatures, ['creditLimit', 'creditLimitResponse', 'limitCredit']) 
          || pick(report, ['creditLimit', 'creditLimitResponse', 'limitCredit'])
          || pick(report?.behavioralData || optionalFeatures?.behavioralData || report?.positiveData, ['creditLimit'])) as any;
        const limitValue = creditLimitDedicated?.value || creditLimitDedicated?.amount || creditLimitDedicated?.limitValue || creditLimitDedicated?.creditLimitValue
          || (creditLimitScore?.score ? Number(creditLimitScore.score) : undefined);
        const limitMessage = creditLimitDedicated?.message || creditLimitDedicated?.interpretation || creditLimitScore?.message || '';
        
        return (
        <div>
          <p className="text-sm font-semibold text-primary mb-1">Limite de Crédito PJ</p>
          <p className="text-xs text-muted-foreground mb-3">
            Apresenta a sugestão de limite de crédito para a empresa consultada, ajustado a seu grau de risco, facilitando o processo de decisão na venda financiada ou concessão de crédito.
          </p>
          <hr className="border-border mb-4" />

          <div className="border border-border rounded-lg p-4 mb-3">
            <p className="text-xs font-medium text-muted-foreground">Limite de Crédito PJ</p>
            <p className="text-lg font-bold text-foreground mt-1">{limitValue ? formatCurrency(limitValue) : 'Sem dados'}</p>
          </div>

          <div className="border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground mb-1">Interpretação</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {limitMessage || 'O Limite de Crédito trata-se de modelo estatístico, calculado com dados positivos, financeiros e comportamentais, além de considerar em sua composição referenciais de negócios, como o Faturamento Estimado e a probabilidade de inadimplência. Combine a solução com outras informações relevantes em sua política para tomada de decisão.'}
            </p>
          </div>
        </div>
        );
      })()}

      {/* ── Cheques Sustados (Avançado PJ only) ── */}
      {isAvancadoPJ && (() => {
        const checkFilingsPJ = (report?.checkFilingsHistorical || optionalFeatures?.checkFilingsHistorical || report?.checkFilings || optionalFeatures?.checkFilings || {}) as GenericRecord;
        const checkFilingsPJItems = asArray(checkFilingsPJ?.checkFilingsHistoricalResponse || checkFilingsPJ?.results || checkFilingsPJ?.items || []);
        return (
        <div>
          <p className="text-sm font-semibold text-primary mb-1">Cheques Sustados</p>
          <p className="text-xs text-muted-foreground mb-3">
            Indica sobre a recorrência de sustação de cheques vinculado ao documento consultado.
          </p>
          <hr className="border-border mb-4" />

          <p className="text-xs font-medium text-foreground mb-2">Histórico de ocorrências com cheques</p>
          {checkFilingsPJItems.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Data</TableHead>
                    <TableHead className="text-xs font-medium">Banco</TableHead>
                    <TableHead className="text-xs font-medium">Agência</TableHead>
                    <TableHead className="text-xs font-medium">Motivo</TableHead>
                    <TableHead className="text-xs font-medium">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkFilingsPJItems.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-2">{formatDate(item.occurrenceDate || item.date)}</TableCell>
                      <TableCell className="text-xs py-2">{item.bankName || item.bank || '-'}</TableCell>
                      <TableCell className="text-xs py-2">{item.bankAgencyId || item.agency || '-'}</TableCell>
                      <TableCell className="text-xs py-2">{item.reason || item.motive || '-'}</TableCell>
                      <TableCell className="text-xs py-2">{item.quantity || item.count || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum registro para este documento.</p>
          )}
        </div>
        );
      })()}

      {/* ── Histórico de Pagamento (PF Top Score only) ── */}
      {isTopScore && (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Histórico de pagamento</p>
        <p className="text-xs text-muted-foreground mb-3">
          Pontualidade de pagamento por período do documento consultado.
        </p>

        {paymentItems.length === 0 && !paymentSummary?.onTimePayment ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">Pontual até o vencimento</p>
              <p className="text-sm font-bold text-foreground mt-1">{String(pick(paymentSummary, ['onTimeRate', 'punctualRate', 'onTimePayment']) || '-')}</p>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-[11px] font-medium text-muted-foreground">1 a 7 dias de atraso</p>
              <p className="text-sm font-bold text-foreground mt-1">{String(pick(paymentSummary, ['lateRate', 'delayRate', 'latePayment']) || '-')}</p>
            </div>
          </div>
        ) : paymentItems.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Período</TableHead>
                  <TableHead className="text-xs font-medium">Pontual</TableHead>
                  <TableHead className="text-xs font-medium">Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentItems.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{item.period || item.month || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.onTimeRate || item.punctualRate || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{item.lateRate || item.delayRate || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum registro para este documento.</p>
        )}

        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
          Esse relatório contém informações históricas reais ocorridas nos últimos 12 meses e tem como objetivo demonstrar o comportamento de pagamento do consumidor nesse período.
        </p>
      </div>
      )}

      {/* ── Disclaimer ── */}
      <div className="border-t border-border pt-4 mt-6">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Este relatório é estritamente confidencial e destinado a apoiar decisões de crédito e negócios. É proibida a reprodução, total ou parcial, bem como sua divulgação a terceiros, por qualquer forma. A decisão de conceder ou não crédito é de inteira responsabilidade da empresa concedente. Serasa Experian. Todos os direitos reservados.
        </p>
      </div>
      </div>
    </div>
  );
}

/* ═══════════════════ HELPER COMPONENTS ═══════════════════ */

function NegSummaryBox({ label, value, count }: { label: string; value: unknown; count: unknown }) {
  const c = Number(count ?? 0);
  const v = Number(value ?? 0);
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-bold mt-1 ${c > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
        {c > 0 ? formatCurrency(v) : 'Sem registros'}
      </p>
      {c > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">{c} registros</p>}
    </div>
  );
}

function NegDetailTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: Array<{ header: string; render: (item: any) => ReactNode }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground mb-2">
        {title}  Exibindo {rows.length} registros.
      </p>
      <div className="overflow-x-auto border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.header} className="text-xs font-medium">{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.header} className="text-xs py-2">{col.render(item)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Pure-div bar chart for PF inquiry history – no canvas, PDF-safe */
function InquiryBarChart({ inquiryItems }: { inquiryItems: any[] }) {
  const now = new Date();
  const months: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const count = inquiryItems.reduce((sum, item) => {
      const itemDate = new Date(String(item.occurrenceDate || ''));
      if (!Number.isNaN(itemDate.getTime())) {
        const itemKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
        if (itemKey === key) return sum + Number(item.inquiryQuantity || item.quantity || 1);
      }
      return sum;
    }, 0);
    months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), count });
  }

  const maxCount = Math.max(...months.map(m => m.count), 1);
  const barMaxHeight = 120;

  return (
    <div className="border border-border rounded-lg p-4 mb-3">
      <div className="flex items-end justify-between gap-2" style={{ height: barMaxHeight + 30 }}>
        {months.map((m, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            {m.count > 0 && (
              <span className="text-[10px] font-medium text-foreground">{m.count}</span>
            )}
            <div
              className="w-full rounded-t-sm bg-primary transition-all"
              style={{ height: m.count > 0 ? Math.max((m.count / maxCount) * barMaxHeight, 4) : 0 }}
            />
            <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pure-div bar chart for PJ inquiry history using historical data */
function InquiryBarChartPJ({ historical }: { historical: any[] }) {
  // PJ historical: array of { inquiryDate: "YYYY-MM", occurrences, bankOccurrences }
  // Use all items from the API (up to 13 months) instead of generating fixed months
  const months: { label: string; companies: number; banks: number }[] = [];

  if (historical.length > 0) {
    // Sort by date ascending
    const sorted = [...historical].sort((a, b) => String(a.inquiryDate || '').localeCompare(String(b.inquiryDate || '')));
    for (const h of sorted) {
      const hDate = String(h.inquiryDate || '');
      const [year, month] = hDate.split('-').map(Number);
      if (year && month) {
        const d = new Date(year, month - 1, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
        months.push({
          label: label.charAt(0).toUpperCase() + label.slice(1),
          companies: Number(h.occurrences || 0),
          banks: Number(h.bankOccurrences || 0),
        });
      }
    }
  }

  if (months.length === 0) {
    // Fallback: generate 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), companies: 0, banks: 0 });
    }
  }

  const maxCount = Math.max(...months.map(m => m.companies + m.banks), 1);
  const barMaxHeight = 120;

  return (
    <div className="border border-border rounded-lg p-4 mb-3">
      <div className="flex items-end justify-between gap-1" style={{ height: barMaxHeight + 30 }}>
        {months.map((m, i) => {
          const total = m.companies + m.banks;
          const companyH = total > 0 ? Math.max((m.companies / maxCount) * barMaxHeight, m.companies > 0 ? 4 : 0) : 0;
          const bankH = total > 0 ? Math.max((m.banks / maxCount) * barMaxHeight, m.banks > 0 ? 4 : 0) : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {total > 0 && (
                <span className="text-[10px] font-medium text-foreground">{total}</span>
              )}
              <div className="w-full flex flex-col">
                <div className="w-full rounded-t-sm bg-primary" style={{ height: companyH }} />
                <div className="w-full bg-amber-500" style={{ height: bankH }} />
              </div>
              <span className="text-[9px] text-muted-foreground text-center leading-tight mt-1">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
