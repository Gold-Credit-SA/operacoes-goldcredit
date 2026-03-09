import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, User, ShieldAlert, Search,
  TrendingUp, Calendar, DollarSign, Building2, Hash,
  CheckCircle2, XCircle, Info, CreditCard, Landmark,
  BookOpen, Receipt, Clock, Eye, Users, FileWarning
} from 'lucide-react';

interface SerasaDetailViewProps {
  data: Record<string, unknown>;
}

/* ═══════════════ Formatters ═══════════════ */

function fmt(value: number | undefined | null): string {
  if (value == null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(date: string | undefined | null): string {
  if (!date || date === '-') return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function fmtDoc(doc: string | undefined | null): string {
  if (!doc) return '-';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function calcAge(birthDate: string | undefined | null): string | null {
  if (!birthDate) return null;
  try {
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} anos`;
  } catch {
    return null;
  }
}

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function isDateKey(key: string): boolean {
  const l = key.toLowerCase();
  return l.includes('date') || l.includes('occurrence') || l.includes('inclusion');
}

/* ═══════════════ Main Component ═══════════════ */

export function SerasaDetailView({ data }: SerasaDetailViewProps) {
  const report: any = (data as any)?.reports?.[0] || (data as any)?.data?.reports?.[0] || data;
  const registration = report?.registration || {};
  const negativeData = report?.negativeData || {};
  const negativeSummary = report?.negativeSummary || {};
  const facts = report?.facts || {};
  const optionalFeatures = report?.optionalFeatures || {};
  const reportName = report?.reportName || 'Relatório Serasa';

  // Negative sections
  const pefin = negativeData?.pefin || {};
  const refin = negativeData?.refin || {};
  const collectionRecords = negativeData?.collectionRecords || {};
  const checks = negativeData?.check || {};
  const notary = negativeData?.notary || {};

  // Score
  const scoreData = optionalFeatures?.scoreResponse || optionalFeatures?.score || null;

  // Facts
  const inquiry = facts?.inquiry || {};
  const inquirySummary = facts?.inquirySummary || {};
  const stolenDocuments = facts?.stolenDocuments || {};
  const partnerships = facts?.partnerships || facts?.partnershipResponse || {};

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

  const inquiryActual = inquirySummary?.inquiryQuantity?.actual ?? inquiry?.summary?.count ?? 0;
  const inquiryPrevious = inquirySummary?.inquiryQuantity?.previous ?? 0;
  const partnershipCount = partnerships?.summary?.count ?? (Array.isArray(partnerships?.partnershipResponse) ? partnerships.partnershipResponse.length : 0);

  const age = calcAge(registration.birthDate);

  return (
    <div className="space-y-4">
      {/* ═══════════════════ CABEÇALHO / INFORMAÇÕES FIXADAS ═══════════════════ */}
      <Card className="border-primary/30">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <Badge variant="outline" className="text-xs font-mono mb-1">{reportName}</Badge>
              <h2 className="text-lg font-bold text-foreground">
                {fmtDoc(registration.documentNumber)} | {registration.consumerName || registration.companyName || '-'}
              </h2>
              <p className="text-xs text-muted-foreground">Atualizado em {fmtDate(registration.statusDate || report?.createdAt)}</p>
            </div>
          </div>

          {/* Summary strip — mirrors PDF header boxes */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Score mini */}
            <SummaryBox
              label="Score"
              icon={<TrendingUp className="h-4 w-4" />}
              value={scoreData?.score ?? '-'}
              sub={scoreData?.defaultRate ? `${(100 - scoreData.defaultRate).toFixed(2)}% chance de pagamento` : undefined}
              color={scoreData?.score >= 600 ? 'text-primary' : scoreData?.score >= 300 ? 'text-amber-500' : 'text-destructive'}
            />
            {/* Total anotações */}
            <SummaryBox
              label="Total em anotações negativas"
              icon={<AlertTriangle className="h-4 w-4" />}
              value={fmt(totalBalance)}
              sub={`${totalCount} registro${totalCount !== 1 ? 's' : ''}`}
              color={totalCount > 0 ? 'text-destructive' : 'text-primary'}
            />
            {/* Participação societária */}
            <SummaryBox
              label="Participação societária"
              icon={<Users className="h-4 w-4" />}
              value={partnershipCount}
              color="text-foreground"
            />
            {/* Consultas mês atual */}
            <SummaryBox
              label="Consultas neste mês"
              icon={<Search className="h-4 w-4" />}
              value={inquiryActual}
              color="text-foreground"
            />
            {/* Consultas mês passado */}
            <SummaryBox
              label="Consultas no mês passado"
              icon={<Clock className="h-4 w-4" />}
              value={inquiryPrevious}
              color="text-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════ IDENTIFICAÇÃO CADASTRAL ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Identificação Cadastral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <InfoRow label="Situação na Receita Federal">
              <Badge variant={registration.statusRegistration === 'REGULAR' ? 'default' : 'destructive'} className="text-xs">
                {registration.statusRegistration === 'REGULAR'
                  ? <CheckCircle2 className="h-3 w-3 mr-1" />
                  : <XCircle className="h-3 w-3 mr-1" />}
                {registration.statusRegistration || '-'}
              </Badge>
              {registration.statusDate && (
                <span className="text-xs text-muted-foreground ml-2">Atualizado em {fmtDate(registration.statusDate)}</span>
              )}
            </InfoRow>
            <InfoRow label="Data de Nascimento">
              <span className="text-sm text-foreground">{fmtDate(registration.birthDate)}</span>
              {age && <span className="text-xs text-muted-foreground ml-2">{age}</span>}
            </InfoRow>
            <InfoRow label="Município/UF">
              <span className="text-sm text-foreground">
                {registration.city || registration.municipality || 'Sem dados'}
                {registration.federalUnit ? ` / ${registration.federalUnit}` : ''}
              </span>
            </InfoRow>
            <InfoRow label="Documento">
              <span className="text-sm font-mono text-foreground">{fmtDoc(registration.documentNumber)}</span>
            </InfoRow>
            <InfoRow label="Sexo">
              <span className="text-sm text-foreground">
                {registration.consumerGender === 'M' ? 'Masculino' : registration.consumerGender === 'F' ? 'Feminino' : registration.consumerGender || '-'}
              </span>
            </InfoRow>
            {registration.address && (
              <InfoRow label="Endereço">
                <span className="text-sm text-foreground">{registration.address}</span>
              </InfoRow>
            )}
          </div>

          {/* Outros Dados Cadastrais */}
          {registration.motherName && (
            <>
              <Separator className="my-3" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Outros Dados Cadastrais</p>
                <InfoRow label="Nome da Mãe">
                  <span className="text-sm text-foreground">{registration.motherName}</span>
                </InfoRow>
              </div>
            </>
          )}

          {negativeSummary?.message?.trim() && (
            <div className="mt-3 p-2.5 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {negativeSummary.message.trim()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ SERASA SCORE ═══════════════════ */}
      {scoreData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Serasa Score
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Análise de risco de crédito que indica a probabilidade do indivíduo pagar suas contas em dia nos próximos 12 meses
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center min-w-[80px]">
                <div className={`text-5xl font-bold ${
                  (scoreData.score ?? 0) >= 600 ? 'text-primary' : (scoreData.score ?? 0) >= 300 ? 'text-amber-500' : 'text-destructive'
                }`}>
                  {scoreData.score ?? '-'}
                </div>
                {scoreData.defaultRate != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(100 - scoreData.defaultRate).toFixed(2)}% de chance de pagamento
                  </p>
                )}
              </div>
              <div className="flex-1">
                {/* Score bar */}
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (scoreData.score ?? 0) >= 600 ? 'bg-primary' : (scoreData.score ?? 0) >= 300 ? 'bg-amber-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min(((scoreData.score ?? 0) / 1000) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span>500</span>
                  <span>1000</span>
                </div>
              </div>
            </div>

            {/* Interpretation */}
            {scoreData.range && (
              <div className="p-3 bg-muted/50 border border-border rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Interpretação</p>
                <p className="text-sm text-foreground">{scoreData.range}</p>
              </div>
            )}

            {scoreData.message && (
              <div className="mt-2 p-3 bg-muted/50 border border-border rounded-lg">
                <p className="text-xs text-muted-foreground">{scoreData.message}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              {scoreData.scoreModel && (
                <InfoRow label="Modelo">
                  <span className="text-sm text-foreground">{scoreData.scoreModel}</span>
                </InfoRow>
              )}
              {scoreData.defaultRate != null && (
                <InfoRow label="Prob. Inadimplência">
                  <span className="text-sm text-foreground">{scoreData.defaultRate}%</span>
                </InfoRow>
              )}
            </div>

            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                <strong>Atenção:</strong> A decisão da aprovação ou não do crédito é de exclusiva responsabilidade do concedente. As informações prestadas pela Serasa Experian têm o objetivo de subsidiar essas decisões.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ ANOTAÇÕES NEGATIVAS - RESUMO ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Anotações Negativas
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Detalhamento sobre as anotações negativas do indivíduo de acordo com diversas fontes.
          </p>
        </CardHeader>
        <CardContent>
          {/* Summary row */}
          <div className="mb-4 p-3 bg-muted/30 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total de dívidas:</p>
            <p className={`text-xl font-bold ${totalBalance > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {fmt(totalBalance)}
            </p>
          </div>

          {/* Category summary table */}
          <div className="border border-border rounded-lg overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] h-9">Total anotações negativas</TableHead>
                  <TableHead className="text-[10px] h-9">Dívidas comerciais - Pefin</TableHead>
                  <TableHead className="text-[10px] h-9">Dívidas Inst. Financeiras - Refin</TableHead>
                  <TableHead className="text-[10px] h-9">Dívidas vencidas - Convem</TableHead>
                  <TableHead className="text-[10px] h-9">Dívidas Protestadas</TableHead>
                  <TableHead className="text-[10px] h-9">Cheques sem fundo - BACEN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold text-destructive">{fmt(totalBalance)}</TableCell>
                  <NegSummaryCell summary={pefin?.summary} />
                  <NegSummaryCell summary={refin?.summary} />
                  <NegSummaryCell summary={collectionRecords?.summary} />
                  <NegSummaryCell summary={notary?.summary} />
                  <NegSummaryCell summary={checks?.summary} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════ PEFIN DETALHES ═══════════════════ */}
      <NegativeDetailTable
        title="Dívidas Comerciais - Pefin"
        icon={<DollarSign className="h-4 w-4 text-destructive" />}
        items={pefin?.pefinResponse || []}
        summary={pefin?.summary}
        columns={['occurrenceDate', 'amount', 'legalNature', 'contractId', 'creditorName', 'principal', 'federalUnit']}
        columnLabels={['Data', 'Valor', 'Natureza', 'Contrato', 'Origem', 'Avalista', 'UF']}
      />

      {/* ═══════════════════ REFIN DETALHES ═══════════════════ */}
      <NegativeDetailTable
        title="Dívidas em Instituições Financeiras - Refin"
        icon={<Landmark className="h-4 w-4 text-destructive" />}
        items={refin?.refinResponse || []}
        summary={refin?.summary}
        columns={['occurrenceDate', 'amount', 'legalNature', 'contractId', 'creditorName', 'principal', 'federalUnit']}
        columnLabels={['Data', 'Valor', 'Modalidade', 'Contrato', 'Origem', 'Avalista', 'UF']}
      />

      {/* ═══════════════════ CONVEM / DÍVIDAS VENCIDAS ═══════════════════ */}
      <NegativeDetailTable
        title="Dívidas Vencidas - Convem"
        icon={<Receipt className="h-4 w-4 text-destructive" />}
        items={collectionRecords?.collectionRecordsResponse || []}
        summary={collectionRecords?.summary}
        columns={['occurrenceDate', 'amount', 'legalNature', 'contractId', 'creditorName', 'principal', 'federalUnit']}
        columnLabels={['Data', 'Valor', 'Natureza', 'Contrato', 'Origem', 'Avalista', 'UF']}
      />

      {/* ═══════════════════ PROTESTOS ═══════════════════ */}
      <NegativeDetailTable
        title="Dívidas Protestadas (Registradas em cartório)"
        icon={<BookOpen className="h-4 w-4 text-destructive" />}
        items={notary?.notaryResponse || []}
        summary={notary?.summary}
        columns={['occurrenceDate', 'amount', 'city', 'federalUnit', 'notaryName']}
        columnLabels={['Data', 'Valor', 'Cidade', 'UF', 'N° do Cartório']}
      />

      {/* ═══════════════════ CHEQUES SEM FUNDO ═══════════════════ */}
      <NegativeDetailTable
        title="Cheques sem Fundo - BACEN"
        icon={<CreditCard className="h-4 w-4 text-destructive" />}
        items={checks?.checkResponse || []}
        summary={checks?.summary}
        columns={['occurrenceDate', 'amount', 'bankName', 'city', 'federalUnit']}
        columnLabels={['Data', 'Valor', 'Banco', 'Cidade', 'UF']}
      />

      {/* ═══════════════════ PARTICIPAÇÕES SOCIETÁRIAS ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Participações Societárias
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vínculos do documento como sócio em outras empresas.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Participação societária:</span>
            <Badge variant="outline" className="text-xs font-bold">{partnershipCount}</Badge>
          </div>
          {Array.isArray(partnerships?.partnershipResponse) && partnerships.partnershipResponse.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] h-9">CNPJ</TableHead>
                    <TableHead className="text-[10px] h-9">Razão Social</TableHead>
                    <TableHead className="text-[10px] h-9">Participação</TableHead>
                    <TableHead className="text-[10px] h-9">Situação</TableHead>
                    <TableHead className="text-[10px] h-9">Data Entrada</TableHead>
                    <TableHead className="text-[10px] h-9">UF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerships.partnershipResponse.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-mono">{fmtDoc(p.documentNumber || p.cnpj)}</TableCell>
                      <TableCell className="text-xs font-medium">{p.companyName || p.businessName || '-'}</TableCell>
                      <TableCell className="text-xs">{p.participationPercentage != null ? `${p.participationPercentage}%` : '-'}</TableCell>
                      <TableCell className="text-xs">{p.status || p.situation || '-'}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.entryDate || p.startDate)}</TableCell>
                      <TableCell className="text-xs">{p.federalUnit || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Nenhum registro para este documento.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ DOCUMENTOS ROUBADOS ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Documentos Roubados
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Documentos roubados, furtados ou extraviados
          </p>
        </CardHeader>
        <CardContent>
          {Array.isArray(stolenDocuments?.stolenDocumentsResponse) && stolenDocuments.stolenDocumentsResponse.length > 0 ? (
            <div className="space-y-2">
              {stolenDocuments.stolenDocumentsResponse.map((item: any, i: number) => (
                <div key={i} className="text-xs border border-destructive/30 bg-destructive/5 rounded-md p-3 space-y-1">
                  {Object.entries(item).map(([key, val]) => (
                    <div key={key} className="flex items-baseline gap-2">
                      <span className="text-muted-foreground shrink-0">{fieldLabel(key)}:</span>
                      <span className="text-foreground font-medium">
                        {isDateKey(key) ? fmtDate(String(val)) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {stolenDocuments?.summary?.returnMessage || 'Nenhum registro para este documento.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ CONSULTAS À SERASA EXPERIAN ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Consultas à Serasa Experian
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Detalhamento do mês atual e do mês anterior de consultas deste documento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border border-border rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{inquiryActual}</p>
              <p className="text-xs text-muted-foreground mt-1">Consultas neste mês</p>
            </div>
            <div className="p-3 border border-border rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{inquiryPrevious}</p>
              <p className="text-xs text-muted-foreground mt-1">Consultas no mês passado</p>
            </div>
          </div>

          {/* Monthly history grid */}
          {Array.isArray(inquirySummary?.inquiryQuantity?.creditInquiriesQuantity) &&
            inquirySummary.inquiryQuantity.creditInquiriesQuantity.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
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

          <Separator />

          {/* Detailed inquiry table */}
          {Array.isArray(inquiry?.inquiryResponse) && inquiry.inquiryResponse.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Exibindo {inquiry.inquiryResponse.length} registros.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] h-9">Data da consulta</TableHead>
                      <TableHead className="text-[10px] h-9 text-center">Quantidade de consultas no dia</TableHead>
                      <TableHead className="text-[10px] h-9">Segmento do consultante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiry.inquiryResponse.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{fmtDate(item.occurrenceDate)}</TableCell>
                        <TableCell className="text-xs text-center">{item.daysQuantity ?? item.quantityDay ?? 1}</TableCell>
                        <TableCell className="text-xs">{item.segmentDescription || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Sem consultas registradas
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ CAMPOS NÃO MAPEADOS (CATCH-ALL) ═══════════════════ */}
      <UnmappedFieldsSection report={report} />

      {/* Raw JSON */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <Eye className="h-3 w-3" />
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

function SummaryBox({ label, icon, value, sub, color }: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-3 border border-border rounded-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <p className={`text-lg font-bold ${color || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      {children}
    </div>
  );
}

function NegSummaryCell({ summary }: { summary?: any }) {
  const count = summary?.count ?? 0;
  const balance = summary?.balance ?? 0;
  return (
    <TableCell>
      {count > 0 ? (
        <div>
          <p className="text-xs font-bold text-destructive">{fmt(balance)}</p>
          <p className="text-[10px] text-muted-foreground">{count} registro{count !== 1 ? 's' : ''}</p>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Sem registros</span>
      )}
    </TableCell>
  );
}

function NegativeDetailTable({ title, icon, items, summary, columns, columnLabels }: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  summary?: any;
  columns: string[];
  columnLabels: string[];
}) {
  const count = summary?.count ?? 0;
  const hasItems = Array.isArray(items) && items.length > 0;

  if (!hasItems && count === 0) return null;

  const formatCellValue = (item: any, col: string): string => {
    const val = item[col];
    if (val == null) return '-';
    if (col === 'amount') return fmt(val);
    if (col === 'principal') return val ? 'Sim' : 'Não';
    if (isDateKey(col)) return fmtDate(String(val));
    return String(val);
  };

  // Collect ALL extra fields not in the main columns
  const getExtraFields = (item: any): { key: string; label: string; value: string }[] => {
    const skip = new Set(columns);
    const extras: { key: string; label: string; value: string }[] = [];
    
    for (const [k, v] of Object.entries(item)) {
      if (skip.has(k) || v == null) continue;
      
      if (k === 'dispute' && typeof v === 'object') {
        // Flatten dispute sub-fields
        const d = v as Record<string, unknown>;
        for (const [dk, dv] of Object.entries(d)) {
          if (dv == null) continue;
          extras.push({
            key: `dispute.${dk}`,
            label: fieldLabel(dk),
            value: typeof dv === 'boolean' ? (dv ? 'Sim' : 'Não') : isDateKey(dk) ? fmtDate(String(dv)) : String(dv),
          });
        }
      } else if (typeof v === 'object') {
        // Flatten any other nested object
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          if (sv == null) continue;
          extras.push({
            key: `${k}.${sk}`,
            label: `${fieldLabel(k)} - ${fieldLabel(sk)}`,
            value: typeof sv === 'boolean' ? (sv ? 'Sim' : 'Não') : isDateKey(sk) ? fmtDate(String(sv)) : String(sv),
          });
        }
      } else {
        extras.push({
          key: k,
          label: fieldLabel(k),
          value: typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : isDateKey(k) ? fmtDate(String(v)) : String(v),
        });
      }
    }
    return extras;
  };

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
              {count} registro{count !== 1 ? 's' : ''} • {fmt(summary.balance)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Period info */}
        {summary?.firstOccurrence && (
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Período: {fmtDate(summary.firstOccurrence)} a {fmtDate(summary.lastOccurrence)}
          </p>
        )}

        {hasItems ? (
          <>
            <p className="text-xs text-muted-foreground mb-2">Exibindo {items.length} registros.</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {columnLabels.map((l, i) => (
                        <TableHead key={i} className="text-[10px] h-9 whitespace-nowrap">{l}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, i: number) => (
                      <TableRow key={i}>
                        {columns.map((col, j) => (
                          <TableCell key={j} className="text-xs whitespace-nowrap">
                            {formatCellValue(item, col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {/* Extra fields row below table if any item has them */}
            {items.some(item => getExtraFields(item).length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Informações adicionais por registro:</p>
                {items.map((item, i) => {
                  const extras = getExtraFields(item);
                  if (extras.length === 0) return null;
                  return (
                    <div key={i} className="text-[10px] p-2.5 bg-muted/30 rounded-lg border border-border space-y-1">
                      <span className="font-semibold text-foreground text-xs">Registro #{i + 1}</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                        {extras.map((f) => (
                          <div key={f.key} className="flex items-baseline gap-1.5">
                            <span className="text-muted-foreground shrink-0">{f.label}:</span>
                            <span className="text-foreground font-medium">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : count > 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {count} registro{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''} (detalhes resumidos pelo provedor)
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Renders any top-level keys from the report that weren't explicitly handled */
function UnmappedFieldsSection({ report }: { report: any }) {
  if (!report || typeof report !== 'object') return null;

  const handledKeys = new Set([
    'reportName', 'registration', 'negativeData', 'negativeSummary',
    'facts', 'optionalFeatures', 'createdAt', 'reports', 'data'
  ]);

  const unmapped = Object.entries(report).filter(
    ([k, v]) => !handledKeys.has(k) && v != null && (typeof v !== 'object' || (typeof v === 'object' && Object.keys(v as any).length > 0))
  );

  if (unmapped.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-muted-foreground" />
          Outras Informações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unmapped.map(([key, val]) => (
          <div key={key} className="text-xs">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">{fieldLabel(key)}</p>
            {typeof val === 'object' ? (
              <pre className="bg-muted p-2 rounded text-[10px] font-mono overflow-auto max-h-40">
                {JSON.stringify(val, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-foreground">{isDateKey(key) ? fmtDate(String(val)) : String(val)}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
