import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle, User, FileWarning, Search, ShieldAlert,
  TrendingUp, Calendar, DollarSign, Building2, Hash,
  CheckCircle2, XCircle, Info
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

function statusBadge(status: string | undefined | null) {
  if (!status) return null;
  const isRegular = status.toUpperCase() === 'REGULAR';
  return (
    <Badge variant={isRegular ? 'default' : 'destructive'} className="text-xs">
      {isRegular ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {status}
    </Badge>
  );
}

export function SerasaDetailView({ data }: SerasaDetailViewProps) {
  const report = (data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data;
  const registration = report?.registration || {};
  const negativeData = report?.negativeData || {};
  const negativeSummary = report?.negativeSummary || {};
  const facts = report?.facts || {};
  const optionalFeatures = report?.optionalFeatures || {};
  const reportName = report?.reportName || '';

  // Facts sections
  const inquiry = facts?.inquiry || {};
  const inquirySummary = facts?.inquirySummary || {};
  const stolenDocuments = facts?.stolenDocuments || {};

  // Negative data sections (correct structure from API)
  const pefin = negativeData?.pefin || {};
  const refin = negativeData?.refin || {};
  const collectionRecords = negativeData?.collectionRecords || {};
  const checks = negativeData?.check || {};
  const notary = negativeData?.notary || {};

  // Score
  const scoreData = optionalFeatures?.scoreResponse || optionalFeatures?.score || null;

  // Total negative balance
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
      <div className="flex items-center justify-between">
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

      {/* Registration */}
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
                {statusBadge(registration.statusRegistration)}
                {registration.statusDate && (
                  <span className="text-xs text-muted-foreground">desde {formatDate(registration.statusDate)}</span>
                )}
              </div>
            </div>
          </div>
          {negativeSummary?.message && (
            <div className="mt-3 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {negativeSummary.message.trim()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score */}
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

      {/* Negative Data Summary Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Resumo de Anotações Negativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <NegativeSummaryItem
              label="PEFIN"
              count={pefin?.summary?.count}
              balance={pefin?.summary?.balance}
              firstDate={pefin?.summary?.firstOccurrence}
              lastDate={pefin?.summary?.lastOccurrence}
            />
            <NegativeSummaryItem
              label="REFIN"
              count={refin?.summary?.count}
              balance={refin?.summary?.balance}
              firstDate={refin?.summary?.firstOccurrence}
              lastDate={refin?.summary?.lastOccurrence}
            />
            <NegativeSummaryItem
              label="Dívidas Vencidas"
              count={collectionRecords?.summary?.count}
              balance={collectionRecords?.summary?.balance}
              firstDate={collectionRecords?.summary?.firstOccurrence}
              lastDate={collectionRecords?.summary?.lastOccurrence}
            />
            <NegativeSummaryItem
              label="Cheques s/ Fundo"
              count={checks?.summary?.count || checks?.summary?.checkCount}
              balance={checks?.summary?.balance}
              firstDate={checks?.summary?.firstOccurrence}
              lastDate={checks?.summary?.lastOccurrence}
            />
            <NegativeSummaryItem
              label="Protestos"
              count={notary?.summary?.count}
              balance={notary?.summary?.balance}
              firstDate={notary?.summary?.firstOccurrence}
              lastDate={notary?.summary?.lastOccurrence}
            />
          </div>
          {totalCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Geral</span>
              <div className="text-right">
                <span className="text-sm font-bold text-destructive">{formatCurrency(totalBalance)}</span>
                <span className="text-xs text-muted-foreground ml-2">({totalCount} ocorrências)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PEFIN Details */}
      <NegativeDetailSection
        title="Pendências Financeiras (PEFIN)"
        icon={<DollarSign className="h-4 w-4 text-destructive" />}
        items={pefin?.pefinResponse || []}
        summary={pefin?.summary}
      />

      {/* REFIN Details */}
      <NegativeDetailSection
        title="Restrições Financeiras (REFIN)"
        icon={<DollarSign className="h-4 w-4 text-destructive" />}
        items={refin?.refinResponse || []}
        summary={refin?.summary}
      />

      {/* Collection Records Details */}
      <NegativeDetailSection
        title="Dívidas Vencidas (Cobranças)"
        icon={<FileWarning className="h-4 w-4 text-destructive" />}
        items={collectionRecords?.collectionRecordsResponse || []}
        summary={collectionRecords?.summary}
      />

      {/* Check Details */}
      <NegativeDetailSection
        title="Cheques sem Fundo"
        icon={<FileWarning className="h-4 w-4 text-destructive" />}
        items={checks?.checkResponse || []}
        summary={checks?.summary}
      />

      {/* Notary/Protest Details */}
      <NegativeDetailSection
        title="Protestos"
        icon={<FileWarning className="h-4 w-4 text-destructive" />}
        items={notary?.notaryResponse || []}
        summary={notary?.summary}
      />

      {/* Stolen Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Documentos Roubados/Extraviados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(stolenDocuments?.summary?.count > 0) ? (
            <div className="space-y-2">
              <Badge variant="destructive">
                {stolenDocuments.summary.count} documento(s)
              </Badge>
              {Array.isArray(stolenDocuments.stolenDocumentsResponse) && stolenDocuments.stolenDocumentsResponse.map((item: any, i: number) => (
                <div key={i} className="text-xs border border-border rounded-md p-2">
                  <DataRow label="Tipo" value={item.documentType} />
                  <DataRow label="Data" value={formatDate(item.occurrenceDate)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Nenhum documento roubado/extraviado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Inquiries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Consultas Realizadas à Serasa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Inquiry Summary */}
          {inquirySummary?.inquiryQuantity && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Consultas no mês atual:</span>
                <Badge variant="outline">{inquirySummary.inquiryQuantity.actual ?? 0}</Badge>
              </div>
              {Array.isArray(inquirySummary.inquiryQuantity.creditInquiriesQuantity) &&
                inquirySummary.inquiryQuantity.creditInquiriesQuantity.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Histórico mensal:</p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                    {inquirySummary.inquiryQuantity.creditInquiriesQuantity.map((q: any, i: number) => (
                      <div key={i} className="text-center p-1.5 bg-muted rounded text-xs">
                        <div className="font-medium">{q.occurrences ?? 0}</div>
                        <div className="text-muted-foreground text-[10px]">{q.inquiryDate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inquiry count from facts */}
          {inquiry?.summary?.count != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total de consultas nos últimos meses:</span>
              <Badge variant="outline">{inquiry.summary.count}</Badge>
            </div>
          )}

          <Separator />

          {/* Inquiry Response List */}
          {Array.isArray(inquiry?.inquiryResponse) && inquiry.inquiryResponse.length > 0 ? (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider pb-1 border-b border-border">
                <span>Segmento</span>
                <span className="text-center">Qtd. Dias</span>
                <span className="text-right">Data</span>
              </div>
              {inquiry.inquiryResponse.map((item: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-medium">{item.segmentDescription || '-'}</span>
                  <span className="text-center text-muted-foreground">{item.daysQuantity ?? '-'}</span>
                  <span className="text-right text-muted-foreground">{formatDate(item.occurrenceDate)}</span>
                </div>
              ))}
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

function NegativeSummaryItem({ label, count, balance, firstDate, lastDate }: {
  label: string;
  count?: number;
  balance?: number;
  firstDate?: string;
  lastDate?: string;
}) {
  const hasIssues = (count ?? 0) > 0;
  return (
    <div className={`p-3 rounded-lg border transition-colors ${hasIssues ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${hasIssues ? 'text-destructive' : 'text-foreground'}`}>
        {count ?? 0}
      </p>
      {hasIssues && (
        <>
          <p className="text-xs text-destructive font-medium mt-0.5">{formatCurrency(balance)}</p>
          {(firstDate || lastDate) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {firstDate && lastDate && firstDate !== lastDate
                ? `${formatDate(firstDate)} — ${formatDate(lastDate)}`
                : formatDate(lastDate || firstDate)}
            </p>
          )}
        </>
      )}
      {!hasIssues && (
        <p className="text-[10px] text-muted-foreground mt-0.5">Nenhuma</p>
      )}
    </div>
  );
}

function NegativeDetailSection({ title, icon, items, summary }: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  summary?: any;
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {summary && (
            <Badge variant="destructive" className="text-xs">
              {summary.count} • {formatCurrency(summary.balance)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.map((item: any, i: number) => (
            <div key={i} className="text-xs border border-border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
              {/* Header row */}
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

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                {item.occurrenceDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Ocorrência: {formatDate(item.occurrenceDate)}
                  </span>
                )}
                {item.inclusionDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Inclusão: {formatDate(item.inclusionDate)}
                  </span>
                )}
                {item.legalNature && (
                  <span>Natureza: {item.legalNature}</span>
                )}
                {item.contractId && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Contrato: {item.contractId}
                  </span>
                )}
                {item.cadus && (
                  <span>CADUS: {item.cadus}</span>
                )}
                {item.city && (
                  <span>{item.city}{item.federalUnit ? ` - ${item.federalUnit}` : ''}</span>
                )}
                {item.principal != null && (
                  <span>Principal: {item.principal ? 'Sim' : 'Não'}</span>
                )}
                {item.dispute?.disputeIndicativeFlag != null && (
                  <span>
                    Disputa: {item.dispute.disputeIndicativeFlag ? 'Sim' : 'Não'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
