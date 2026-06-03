import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PROSPECT_KEYWORDS = [
  'Títulos descontados',
  'Direitos creditórios descontados',
  'Desconto de duplicatas',
];

interface HistoryEntry {
  id: string;
  platform: string;
  consulta_type?: string;
  consulta_label?: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  client: {
    id: string;
    cpf_cnpj: string;
    name: string | null;
    basic_data: Record<string, unknown> | null;
  };
  history: HistoryEntry[];
}

interface SendRecord {
  sent_at: string;
  sent_by_name: string | null;
}

// Para cada plataforma, mantém apenas a consulta mais recente por consulta_type.
function pickLatestPerType(entries: HistoryEntry[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>();
  for (const e of entries) {
    const key = `${e.platform}::${e.consulta_type ?? ''}`;
    const cur = map.get(key);
    if (!cur || +new Date(e.created_at) > +new Date(cur.created_at)) {
      map.set(key, e);
    }
  }
  return Array.from(map.values());
}

export function ClienteProspectCRMButton({ client, history }: Props) {
  const [sending, setSending] = useState(false);
  const [sentRecord, setSentRecord] = useState<SendRecord | null>(null);
  const [checked, setChecked] = useState(false);

  const latestScr = useMemo(() => {
    const scrEntries = history
      .filter((h) => h.platform === 'scr' || h.platform === 'hbi')
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return scrEntries[0] || null;
  }, [history]);

  const matchedKeywords = useMemo(() => {
    if (!latestScr?.result_data) return [];
    try {
      const haystack = JSON.stringify(latestScr.result_data);
      return PROSPECT_KEYWORDS.filter((kw) => haystack.includes(kw));
    } catch {
      return [];
    }
  }, [latestScr]);

  const isProspect = matchedKeywords.length > 0;

  useEffect(() => {
    if (!isProspect) {
      setChecked(true);
      return;
    }
    supabase
      .from('crm_prospect_sends')
      .select('sent_at, sent_by_name')
      .eq('cnpj', client.cpf_cnpj)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSentRecord(data as SendRecord);
        setChecked(true);
      });
  }, [client.cpf_cnpj, isProspect]);

  if (!isProspect || !checked) return null;

  const handleSend = async () => {
    setSending(true);
    try {
      // Inclui as consultas mais recentes de cada plataforma/tipo disponível
      const latestPerType = pickLatestPerType(history);
      const consultas = latestPerType.map((h) => ({
        platform: h.platform,
        consulta_type: h.consulta_type,
        consulta_label: h.consulta_label,
        created_at: h.created_at,
        data: h.result_data,
      }));

      const { data: result, error } = await supabase.functions.invoke('crm-send-prospect', {
        body: {
          empresa: client.name || client.cpf_cnpj,
          cnpj: client.cpf_cnpj,
          dadosEmpresa: client.basic_data ?? null,
          consultaScr: latestScr?.result_data ?? null,
          consultas,
          palavrasChaveDetectadas: matchedKeywords,
          origem: 'operacional',
          scrHistoryId: latestScr?.id,
        },
      });
      if (error) throw error;
      const r = result as any;
      if (r?.alreadySent) {
        setSentRecord({ sent_at: r.sentAt, sent_by_name: r.sentBy });
        toast.info('Este prospect já foi enviado anteriormente.');
        return;
      }
      if (r?.error) throw new Error(r.error);
      setSentRecord({ sent_at: new Date().toISOString(), sent_by_name: null });
      toast.success('Prospect enviado ao CRM com sucesso');
    } catch (err: any) {
      toast.error('Falha ao enviar prospect ao CRM', {
        description: err?.message ?? 'Erro desconhecido',
      });
    } finally {
      setSending(false);
    }
  };

  if (sentRecord) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="default" disabled className="gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Prospect já enviado
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Enviado em{' '}
              {format(new Date(sentRecord.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {sentRecord.sent_by_name ? ` por ${sentRecord.sent_by_name}` : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button onClick={handleSend} disabled={sending} variant="default" className="gap-2">
      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {sending ? 'Enviando...' : 'Enviar como Prospect'}
    </Button>
  );
}
