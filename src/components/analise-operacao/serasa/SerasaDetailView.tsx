import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, User, FileWarning, Search, ShieldAlert,
  TrendingUp, Calendar, DollarSign, Building2, Hash,
  CheckCircle2, XCircle, Info, CreditCard, Landmark,
  BookOpen, Receipt, Clock
} from 'lucide-react';

interface SerasaDetailViewProps {
  data: Record<string, unknown>;
}

function formatCurrency(value: number | undefined | null): string {
  if (value == null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: string | undefined | null): string {
  if (!date || date === '-') return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function formatCpfCnpj(doc: string | undefined | null): string {
  if (!doc) return '-';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function genderLabel(g: string | undefined | null): string {
  if (!g) return '-';
  if (g === 'M') return 'Masculino';
  if (g === 'F') return 'Feminino';
  return g;
}

export function SerasaDetailView({ data }: SerasaDetailViewProps) {
  const report = (data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data;
  const registration = report?.registration || {};
  const negativeData = report?.negativeData || {};
  const negativeSummary = report?.negativeSummary || {};
  const facts = report?.facts || {};
  const optionalFeatures = report?.optionalFeatures || {};
  const reportName = report?.reportName || '';

  // Facts
  const inquiry = facts?.inquiry || {};
  const inquirySummary = facts?.inquirySummary || {};
  const stolenDocuments = facts?.stolenDocuments || {};

  // Negative data
  const pefin = negativeData?.pefin || {};
  const refin = negativeData?.refin || {};
  const collectionRecords = negativeData?.collectionRecords || {};
  const checks = negativeData?.check || {};
  const notary = negativeData?.notary || {};

  // Score
  const scoreData = optionalFeatures?.scoreResponse || optionalFeatures?.score || null;

  // Totals
  const totalBalance =
    (pefin?.summary?.balance || 0) +
    (refin?.summary?.balance || 0) +
    (collectionRecords?.summary?.balance || 0) +
    (checks?.summary?.balance || 0) +
    (notary?.summary?.balance || 0);

  const totalCount =
    (pefin?.summary?.count || 0) +
    (refin?.summary?.count || 0) +
    (collectionRecords?.summary?.count || 0) +
    (checks?.summary?.count || 0) +
    (notary?.summary?.count || 0);

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="outline" className="text-xs font-mono">
          {reportName || 'Relatório Serasa'}
        </Badge>
        {totalCount > 0 ? (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {totalCount} ocorrência{totalCount > 1 ? 's' : ''} • {formatCurrency(totalBalance)}
          </Badge>
        ) : (
          <Badge variant="default" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sem restrições
          </Badge>
        )}
      </div>

      {/* ═══════════════════ DADOS CADASTRAIS ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Dados Cadastrais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <DataRow label="Nome" value={registration.consumerName} bold />
            <DataRow label="Documento" value={formatCpfCnpj(registration.documentNumber)} mono />
            <DataRow label="Data Nascimento" value={formatDate(registration.birthDate)} icon={<Calendar className="h-3 w-3" />} />
            <DataRow label="Sexo" value={genderLabel(registration.consumerGender)} />
            <DataRow label="Nome da Mãe" value={registration.motherName} />
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Situação:</span>
              <div className="flex items-center gap-2">
                <Badge variant={registration.statusRegistration === 'REGULAR' ? 'default' : 'destructive'} className="text-xs">
                  {registration.statusRegistration === 'REGULAR'
                    ? <CheckCircle2 className="h-3 w-3 mr-1" />
                    : <XCircle className="h-3 w-3 mr-1" />}
                  {registration.statusRegistration || '-'}
                </Badge>
                {registration.statusDate && (
                  <span className="text-xs text-muted-foreground">desde {formatDate(registration.statusDate)}</span>
                )}
              </div>
            </div>
          </div>
          {negativeSummary?.message && negativeSummary.message.trim() && (
            <div className="mt-3 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {negativeSummary.message.trim()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ SCORE ═══════════════════ */}
      {scoreData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Score de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">{scoreData.score ?? '-'}</div>
                {scoreData.range && <p className="text-xs text-muted-foreground mt-1">{scoreData.range}</p>}
              </div>
              <Separator orientation="vertical" className="h-16" />
              <div className="space-y-1.5 flex-1">
                <DataRow label="Modelo" value={scoreData.scoreModel} />
                <DataRow label="Prob. Inadimplência" value={scoreData.defaultRate ? `${scoreData.defaultRate}%` : undefined} />
                <DataRow label="Mensagem" value={scoreData.message} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ RESUMO NEGATIVO ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Resumo de Anotações Negativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <NegativeSummaryCard
              label="PEFIN"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              summary={pefin?.summary}
            />
            <NegativeSummaryCard
              label="REFIN"
              icon={<Landmark className="h-3.5 w-3.5" />}
              summary={refin?.summary}
            />
            <NegativeSummaryCard
              label="Dívidas Vencidas"
              icon={<Receipt className="h-3.5 w-3.5" />}
              summary={collectionRecords?.summary}
            />
            <NegativeSummaryCard
              label="Cheques"
              icon={<CreditCard className="h-3.5 w-3.5" />}
              summary={checks?.summary}
              extraFields={checks?.summary?.checkCount != null ? [
                { label: 'Cheques devolvidos', value: checks.summary.checkCount }
              ] : undefined}
            />
            <NegativeSummaryCard
              label="Protestos"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              summary={notary?.summary}
            />
          </div>
          {totalCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Geral</span>
              <div className="text-right">
                <span className="text-sm font-bold text-destructive">{formatCurrency(totalBalance)}</span>
                <span className="text-xs text-muted-foreground ml-2">({totalCount} registros)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ DETALHES PEFIN ═══════════════════ */}
      <NegativeDetailSection
        title="Pendências Financeiras (PEFIN)"
        icon={<DollarSign className="h-4 w-4 text-destructive" />}
        items={pefin?.pefinResponse || []}
        summary={pefin?.summary}
      />

      {/* ═══════════════════ DETALHES REFIN ═══════════════════ */}
      <NegativeDetailSection
        title="Restrições Financeiras (REFIN)"
        icon={<Landmark className="h-4 w-4 text-destructive" />}
        items={refin?.refinResponse || []}
        summary={refin?.summary}
      />

      {/* ═══════════════════ DETALHES DÍVIDAS ═══════════════════ */}
      <NegativeDetailSection
        title="Dívidas Vencidas (Cobranças)"
        icon={<Receipt className="h-4 w-4 text-destructive" />}
        items={collectionRecords?.collectionRecordsResponse || []}
        summary={collectionRecords?.summary}
      />

      {/* ═══════════════════ DETALHES CHEQUES ═══════════════════ */}
      <NegativeDetailSection
        title="Cheques sem Fundo"
        icon={<CreditCard className="h-4 w-4 text-destructive" />}
        items={checks?.checkResponse || []}
        summary={checks?.summary}
      />

      {/* ═══════════════════ DETALHES PROTESTOS ═══════════════════ */}
      <NegativeDetailSection
        title="Protestos"
        icon={<BookOpen className="h-4 w-4 text-destructive" />}
        items={notary?.notaryResponse || []}
        summary={notary?.summary}
      />

      {/* ═══════════════════ DOCUMENTOS ROUBADOS ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Documentos Roubados / Extraviados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Total registrado:</span>
            <Badge variant={stolenDocuments?.summary?.count > 0 ? 'destructive' : 'outline'}>
              {stolenDocuments?.summary?.count ?? 0}
            </Badge>
          </div>
          {Array.isArray(stolenDocuments?.stolenDocumentsResponse) && stolenDocuments.stolenDocumentsResponse.length > 0 ? (
            <div className="space-y-2">
              {stolenDocuments.stolenDocumentsResponse.map((item: any, i: number) => (
                <div key={i} className="text-xs border border-destructive/30 bg-destructive/5 rounded-md p-2 space-y-1">
                  {Object.entries(item).map(([key, val]) => (
                    <DataRow key={key} label={formatFieldLabel(key)} value={isDateField(key) ? formatDate(String(val)) : val} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Nenhum documento roubado ou extraviado
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ CONSULTAS ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Consultas Realizadas à Serasa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary from facts.inquiry.summary */}
          {inquiry?.summary && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Total de consultas:</span>
              <Badge variant="outline" className="text-xs">{inquiry.summary.count ?? 0}</Badge>
            </div>
          )}

          {/* Inquiry quantity from facts.inquirySummary */}
          {inquirySummary?.inquiryQuantity && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Consultas no mês atual:</span>
                <Badge variant="outline" className="text-xs">{inquirySummary.inquiryQuantity.actual ?? 0}</Badge>
              </div>
              {Array.isArray(inquirySummary.inquiryQuantity.creditInquiriesQuantity) &&
                inquirySummary.inquiryQuantity.creditInquiriesQuantity.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Histórico mensal de consultas:
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                    {inquirySummary.inquiryQuantity.creditInquiriesQuantity.map((q: any, i: number) => (
                      <div key={i} className={`text-center p-2 rounded border text-xs ${
                        (q.occurrences ?? 0) > 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                      }`}>
                        <div className="font-bold text-foreground">{q.occurrences ?? 0}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">{q.inquiryDate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Detailed inquiry list from facts.inquiry.inquiryResponse */}
          <p className="text-xs font-medium text-muted-foreground">Detalhamento das consultas:</p>
          {Array.isArray(inquiry?.inquiryResponse) && inquiry.inquiryResponse.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider p-2 bg-muted/50 border-b border-border">
                <span>Segmento</span>
                <span className="text-center">Qtd. Dias</span>
                <span className="text-right">Data Ocorrência</span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {inquiry.inquiryResponse.map((item: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 gap-2 text-xs py-2 px-2 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <span className="font-medium text-foreground">{item.segmentDescription || '-'}</span>
                    <span className="text-center text-muted-foreground">{item.daysQuantity ?? '-'}</span>
                    <span className="text-right text-muted-foreground">{formatDate(item.occurrenceDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma consulta registrada no período</p>
          )}
        </CardContent>
      </Card>

      {/* Raw JSON */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          Ver JSON completo
        </summary>
        <pre className="mt-2 bg-muted p-3 rounded-md overflow-auto max-h-80 text-xs font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/* ═══════════════ Helper Components ═══════════════ */

function DataRow({ label, value, bold, mono, icon }: {
  label: string;
  value: unknown;
  bold?: boolean;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  if (value == null || value === '' || value === '-') return null;
  return (
    <div className="flex items-baseline gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <span className={`text-sm text-foreground ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </span>
    </div>
  );
}

function NegativeSummaryCard({ label, icon, summary, extraFields }: {
  label: string;
  icon: React.ReactNode;
  summary?: any;
  extraFields?: { label: string; value: unknown }[];
}) {
  const count = summary?.count ?? 0;
  const balance = summary?.balance ?? 0;
  const hasIssues = count > 0;

  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      hasIssues ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={hasIssues ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${hasIssues ? 'text-destructive' : 'text-foreground'}`}>
        {count}
      </p>
      {hasIssues && (
        <>
          <p className="text-xs text-destructive font-medium mt-0.5">{formatCurrency(balance)}</p>
          {summary?.firstOccurrence && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {summary.firstOccurrence === summary.lastOccurrence
                ? formatDate(summary.firstOccurrence)
                : `${formatDate(summary.firstOccurrence)} a ${formatDate(summary.lastOccurrence)}`}
            </p>
          )}
        </>
      )}
      {!hasIssues && (
        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
          <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> Nenhuma
        </p>
      )}
      {extraFields?.map((f, i) => (
        <p key={i} className="text-[10px] text-muted-foreground mt-0.5">
          {f.label}: <span className="font-medium text-foreground">{String(f.value)}</span>
        </p>
      ))}
    </div>
  );
}

function NegativeDetailSection({ title, icon, items, summary }: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  summary?: any;
}) {
  const count = summary?.count ?? 0;
  const hasItems = Array.isArray(items) && items.length > 0;

  // Show section if there are items OR if summary shows count > 0
  if (!hasItems && count === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {summary && (
            <Badge variant={count > 0 ? 'destructive' : 'outline'} className="text-xs">
              {count} registro{count !== 1 ? 's' : ''} • {formatCurrency(summary.balance)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Always show summary details */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-muted/30 rounded-lg border border-border">
            <SummaryField label="Quantidade" value={summary.count ?? 0} />
            <SummaryField label="Saldo Total" value={formatCurrency(summary.balance)} highlight={summary.balance > 0} />
            {summary.firstOccurrence && (
              <SummaryField label="Primeira Ocorrência" value={formatDate(summary.firstOccurrence)} />
            )}
            {summary.lastOccurrence && (
              <SummaryField label="Última Ocorrência" value={formatDate(summary.lastOccurrence)} />
            )}
            {summary.checkCount != null && (
              <SummaryField label="Cheques Devolvidos" value={summary.checkCount} />
            )}
          </div>
        )}

        {/* Detail items */}
        {hasItems ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((item: any, i: number) => (
              <div key={i} className="text-xs border border-border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground">
                      {item.creditorName || item.bankName || item.notaryName || '-'}
                    </span>
                  </div>
                  {item.amount != null && (
                    <span className="text-destructive font-bold whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  {item.occurrenceDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Ocorrência: {formatDate(item.occurrenceDate)}
                    </span>
                  )}
                  {item.inclusionDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Inclusão: {formatDate(item.inclusionDate)}
                    </span>
                  )}
                  {item.legalNature && <span>Natureza: {item.legalNature}</span>}
                  {item.contractId && (
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Contrato: {item.contractId}
                    </span>
                  )}
                  {item.cadus && <span>CADUS: {item.cadus}</span>}
                  {item.city && <span>{item.city}{item.federalUnit ? ` - ${item.federalUnit}` : ''}</span>}
                  {item.principal != null && <span>Principal: {item.principal ? 'Sim' : 'Não'}</span>}
                  {item.dispute && (
                    <span>Disputa: {item.dispute.disputeIndicativeFlag ? 'Sim' : 'Não'}</span>
                  )}
                  {/* Render any other fields not explicitly handled */}
                  {Object.entries(item)
                    .filter(([key]) => ![
                      'creditorName', 'bankName', 'notaryName', 'amount',
                      'occurrenceDate', 'inclusionDate', 'legalNature',
                      'contractId', 'cadus', 'city', 'federalUnit',
                      'principal', 'dispute'
                    ].includes(key))
                    .map(([key, val]) => {
                      if (val == null || typeof val === 'object') return null;
                      return (
                        <span key={key}>
                          {formatFieldLabel(key)}: {isDateField(key) ? formatDate(String(val)) : String(val)}
                        </span>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        ) : count > 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {count} registro{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''} (detalhes resumidos pelo provedor)
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryField({ label, value, highlight }: { label: string; value: unknown; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-destructive' : 'text-foreground'}`}>
        {String(value)}
      </p>
    </div>
  );
}

/* ═══════════════ Utility ═══════════════ */

function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function isDateField(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes('date') || lower.includes('occurrence') || lower.includes('inclusion');
}
