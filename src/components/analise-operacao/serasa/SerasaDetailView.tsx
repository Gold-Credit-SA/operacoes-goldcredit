import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User, FileWarning, Search, ShieldAlert, TrendingUp } from 'lucide-react';

interface SerasaDetailViewProps {
  data: Record<string, unknown>;
}

function formatCurrency(value: number | undefined | null): string {
  if (value == null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: string | undefined | null): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

export function SerasaDetailView({ data }: SerasaDetailViewProps) {
  // The response may be nested under `data` or `reports[0]`
  const report = (data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data;
  const registration = report?.registration || {};
  const negativeData = report?.negativeData || {};
  const inquiry = report?.inquiry || {};
  const stolenDocuments = report?.stolenDocuments || {};
  const optionalFeatures = report?.optionalFeatures || {};

  // Score from optional features
  const scoreData = optionalFeatures?.scoreResponse || optionalFeatures?.score || null;

  // Negative data sections
  const pefin = negativeData?.pefinResponse || {};
  const refin = negativeData?.refinResponse || {};
  const collectionRecords = negativeData?.collectionRecordsResponse || {};
  const checks = negativeData?.checkResponse || {};
  const protests = negativeData?.notaryResponse || {};

  return (
    <div className="space-y-4">
      {/* Registration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Dados Cadastrais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DataRow label="Nome" value={registration.consumerName} />
          <DataRow label="CPF" value={registration.documentNumber} />
          <DataRow label="Situação" value={registration.statusRegistration} />
          <DataRow label="Data Situação" value={formatDate(registration.statusDate)} />
          <DataRow label="Data Nascimento" value={formatDate(registration.birthDate)} />
          <DataRow label="Nome da Mãe" value={registration.motherName} />
          <DataRow label="Sexo" value={registration.consumerGender} />
        </CardContent>
      </Card>

      {/* Score */}
      {scoreData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">{scoreData.score ?? '-'}</div>
              <div className="space-y-1">
                <DataRow label="Modelo" value={scoreData.scoreModel} />
                <DataRow label="Faixa" value={scoreData.range} />
                <DataRow label="Prob. Inadimplência" value={scoreData.defaultRate} />
                <DataRow label="Mensagem" value={scoreData.message} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Negative Data Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Anotações Negativas — Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <NegativeSummaryItem
              label="PEFIN"
              count={pefin?.summary?.count}
              balance={pefin?.summary?.balance}
            />
            <NegativeSummaryItem
              label="REFIN"
              count={refin?.summary?.count}
              balance={refin?.summary?.balance}
            />
            <NegativeSummaryItem
              label="Dívidas Vencidas"
              count={collectionRecords?.summary?.count}
              balance={collectionRecords?.summary?.balance}
            />
            <NegativeSummaryItem
              label="Cheques s/ Fundo"
              count={checks?.summary?.count}
              balance={checks?.summary?.balance}
            />
            <NegativeSummaryItem
              label="Protestos"
              count={protests?.summary?.count}
              balance={protests?.summary?.balance}
            />
          </div>
        </CardContent>
      </Card>

      {/* PEFIN Details */}
      <NegativeDetailSection
        title="Pendências Financeiras (PEFIN)"
        items={Array.isArray(pefin) ? pefin : pefin?.ppiResponse || []}
      />

      {/* REFIN Details */}
      <NegativeDetailSection
        title="Restrições Financeiras (REFIN)"
        items={Array.isArray(refin) ? refin : refin?.rpiResponse || []}
      />

      {/* Collection Records */}
      <NegativeDetailSection
        title="Dívidas Vencidas"
        items={Array.isArray(collectionRecords) ? collectionRecords : collectionRecords?.collectionRecordsResponseDetail || []}
      />

      {/* Checks */}
      <NegativeDetailSection
        title="Cheques sem Fundo"
        items={Array.isArray(checks) ? checks : checks?.checkResponseDetail || []}
      />

      {/* Protests */}
      <NegativeDetailSection
        title="Protestos"
        items={Array.isArray(protests) ? protests : protests?.notaryResponseDetail || []}
      />

      {/* Stolen Documents */}
      {(stolenDocuments?.summary?.count > 0 || (Array.isArray(stolenDocuments) && stolenDocuments.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Documentos Roubados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="destructive">
              {stolenDocuments?.summary?.count || 0} documento(s) roubado(s)
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Inquiries */}
      {inquiry && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Consultas à Serasa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inquiry.inquirySummary && (
              <div className="space-y-1">
                <DataRow label="Mês atual" value={inquiry.inquirySummary.actual} />
              </div>
            )}
            {Array.isArray(inquiry.inquiryResponse) && inquiry.inquiryResponse.length > 0 ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {inquiry.inquiryResponse.map((item: any, i: number) => (
                  <div key={i} className="text-xs flex justify-between border-b border-border py-1">
                    <span>{item.segmentDescription}</span>
                    <span className="text-muted-foreground">{formatDate(item.occurrenceDate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma consulta registrada</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Raw JSON fallback */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver JSON completo
        </summary>
        <pre className="mt-2 bg-muted p-3 rounded-md overflow-auto max-h-80 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <span className="text-sm text-foreground">{String(value)}</span>
    </div>
  );
}

function NegativeSummaryItem({ label, count, balance }: { label: string; count?: number; balance?: number }) {
  const hasIssues = (count ?? 0) > 0;
  return (
    <div className={`p-3 rounded-lg border ${hasIssues ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${hasIssues ? 'text-destructive' : 'text-foreground'}`}>
        {count ?? 0}
      </p>
      {hasIssues && (
        <p className="text-xs text-destructive">{formatCurrency(balance)}</p>
      )}
    </div>
  );
}

function NegativeDetailSection({ title, items }: { title: string; items: any[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-destructive" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {items.map((item: any, i: number) => (
            <div key={i} className="text-xs border border-border rounded-md p-2 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">{item.creditorName || item.bankName || '-'}</span>
                <span className="text-muted-foreground">{formatDate(item.occurrenceDate)}</span>
              </div>
              {item.amount != null && (
                <div className="text-destructive font-medium">{formatCurrency(item.amount)}</div>
              )}
              {item.legalNature && <div className="text-muted-foreground">Natureza: {item.legalNature}</div>}
              {item.contractId && <div className="text-muted-foreground">Contrato: {item.contractId}</div>}
              {item.city && <div className="text-muted-foreground">{item.city} - {item.federalUnit}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
