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
  const d = new Date(String(birthDate));
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
  const hasScore = isTopScore || isPJ; // Both PJ PME reports include score
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

  // Score - PJ uses H4PJ model, PF uses HRLD
  const score = (optionalFeatures?.scoreResponse || optionalFeatures?.score || {}) as GenericRecord;
  const pefin = (negativeData?.pefinResponse || negativeData?.pefin || {}) as GenericRecord;
  const refin = (negativeData?.refinResponse || negativeData?.refin || {}) as GenericRecord;
  const convem = (negativeData?.collectionRecordsResponse || negativeData?.collectionRecords || {}) as GenericRecord;
  const checks = (negativeData?.checkResponse || negativeData?.check || {}) as GenericRecord;
  const protests = (negativeData?.notaryResponse || negativeData?.notary || {}) as GenericRecord;
  const judgements = (negativeData?.judgementFilingsResponse || negativeData?.judgementFilings || {}) as GenericRecord;
  const bankrupts = (negativeData?.bankruptsResponse || negativeData?.bankrupts || {}) as GenericRecord;

  // PJ specific - company data / QSA
  const identificationReport = (report?.identificationReport || {}) as GenericRecord;
  const companyData = (report?.companyData || optionalFeatures?.companyData || {}) as GenericRecord;
  const partnersList = asArray(companyData?.partnersList || companyData?.partners || []);
  const directorsList = asArray(companyData?.directorsList || companyData?.directors || []);

  // QSA from basic report structure (PartnerResponse / DirectorResponse)
  const qsaPartners = asArray(report?.qsa?.partnerResponse || report?.qsa?.partners || optionalFeatures?.qsa?.partnerResponse || []);
  const qsaDirectors = asArray(report?.qsa?.directorResponse || report?.qsa?.directors || optionalFeatures?.qsa?.directorResponse || []);
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
  const defaultRate = pick<string>(score, ['defaultRate', 'message'], '');
  const scoreModel = pick<string>(score, ['scoreModel'], '');

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
  const socialCapital = pick(companyData, ['socialCapitalValue', 'capitalValue']);
  const companyAddress = pick(registration, ['address']) || pick(identificationReport, ['address']) || {} as GenericRecord;

  const statusRF = String(pick(registration, ['statusRegistration', 'documentStatus']) || pick(identificationReport, ['statusRegistration']) || '-');
  const statusDate = formatDate(pick(registration, ['statusDate', 'updateDate']) || pick(identificationReport, ['updateDate']));

  const consultasAtual = isPJ
    ? Number(pjInquiryQuantity?.actual || 0)
    : Number(pick(factsInquirySummary, ['inquiryQuantity.actual'], 0));
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
          {/* Situação RF */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Situação na Receita Federal</p>
            <p className="text-sm font-bold text-foreground mt-1">{statusRF}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em {statusDate}</p>
          </div>
          {/* Score */}
          {hasScore && (
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{scoreValue || '-'}</span>
              {defaultRate && (
                <Badge variant="outline" className="border-green-500 text-green-600 text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                  {defaultRate}
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
          )}
          {/* Total negativas */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Total em anotações negativas</p>
            <p className={`text-sm font-bold mt-1 ${totalNegativeCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {totalNegativeValue > 0 ? formatCurrency(totalNegativeValue) : 'Sem registros'}
            </p>
            {totalNegativeCount > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{totalNegativeCount} registros</p>
            )}
          </div>
          {/* Participação societária (PF) / QSA count (PJ) */}
          {isPF && (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Participação societária</p>
            <p className="text-sm font-bold text-foreground mt-1">{participation.length}</p>
          </div>
          )}
          {isPJ && (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Quadro Societário</p>
            <p className="text-sm font-bold text-foreground mt-1">{allPartners.length + allDirectors.length} membros</p>
          </div>
          )}
          {/* Consultas mês */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              {consultasAtual > 0 ? `${consultasAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Consultas neste mês</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════ PJ-SPECIFIC SECTIONS ═══════════════════ */}
      {isPJ && (
      <>
      {/* ── Dados Cadastrais PJ ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-3">Dados Cadastrais</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Razão Social</p>
            <p className="text-sm font-bold text-foreground mt-1">{companyName}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Nome Fantasia</p>
            <p className="text-sm font-bold text-foreground mt-1">{companyAlias}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">CNPJ</p>
            <p className="text-sm font-bold text-foreground mt-1">{displayDoc}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Data de Fundação</p>
            <p className="text-sm font-bold text-foreground mt-1">{formatDate(foundationDate)}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Situação na Receita Federal</p>
            <p className="text-sm font-bold text-foreground mt-1">{statusRF}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em {statusDate}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Município/UF</p>
            <p className="text-sm font-bold text-foreground mt-1">
              {joinLocation(companyAddress?.city || pick(registration, ['address.city']), companyAddress?.state || companyAddress?.federalUnit || pick(registration, ['address.state']))}
            </p>
          </div>
        </div>

        {/* Additional PJ info for avançado */}
        {isAvancadoPJ && (
        <>
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Informações Adicionais</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Atividade Econômica</p>
            <p className="text-sm font-bold text-foreground mt-1">{economicActivity}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">CNAE</p>
            <p className="text-sm font-bold text-foreground mt-1">{cnae}</p>
          </div>
          {numberEmployees !== undefined && numberEmployees !== null && (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Nº Funcionários</p>
            <p className="text-sm font-bold text-foreground mt-1">{numberEmployees}</p>
          </div>
          )}
          {socialCapital !== undefined && socialCapital !== null && (
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Capital Social</p>
            <p className="text-sm font-bold text-foreground mt-1">{formatCurrency(socialCapital)}</p>
          </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ── Quadro Social e Administrativo ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-3">Quadro Social e Administrativo</p>

        {/* Sócios */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Sócios</p>
        {allPartners.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-4">Nenhum sócio encontrado.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Nome</TableHead>
                  <TableHead className="text-xs font-medium">Documento</TableHead>
                  <TableHead className="text-xs font-medium">Participação</TableHead>
                  <TableHead className="text-xs font-medium">Restritivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPartners.map((p: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{p.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDocument(p.documentId || p.document || '')}</TableCell>
                    <TableCell className="text-xs py-2">
                      {p.participationPercentage != null
                        ? `${p.participationPercentage}%`
                        : p.capitalTotalValue != null
                          ? `${p.capitalTotalValue}%`
                          : '-'}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {p.hasNegative === true || p.restrictionSign === true ? (
                        <Badge variant="destructive" className="text-[10px]">Sim</Badge>
                      ) : p.hasNegative === false || p.restrictionSign === false ? (
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Não</Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Administradores */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Administradores</p>
        {allDirectors.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum administrador encontrado.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">Nome</TableHead>
                  <TableHead className="text-xs font-medium">Documento</TableHead>
                  <TableHead className="text-xs font-medium">Cargo</TableHead>
                  <TableHead className="text-xs font-medium">Restritivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDirectors.map((d: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2">{d.name || '-'}</TableCell>
                    <TableCell className="text-xs py-2">{formatDocument(d.documentId || d.document || '')}</TableCell>
                    <TableCell className="text-xs py-2">{d.role || d.office || '-'}</TableCell>
                    <TableCell className="text-xs py-2">
                      {d.hasNegative === true || d.restrictionSign === true ? (
                        <Badge variant="destructive" className="text-[10px]">Sim</Badge>
                      ) : d.hasNegative === false || d.restrictionSign === false ? (
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Não</Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Score PJ ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Score Positivo</p>
        <p className="text-xs text-muted-foreground mb-3">
          Classificação de risco de crédito da empresa com base em modelos estatísticos. Indica a probabilidade de inadimplência em 6 meses.
        </p>
        <div className="border border-border rounded-lg p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold text-foreground">{scoreValue || '-'}</span>
            {scoreModel && (
              <Badge variant="secondary" className="text-[10px]">
                Modelo: {scoreModel}
              </Badge>
            )}
            {defaultRate && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 text-[11px] px-2 py-0.5">
                {defaultRate}
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

        <div className="border border-border rounded-lg p-3 border-dashed">
          <p className="text-xs font-bold text-foreground mb-1">Atenção</p>
          <p className="text-xs text-muted-foreground">
            A decisão da aprovação ou não do crédito é de exclusiva responsabilidade do concedente. As informações prestadas pela Serasa Experian têm o objetivo de subsidiar essas decisões.
          </p>
        </div>
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

      {/* ── Serasa Score PF (Top Score only) ── */}
      {isTopScore && (
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Serasa Score</p>
        <p className="text-xs text-muted-foreground mb-3">
          Nossa análise de risco de crédito que indica a probabilidade do indivíduo pagar suas contas em dia nos próximos 12 meses
        </p>

        <div className="border border-border rounded-lg p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold text-foreground">{scoreValue || '-'}</span>
            {defaultRate && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 text-[11px] px-2 py-0.5">
                {defaultRate}
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
            {scoreValue > 0
              ? `A chance de um consumidor, com score entre ${Math.floor(scoreValue / 100) * 100 + 1} e ${(Math.floor(scoreValue / 100) + 1) * 100}, pagar seus compromissos financeiros nos próximos 12 meses é de ${defaultRate || '-'}`
              : 'Sem score disponível para interpretação'}
          </p>
        </div>

        <div className="border border-border rounded-lg p-3 border-dashed">
          <p className="text-xs font-bold text-foreground mb-1">Atenção</p>
          <p className="text-xs text-muted-foreground">
            A decisão da aprovação ou não do crédito é de exclusiva responsabilidade do concedente. As informações prestadas pela Serasa Experian têm o objetivo de subsidiar essas decisões e, em nenhuma hipótese alguma, devem ser utilizadas como justificativa pelo concedente do crédito, para tomada da referida decisão.
          </p>
        </div>
      </div>
      )}
      </>
      )}

      {/* ═══════════════════ SHARED SECTIONS ═══════════════════ */}

      {/* ── Anotações Negativas ── */}
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
            </p>
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Data da consulta</TableHead>
                    <TableHead className="text-xs font-medium">Quantidade de consultas no dia</TableHead>
                    <TableHead className="text-xs font-medium">{isPJ ? 'Empresa consultante' : 'Segmento do consultante'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiryItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-2">{formatDate(item.occurrenceDate)}</TableCell>
                      <TableCell className="text-xs py-2">{item.daysQuantity || item.inquiryQuantity || item.quantity || 1}</TableCell>
                      <TableCell className="text-xs py-2">{item.companyName || item.segmentDescription || '-'}</TableCell>
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
  const now = new Date();
  const months: { label: string; companies: number; banks: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const match = historical.find((h: any) => {
      const hDate = String(h.inquiryDate || '');
      return hDate.startsWith(key);
    });

    months.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      companies: Number(match?.occurrences || 0),
      banks: Number(match?.bankOccurrences || 0),
    });
  }

  const maxCount = Math.max(...months.map(m => m.companies + m.banks), 1);
  const barMaxHeight = 120;

  return (
    <div className="border border-border rounded-lg p-4 mb-3">
      <div className="flex items-end justify-between gap-2" style={{ height: barMaxHeight + 30 }}>
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
              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
