import { DtbEntry } from './scr-types';
import {
  formatCnpj,
  getRaizDocumento,
  formatDate,
  formatCurrency,
  calcRiscoDireto,
  formatPeriodoConsultado,
  formatPercentBR,
} from './scr-utils';

interface SCRHeaderProps {
  cdCli: string;
  dtbConsult: string;
  entityName: string;
  latestDtb: DtbEntry;
  totalOperacoes: number;
  riskClassification?: string;
}

// Cada campo vira um "card" individual com label em destaque e valor abaixo,
// replicando o cabeçalho do PDF oficial da HBI. Ordem e labels seguem o PDF.
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function SCRHeader({
  cdCli,
  dtbConsult,
  entityName,
  latestDtb,
  totalOperacoes,
  riskClassification,
}: SCRHeaderProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold uppercase tracking-wide text-primary">SCR</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="CNPJ" value={formatCnpj(cdCli)} />
        <Field label="Razão social" value={entityName || '—'} />
        <Field label="Data base consultada" value={formatPeriodoConsultado(dtbConsult)} />

        <Field label="Raiz do documento" value={getRaizDocumento(cdCli)} />
        <Field label="Início do relacionamento" value={formatDate(latestDtb.dtbIniRel)} />
        <Field label="Doc. processados" value={formatPercentBR(latestDtb.docProc)} />

        <Field label="Vol. processado" value={formatPercentBR(latestDtb.volProc)} />
        <Field label="Total de instituições" value={latestDtb.qtdIfs} />
        <Field label="Total de operações" value={totalOperacoes} />

        <Field label="Op. em discordância" value={latestDtb.qtdOpsDiscordancia ?? 0} />
        <Field label="Op. sub judice" value={latestDtb.qtdOpsSubJudice ?? 0} />
        <Field label="Risco direto" value={formatCurrency(calcRiscoDireto(latestDtb))} />

        {riskClassification && <Field label="Classificação de risco" value={riskClassification} />}
      </div>
    </section>
  );
}
