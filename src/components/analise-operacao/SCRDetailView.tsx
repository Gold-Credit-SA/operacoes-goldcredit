import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Send, Loader2 } from 'lucide-react';
import { SCRResponse } from './scr/scr-types';
import { SCRHeader } from './scr/SCRHeader';
import { SCRCreditosCharts, SCRCarteiraAtivaTable } from './scr/SCRCarteiraAtiva';
import { SCRDetalhamento } from './scr/SCRDetalhamento';
import { SCRHistorico } from './scr/SCRHistorico';
import { SCRPdfExport } from './scr/SCRPdfExport';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SCRDetailViewProps {
  data: Record<string, unknown>;
}

const PROSPECT_KEYWORDS = [
  'Títulos descontados',
  'Direitos creditórios descontados',
  'Desconto de duplicatas',
];

// Códigos Bacen de modalidades de desconto de títulos / recebíveis
const PROSPECT_MOD_CODES = new Set([
  '0203', // Títulos descontados
  '0205', // Aquisição de recebíveis
  '0301', '0302', // Desconto de duplicatas
  '0303', // Desconto de cheques
  '0304', // Antecipação de recebíveis de cartão
  '0305', // Desconto de notas promissórias
  '0306', // Desconto de outros títulos
  '0399', // Outros títulos descontados
  '1301', // Aquisição de recebíveis
  '1303', // Antecipação de recebíveis comerciais
]);

export function SCRDetailView({ data }: SCRDetailViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  const response = useMemo<SCRResponse | null>(() => {
    const resp = (data as any)?.response || (data as any)?.data?.response || data;
    if (resp?.lsDtb) return resp as SCRResponse;
    if ((data as any)?.data?.lsDtb) return (data as any).data as SCRResponse;
    return null;
  }, [data]);

  const isProspect = useMemo(() => {
    // 1) busca textual (caso o relatório já venha com rótulos)
    try {
      const haystack = JSON.stringify(data ?? '');
      if (PROSPECT_KEYWORDS.some((kw) => haystack.includes(kw))) return true;
    } catch {}
    // 2) varre códigos de modalidade nas operações do SCR
    if (response?.lsDtb?.length) {
      for (const dtb of response.lsDtb) {
        const ops = Array.isArray((dtb as any)?.lsOp) ? (dtb as any).lsOp : [];
        for (const op of ops) {
          const mod = String((op as any)?.mod ?? '').trim();
          if (PROSPECT_MOD_CODES.has(mod)) return true;
        }
      }
    }
    return false;
  }, [data, response]);

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

  const handleSendProspect = async () => {
    setSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('crm-send-prospect', {
        body: {
          empresa: entityName || response.cdCli,
          cnpj: response.cdCli,
          dadosEmpresa: (data as any)?.data ?? data,
          consultaScr: response,
        },
      });
      if (error) throw error;
      if ((result as any)?.error) throw new Error((result as any).error);
      toast.success('Prospect enviado ao CRM com sucesso.');
    } catch (err: any) {
      toast.error('Falha ao enviar prospect', { description: err.message ?? 'Erro desconhecido' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {isProspect && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Possível prospect identificado
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
              Detectamos operações de <strong>desconto de títulos / direitos creditórios / duplicatas</strong> neste SCR. Considere enviar este cliente como prospect ao CRM.
            </p>
          </div>
          <Button onClick={handleSendProspect} disabled={sending} variant="default" size="sm">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar ao CRM
          </Button>
        </div>
      )}
      <div className="flex justify-end gap-2 flex-wrap">
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
        <SCRDetalhamento latestDtb={latestDtb} />
        <SCRHistorico lsDtb={historicoDtb} />
      </div>
    </div>
  );
}
