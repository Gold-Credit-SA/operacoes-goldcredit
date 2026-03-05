import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Calendar, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

// SCR Modalidade codes to labels
const MODALIDADE_MAP: Record<string, string> = {
  '0201': 'Empréstimos - Adiantamentos a depositantes',
  '0202': 'Empréstimos - Empréstimos',
  '0203': 'Empréstimos - Títulos descontados',
  '0204': 'Empréstimos - Antecipação de fatura de cartão de crédito',
  '0205': 'Empréstimos - Aquisição de recebíveis',
  '0206': 'Empréstimos - Avais e fianças',
  '0207': 'Empréstimos - Cartão de crédito',
  '0208': 'Empréstimos - Cheque especial e conta garantida',
  '0209': 'Empréstimos - Crédito pessoal consignado',
  '0210': 'Empréstimos - Crédito pessoal sem consignação',
  '0211': 'Empréstimos - Crédito rotativo',
  '0212': 'Empréstimos - Financiamento imobiliário',
  '0213': 'Empréstimos - Microcrédito',
  '0214': 'Empréstimos - Cheque especial',
  '0301': 'Títulos descontados - Direitos creditórios descontados',
  '0302': 'Títulos descontados - Desconto de duplicatas',
  '0303': 'Títulos descontados - Desconto de cheques',
  '1304': 'Capital de giro com prazo de vencimento até 365 dias',
  '1902': 'Outros empréstimos',
  '1903': 'Outros títulos descontados',
  '1904': 'Outros financiamentos',
  '1905': 'Capital de giro com teto rotativo',
  '1909': 'Limite - Cartão de crédito / Cheque especial',
};

// Vencimento labels
const VENCIMENTO_MAP: Record<string, string> = {
  'v10': 'Vencidos há mais de 15 dias',
  'v20': 'A vencer até 30 dias',
  'v30': 'A vencer de 1 a 30 dias',
  'v40': 'A vencer de 31 a 60 dias',
  'v110': 'A vencer até 30 dias',
  'v120': 'A vencer de 31 a 60 dias',
  'v130': 'A vencer de 61 a 90 dias',
  'v140': 'A vencer de 91 a 180 dias',
  'v150': 'A vencer de 181 a 360 dias',
  'v160': 'A vencer de 361 a 720 dias',
  'v170': 'A vencer de 721 a 1080 dias',
  'v180': 'A vencer de 1081 a 1440 dias',
  'v190': 'A vencer de 1441 a 1800 dias',
  'v200': 'A vencer acima de 1800 dias',
};

const SEGMENTO_MAP: Record<string, string> = {
  '01': 'PF',
  '02': 'PJ',
  '03': 'PJ - Pequeno Porte',
};

const ORI_REC_MAP: Record<string, string> = {
  '0101': 'Recursos livres',
  '0199': 'Outros recursos livres',
  '0201': 'Recursos direcionados',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDtb(dtb: number): string {
  const str = String(dtb);
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year}`;
}

function formatDate(date: string): string {
  if (!date) return '-';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

interface ResVenc {
  [key: string]: number;
}

interface Operacao {
  mod: string;
  oriRec: string;
  indx: string;
  varCamb: string;
  segmento: string;
  resVenc: ResVenc;
  lsGar?: Array<{ tp: string; qtd: number }>;
}

interface DtbEntry {
  dtb: number;
  docProc: string;
  volProc: string;
  qtdIfs: number;
  qtdCongFinc?: number;
  dtbIniRel: string;
  coobAss: number;
  coobRec: number;
  lsOp: Operacao[];
}

interface SCRResponse {
  cdCli: string;
  tpCli?: number;
  dtbConsult: string;
  name?: string;
  lsDtb: DtbEntry[];
}

function getModalidadeLabel(mod: string): string {
  return MODALIDADE_MAP[mod] || `Modalidade ${mod}`;
}

function getModalidadeCategory(mod: string): string {
  const code = parseInt(mod);
  if (code >= 200 && code < 300) return 'Empréstimos';
  if (code >= 300 && code < 400) return 'Títulos Descontados';
  if (code >= 1300 && code < 1400) return 'Capital de Giro';
  if (code >= 1900 && code < 2000) return 'Outros';
  return 'Outros';
}

function calcTotalVenc(resVenc: ResVenc): number {
  return Object.values(resVenc).reduce((sum, v) => sum + (v || 0), 0);
}

function calcTotalAVencer(dtbEntry: DtbEntry): number {
  return dtbEntry.lsOp.reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);
}

interface SCRDetailViewProps {
  data: Record<string, unknown>;
}

export function SCRDetailView({ data }: SCRDetailViewProps) {
  // Extract the response data - handle nested structures
  const response = useMemo<SCRResponse | null>(() => {
    const resp = (data as any)?.response || (data as any)?.data?.response || data;
    if (resp?.lsDtb) return resp as SCRResponse;
    if ((data as any)?.data?.lsDtb) return (data as any).data as SCRResponse;
    return null;
  }, [data]);

  if (!response || !response.lsDtb?.length) {
    const message = (data as any)?.message || (data as any)?.data?.message || '';
    const respMsg = (data as any)?.response?.mensagem || (data as any)?.data?.response?.mensagem || '';
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Consulta sem dados detalhados</span>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {respMsg && <p className="text-sm text-muted-foreground">{respMsg}</p>}
      </div>
    );
  }

  // Use the most recent month
  const latestDtb = response.lsDtb[response.lsDtb.length - 1];
  const totalAVencer = calcTotalAVencer(latestDtb);
  const entityName = (data as any)?.data?.name || (data as any)?.name || response.name || '';

  // Aggregate vencimento buckets across all operations for the latest month
  const vencimentoBuckets: Record<string, number> = {};
  latestDtb.lsOp.forEach(op => {
    Object.entries(op.resVenc).forEach(([key, val]) => {
      vencimentoBuckets[key] = (vencimentoBuckets[key] || 0) + val;
    });
  });

  // Group operations by category
  const opsByCategory: Record<string, { ops: Operacao[]; total: number }> = {};
  latestDtb.lsOp.forEach(op => {
    const cat = getModalidadeCategory(op.mod);
    if (!opsByCategory[cat]) opsByCategory[cat] = { ops: [], total: 0 };
    opsByCategory[cat].ops.push(op);
    opsByCategory[cat].total += calcTotalVenc(op.resVenc);
  });

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            SCR - Sistema de Informações de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entityName && (
            <p className="font-semibold text-foreground">{entityName}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">CPF/CNPJ:</span>
              <p className="font-mono font-medium">{response.cdCli}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Período consultado:</span>
              <p className="font-medium">{response.dtbConsult}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Início do relacionamento:</span>
              <p className="font-medium">{formatDate(latestDtb.dtbIniRel)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Doc. processados:</span>
              <p className="font-medium">{latestDtb.docProc}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vol. processado:</span>
              <p className="font-medium">{latestDtb.volProc}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total de instituições:</span>
              <p className="font-medium">{latestDtb.qtdIfs}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carteira Ativa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Carteira Ativa
            </span>
            <span className="text-lg text-primary font-bold">{formatCurrency(totalAVencer)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(vencimentoBuckets)
                .sort(([a], [b]) => {
                  const numA = parseInt(a.replace('v', ''));
                  const numB = parseInt(b.replace('v', ''));
                  return numA - numB;
                })
                .map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="text-sm">{VENCIMENTO_MAP[key] || key}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(val)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {totalAVencer > 0 ? ((val / totalAVencer) * 100).toFixed(2) : '0'}%
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totalAVencer)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalhamento por Categoria */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {Object.entries(opsByCategory).map(([cat, { total }]) => (
            <div key={cat} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm font-medium">{cat}</span>
              <span className="text-sm font-mono font-semibold">{formatCurrency(total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Detalhamento de Operações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhamento das Operações - {formatDtb(latestDtb.dtb)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Cambial</TableHead>
                <TableHead>Vencimentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latestDtb.lsOp.map((op, i) => {
                const total = calcTotalVenc(op.resVenc);
                const isCambial = op.varCamb !== '790';
                return (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      <div>
                        <p className="font-medium">{getModalidadeLabel(op.mod)}</p>
                        <p className="text-xs text-muted-foreground">
                          {SEGMENTO_MAP[op.segmento] || `Seg. ${op.segmento}`}
                          {' · '}
                          {ORI_REC_MAP[op.oriRec] || op.oriRec}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant={isCambial ? 'default' : 'secondary'} className="text-xs">
                        {isCambial ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-0.5">
                        {Object.entries(op.resVenc)
                          .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')))
                          .map(([key, val]) => (
                            <div key={key} className="flex justify-between gap-4 text-xs">
                              <span className="text-muted-foreground">{VENCIMENTO_MAP[key] || key}</span>
                              <span className="font-mono whitespace-nowrap">{formatCurrency(val)}</span>
                            </div>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Histórico Mensal */}
      {response.lsDtb.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Histórico Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Instituições</TableHead>
                  <TableHead className="text-right">Doc. Proc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.lsDtb.map((dtb) => (
                  <TableRow key={dtb.dtb}>
                    <TableCell className="font-medium">{formatDtb(dtb.dtb)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(calcTotalAVencer(dtb))}</TableCell>
                    <TableCell className="text-right">{dtb.qtdIfs}</TableCell>
                    <TableCell className="text-right">{dtb.docProc}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
