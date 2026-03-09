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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SerasaPdfExport contentRef={contentRef} document={docForExport} />
      </div>
      <div ref={contentRef} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSearch className="h-4 w-4 text-primary" />
            Informacoes fixadas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DataRow label="Nome" value={pick(registration, ['consumerName', 'name'])} />
          <DataRow label="CPF" value={formatDocument(pick(registration, ['documentNumber', 'document']))} />
          <DataRow label="Situacao na Receita Federal" value={pick(registration, ['statusRegistration', 'documentStatus'])} />
          <DataRow label="Atualizado em" value={formatDate(pick(registration, ['statusDate', 'updateDate']))} />
          <DataRow label="Data de nascimento" value={formatDate(pick(registration, ['birthDate']))} />
          <DataRow label="Idade" value={pick(registration, ['age'])} />
          <DataRow label="Municipio/UF" value={joinLocation(pick(registration, ['city']), pick(registration, ['federalUnit']))} />
          <DataRow label="Nome da mae" value={pick(registration, ['motherName'])} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          title="Serasa Score"
          value={pick(score, ['score'], '-')}
          subtitle={pick(score, ['message', 'scoreModel'], 'Sem score')}
        />
        <MetricCard
          icon={AlertTriangle}
          title="Total em anotacoes negativas"
          value={formatCurrency(totalNegativeValue)}
          subtitle={formatCount(totalNegativeCount)}
          danger={totalNegativeCount > 0}
        />
        <MetricCard
          icon={Building2}
          title="Participacao societaria"
          value={String(participation.length)}
          subtitle={participation.length > 0 ? 'Com participacoes' : 'Sem participacoes'}
        />
        <MetricCard
          icon={Search}
          title="Consultas neste mes"
          value={String(pick(inquiry, ['inquirySummary.actual'], 0))}
          subtitle={`${pick(inquiry, ['inquirySummary.previous'], 0)} no mes passado`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-primary" />
            Outros dados cadastrais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DataRow label="Sexo" value={pick(registration, ['consumerGender'])} />
          <DataRow label="Faixa do score" value={pick(score, ['range'])} />
          <DataRow label="Probabilidade de pagamento" value={pick(score, ['defaultRate'])} />
          <DataRow label="Documentos roubados" value={stolenItems.length > 0 ? `${stolenItems.length} ocorrencias` : 'Sem ocorrencias'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Anotacoes negativas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryBadge label="Pefin" count={pick(pefin, ['summary.count'], 0)} amount={pick(pefin, ['summary.balance'], 0)} />
            <SummaryBadge label="Refin" count={pick(refin, ['summary.count'], 0)} amount={pick(refin, ['summary.balance'], 0)} />
            <SummaryBadge label="Dividas vencidas" count={pick(convem, ['summary.count'], 0)} amount={pick(convem, ['summary.balance'], 0)} />
            <SummaryBadge label="Protestos" count={pick(protests, ['summary.count'], 0)} amount={pick(protests, ['summary.balance'], 0)} />
            <SummaryBadge label="Cheques sem fundo" count={pick(checks, ['summary.count'], 0)} amount={pick(checks, ['summary.balance'], 0)} />
          </div>

          <NegativeTable
            title="Dividas comerciais - Pefin"
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

          <NegativeTable
            title="Dividas em instituicoes financeiras - Refin"
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

          <NegativeTable
            title="Dividas vencidas - Convem"
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

          <NegativeTable
            title="Dividas protestadas"
            rows={protestItems}
            columns={[
              { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
              { header: 'Valor', render: (item) => formatCurrency(item.amount) },
              { header: 'Cidade', render: (item) => item.city || '-' },
              { header: 'UF', render: (item) => item.federalUnit || '-' },
              { header: 'Cartorio', render: (item) => item.notaryOfficeNumber || item.officeNumber || '-' },
            ]}
          />

          <NegativeTable
            title="Cheques sem fundo Bacen"
            rows={checkItems}
            columns={[
              { header: 'Data', render: (item) => formatDate(item.occurrenceDate) },
              { header: 'Quantidade', render: (item) => item.checkCount || item.quantity || '-' },
              { header: 'Banco', render: (item) => item.bankName || '-' },
              { header: 'Agencia', render: (item) => item.branch || '-' },
              { header: 'Cidade', render: (item) => item.city || '-' },
              { header: 'UF', render: (item) => item.federalUnit || '-' },
            ]}
          />
        </CardContent>
      </Card>

      <SimpleTableSection
        title="Participacoes societarias"
        icon={Building2}
        emptyMessage="Nenhum registro para este documento."
        rows={participation}
        columns={[
          { header: 'Empresa', render: (item) => item.companyName || item.name || '-' },
          { header: 'Documento', render: (item) => formatDocument(item.documentNumber || item.document) },
          { header: 'Participacao', render: (item) => item.percentage || item.participationPercentage || '-' },
          { header: 'Situacao', render: (item) => item.status || '-' },
        ]}
      />

      <SimpleTableSection
        title="Documentos roubados"
        icon={ShieldAlert}
        emptyMessage="Nenhum registro para este documento."
        rows={stolenItems}
        columns={[
          { header: 'Documento', render: (item) => item.documentType || item.type || '-' },
          { header: 'Data', render: (item) => formatDate(item.occurrenceDate || item.date) },
          { header: 'Origem', render: (item) => item.source || item.institution || '-' },
          { header: 'UF', render: (item) => item.federalUnit || '-' },
        ]}
      />

      <SimpleTableSection
        title="Consultas a Serasa Experian"
        icon={Search}
        emptyMessage="Nenhuma consulta registrada."
        rows={inquiryItems}
        columns={[
          { header: 'Data da consulta', render: (item) => formatDate(item.occurrenceDate) },
          { header: 'Quantidade no dia', render: (item) => item.inquiryQuantity || item.quantity || 1 },
          { header: 'Segmento do consultante', render: (item) => item.segmentDescription || '-' },
        ]}
        headerAside={
          <div className="flex gap-2">
            <Badge variant="secondary">Mes atual: {pick(inquiry, ['inquirySummary.actual'], 0)}</Badge>
            <Badge variant="outline">Mes passado: {pick(inquiry, ['inquirySummary.previous'], 0)}</Badge>
          </div>
        }
      />
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
      <p className="mt-1 text-sm font-medium text-foreground">{value || '-'}</p>
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
