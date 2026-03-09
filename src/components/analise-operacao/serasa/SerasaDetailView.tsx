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
  if (value === false) return 'Nao';
  return String(value ?? '-');
}

export function SerasaDetailView({ data, document: docNumber }: SerasaDetailViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const report = ((data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data) as GenericRecord;
  const registration = (report?.registration || {}) as GenericRecord;
  const negativeData = (report?.negativeData || {}) as GenericRecord;
  const inquiry = (report?.inquiry || {}) as GenericRecord;
  const stolenDocuments = (report?.stolenDocuments || {}) as GenericRecord;
  const optionalFeatures = (report?.optionalFeatures || {}) as GenericRecord;
  const score = (optionalFeatures?.scoreResponse || optionalFeatures?.score || {}) as GenericRecord;
  const pefin = (negativeData?.pefinResponse || negativeData?.pefin || {}) as GenericRecord;
  const refin = (negativeData?.refinResponse || negativeData?.refin || {}) as GenericRecord;
  const convem = (negativeData?.collectionRecordsResponse || negativeData?.collectionRecords || {}) as GenericRecord;
  const checks = (negativeData?.checkResponse || negativeData?.check || {}) as GenericRecord;
  const protests = (negativeData?.notaryResponse || negativeData?.notary || {}) as GenericRecord;

  const facts = (report?.facts || {}) as GenericRecord;
  const factsInquiry = (facts?.inquiry || inquiry) as GenericRecord;
  const factsInquirySummary = (facts?.inquirySummary || {}) as GenericRecord;
  const factsStolenDocs = (facts?.stolenDocuments || stolenDocuments) as GenericRecord;

  const participation = asArray(
    pick(report, [
      'companyData.companyParticipationResponse',
      'companyParticipationResponse',
      'partnerParticipation.participationResponse',
      'partnerParticipationResponse',
      'socialParticipation.socialParticipationResponse',
    ], []),
  );

  const pefinItems = asArray(pick(pefin, ['pefinResponse', 'ppiResponse'], []));
  const refinItems = asArray(pick(refin, ['refinResponse', 'rpiResponse'], []));
  const convemItems = asArray(pick(convem, ['collectionRecordsResponse', 'collectionRecordsResponseDetail'], []));
  const checkItems = asArray(pick(checks, ['checkResponse', 'checkResponseDetail'], []));
  const protestItems = asArray(pick(protests, ['notaryResponse', 'notaryResponseDetail'], []));
  const stolenItems = asArray(pick(factsStolenDocs, ['stolenDocumentsResponse', 'documents'], []));
  const inquiryItems = asArray(pick(factsInquiry, ['inquiryResponse'], []));

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

  const docForExport = docNumber || String(pick(registration, ['documentNumber', 'document']) || 'sem-doc');

  const scoreValue = Number(pick(score, ['score'], 0));
  const defaultRate = pick<string>(score, ['defaultRate', 'message'], '');
  const consultasAtual = Number(pick(factsInquirySummary, ['inquiryQuantity.actual'], 0));
  const consultasAnterior = Number(pick(factsInquirySummary, ['inquiryQuantity.creditInquiriesQuantity.0.occurrences'], 0));
  const inquiryCount = Number(pick(factsInquiry, ['summary.count'], 0));
  const statusRF = String(pick(registration, ['statusRegistration', 'documentStatus']) || '-');
  const statusDate = formatDate(pick(registration, ['statusDate', 'updateDate']));
  const consumerName = String(pick(registration, ['consumerName', 'name']) || '-');
  const docFormatted = formatDocument(pick(registration, ['documentNumber', 'document']));
  const birthDateRaw = pick<string>(registration, ['birthDate'], '');
  const birthAge = calcAge(birthDateRaw);
  const reportName = String(pick(report, ['reportName']) || 'RELATÓRIO BÁSICO').replace(/_/g, ' ');

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex justify-start">
        <SerasaPdfExport contentRef={contentRef} document={docForExport} />
      </div>
      <div ref={contentRef} className="space-y-6 overflow-x-auto">

      {/* ── Header Strip ── */}
      <div className="border border-border rounded-lg bg-muted/30 px-5 py-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
        <p className="text-sm font-bold text-foreground">{reportName}</p>
        <p className="text-sm text-muted-foreground">CPF: {docFormatted} | {consumerName}</p>
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
          {/* Participação societária */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Participação societária</p>
            <p className="text-sm font-bold text-foreground mt-1">{participation.length}</p>
          </div>
          {/* Consultas mês */}
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              {consultasAtual > 0 ? `${consultasAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Consultas neste mês</p>
          </div>
        </div>
        {/* Consultas mês passado */}
        <div className="mt-3 inline-block border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium text-foreground">
              {inquiryCount > 0 ? `${inquiryCount} consultas` : 'Sem consultas'}
            </p>
            {inquiryCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Consultas no mês passado</p>
        </div>
      </div>

      {/* ── Identificação Cadastral ── */}
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
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2">Outros Dados Cadastrais</p>
        <div className="border border-border rounded-lg p-3">
          <p className="text-sm text-foreground">
            <span className="font-bold">Nome da Mãe:</span>{' '}
            {String(pick(registration, ['motherName']) || '-')}
          </p>
        </div>
      </div>

      {/* ── Serasa Score ── */}
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

      {/* ── Anotações Negativas ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Anotações Negativas</p>
        <p className="text-xs text-muted-foreground mb-4">
          Detalhamento sobre as anotações negativas do indivíduo de acordo com diversas fontes.
        </p>

        {/* Resumo */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-primary mb-1">Resumo</p>
          <p className="text-xs text-foreground mb-3">
            Total de dívidas: <span className="font-bold">{formatCurrency(totalNegativeValue)}</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <NegSummaryBox
              label="Total em anotações negativas"
              value={totalNegativeValue}
              count={totalNegativeCount}
            />
            <NegSummaryBox
              label="Dívidas comerciais - Pefin"
              value={pick(pefin, ['summary.balance'], 0)}
              count={pick(pefin, ['summary.count'], 0)}
            />
            <NegSummaryBox
              label="Dívidas em Instituições Financeiras - Refin"
              value={pick(refin, ['summary.balance'], 0)}
              count={pick(refin, ['summary.count'], 0)}
            />
            <NegSummaryBox
              label="Dívidas vencidas - Convem"
              value={pick(convem, ['summary.balance'], 0)}
              count={pick(convem, ['summary.count'], 0)}
            />
            <NegSummaryBox
              label="Dívidas Protestadas"
              value={pick(protests, ['summary.balance'], 0)}
              count={pick(protests, ['summary.count'], 0)}
            />
            <NegSummaryBox
              label="Cheques sem fundo BACEN"
              value={pick(checks, ['summary.balance'], 0)}
              count={pick(checks, ['summary.count'], 0)}
            />
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
            { header: 'Avalista', render: (item) => yesNo(item.guaranteeFlag) },
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
            { header: 'Avalista', render: (item) => yesNo(item.guaranteeFlag) },
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
            { header: 'Avalista', render: (item) => yesNo(item.guaranteeFlag) },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />

        <NegDetailTable
          title="Dívidas Protestadas  (Registradas em cartório)"
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
            { header: 'Agência', render: (item) => item.branch || '-' },
            { header: 'Cidade', render: (item) => item.city || '-' },
            { header: 'UF', render: (item) => item.federalUnit || '-' },
          ]}
        />
      </div>

      {/* ── Participações Societárias ── */}
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
          <div className="overflow-hidden border border-border rounded-lg">
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

      {/* ── Documentos Roubados ── */}
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
          <div className="overflow-hidden border border-border rounded-lg">
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

      {/* ── Consultas à Serasa Experian ── */}
      <div>
        <p className="text-sm font-semibold text-primary mb-1">Consultas à Serasa Experian</p>
        <p className="text-xs text-muted-foreground mb-3">
          Detalhamento do mês atual e do mês anterior de consultas deste documento.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="border border-border rounded-lg p-3">
            <p className="text-[11px] font-bold text-foreground">
              {consultasAtual > 0 ? `${consultasAtual} consultas` : 'Sem consultas'}
            </p>
            <p className="text-[11px] text-muted-foreground">Consultas neste mês</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-foreground">
                {inquiryCount > 0 ? `${inquiryCount} consultas` : 'Sem consultas'}
              </p>
              {inquiryCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-[11px] text-muted-foreground">Consultas no mês passado</p>
          </div>
        </div>

        {inquiryItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma consulta registrada.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              Consultas à Serasa Experian  Exibindo {inquiryItems.length} registros.
            </p>
            <div className="overflow-hidden border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Data da consulta</TableHead>
                    <TableHead className="text-xs font-medium">Quantidade de consultas no dia</TableHead>
                    <TableHead className="text-xs font-medium">Segmento do consultante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiryItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-2">{formatDate(item.occurrenceDate)}</TableCell>
                      <TableCell className="text-xs py-2">{item.inquiryQuantity || item.quantity || 1}</TableCell>
                      <TableCell className="text-xs py-2">{item.segmentDescription || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

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

function joinLocation(city: unknown, uf: unknown): string {
  if (!city && !uf) return 'Sem dados';
  if (city && uf) return `${city}/${uf}`;
  return String(city || uf);
}

function DataRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{String(value || '-')}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? 'border-destructive/30' : ''}>
      <CardContent className="flex items-start gap-3 pt-6">
        <div className={`rounded-lg p-2 ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={`mt-1 text-2xl font-semibold ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryBadge({ label, count, amount }: { label: string; count: unknown; amount: unknown }) {
  const hasValue = Number(count) > 0;
  return (
    <div className={`rounded-lg border p-3 ${hasValue ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${hasValue ? 'text-destructive' : 'text-foreground'}`}>
        {hasValue ? formatCurrency(amount) : 'Sem registros'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{formatCount(count)}</p>
    </div>
  );
}

function NegativeTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: Array<{ header: string; render: (item: any) => ReactNode }>;
}) {
  return (
    <SimpleTableSection
      title={title}
      icon={AlertTriangle}
      emptyMessage="Sem registros"
      rows={rows}
      columns={columns}
    />
  );
}

function SimpleTableSection({
  title,
  icon: Icon,
  rows,
  columns,
  emptyMessage,
  headerAside,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  rows: any[];
  columns: Array<{ header: string; render: (item: any) => ReactNode }>;
  emptyMessage: string;
  headerAside?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          {headerAside}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.header}>{column.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item, index) => (
                  <TableRow key={index}>
                    {columns.map((column) => (
                      <TableCell key={column.header} className="align-top text-xs">
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
      <div className="overflow-hidden border border-border rounded-lg">
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
