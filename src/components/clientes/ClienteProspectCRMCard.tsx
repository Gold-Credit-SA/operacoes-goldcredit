import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

export function ClienteProspectCRMCard({ client, history }: Props) {
  const [sending, setSending] = useState(false);
  const [sentRecord, setSentRecord] = useState<SendRecord | null>(null);
  const [checked, setChecked] = useState(false);

  // Última consulta SCR do cliente
  const latestScr = useMemo(() => {
    const scrEntries = history
      .filter((h) => h.platform === 'scr' || h.platform === 'hbi')
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return scrEntries[0] || null;
  }, [history]);

  // Detecta palavras-chave de prospect na consulta SCR mais recente
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
      const { data: result, error } = await supabase.functions.invoke('crm-send-prospect', {
        body: {
          empresa: client.name || client.cpf_cnpj,
          cnpj: client.cpf_cnpj,
          dadosEmpresa: client.basic_data ?? null,
          consultaScr: latestScr?.result_data ?? null,
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

  return (
    <Card className="border-primary/40 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Possível Cedente Detectado
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              SCR indica antecipação de recebíveis com bancos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {matchedKeywords.map((kw) => (
            <Badge key={kw} variant="outline" className="text-[10px] border-primary/30 text-primary">
              {kw}
            </Badge>
          ))}
        </div>

        {sentRecord ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Já enviado ao CRM</p>
              <p className="text-[11px] opacity-80">
                {format(new Date(sentRecord.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {sentRecord.sent_by_name ? ` · ${sentRecord.sent_by_name}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleSend}
            disabled={sending}
            className="w-full gap-2"
            size="sm"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Enviando...' : 'Enviar como Prospect para CRM'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
