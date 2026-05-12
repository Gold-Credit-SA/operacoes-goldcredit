import { useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SCRResponse } from './scr/scr-types';
import { SCRHeader } from './scr/SCRHeader';
import { SCRCreditosCharts, SCRCarteiraAtivaTable } from './scr/SCRCarteiraAtiva';
import { SCRLimitesCredito } from './scr/SCRLimitesCredito';
import { SCRDetalhamento } from './scr/SCRDetalhamento';
import { SCRHistorico } from './scr/SCRHistorico';
import { SCRPdfExport } from './scr/SCRPdfExport';

interface SCRDetailViewProps {
  data: Record<string, unknown>;
}

export function SCRDetailView({ data }: SCRDetailViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

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

  const validDtbEntries = response.lsDtb.filter(entry => Array.isArray(entry?.lsOp) && entry.lsOp.length > 0);

  // Se nenhuma data-base tem operações, mostra mensagem informativa em vez de quebrar
  if (validDtbEntries.length === 0) {
    const messages = response.lsDtb
      .map(e => (e as any)?.msg)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Cliente sem operações no SCR</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Período consultado: <span className="font-mono">{response.dtbConsult || '—'}</span>
        </p>
        {messages.map((m, i) => (
          <p key={i} className="text-sm text-muted-foreground">• {m}</p>
        ))}
      </div>
    );
  }

  const latestDtb = validDtbEntries[validDtbEntries.length - 1];
  const historicoDtb = validDtbEntries;

  const entityName = (data as any)?.data?.name || (data as any)?.name || response.name || '';
  const totalOperacoes = latestDtb?.qtdOps ?? (Array.isArray(latestDtb?.lsOp) ? latestDtb.lsOp.length : 0);
  const riskClassification =
    response.classificacao ||
    (data as any)?.data?.riskClassification ||
    (data as any)?.riskClassification;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SCRPdfExport contentRef={contentRef} cdCli={response.cdCli} />
      </div>
      <div ref={contentRef} className="space-y-6">
        <SCRHeader
          cdCli={response.cdCli}
          dtbConsult={response.dtbConsult}
          entityName={entityName}
          latestDtb={latestDtb}
          totalOperacoes={totalOperacoes}
          riskClassification={riskClassification}
        />
        <SCRCreditosCharts latestDtb={latestDtb} />
        <SCRCarteiraAtivaTable latestDtb={latestDtb} />
        <SCRLimitesCredito latestDtb={latestDtb} />
        <SCRDetalhamento latestDtb={latestDtb} />
        <SCRHistorico lsDtb={historicoDtb} />
      </div>
    </div>
  );
}
