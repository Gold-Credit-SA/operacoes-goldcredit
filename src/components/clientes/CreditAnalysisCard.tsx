import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Building2, CreditCard, Shield, History, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
}

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  agrisk_client_id: string | null;
  basic_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AnalysisSession {
  id: string;
  cedente_nome: string | null;
  created_at: string;
}

interface Props {
  client: ClientRecord;
  history: HistoryEntry[];
}

function latestByPlatform(entries: HistoryEntry[], platform: string) {
  return entries
    .filter((e) => e.platform === platform)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] || null;
}

export function CreditAnalysisCard({ client, history }: Props) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);

  const clientConsultations = useMemo(() => {
    const latestSmart = latestByPlatform(history, 'smart');
    const latestSerasa = latestByPlatform(history, 'serasa');
    const latestScr = latestByPlatform(history, 'scr');
    return {
      smart: !!latestSmart,
      serasa: !!latestSerasa,
      scr: !!latestScr,
    };
  }, [history]);

  useEffect(() => {
    supabase
      .from('credit_analysis_sessions')
      .select('id, cedente_nome, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setSessions(data);
      });
  }, [client.id]);

  const handleStartAnalysis = () => {
    const params = new URLSearchParams({
      clientId: client.id,
      cpfCnpj: client.cpf_cnpj,
      ...(client.name ? { name: client.name } : {}),
    });
    navigate(`/analise-credito/new?${params.toString()}`);
  };

  return (
    <Card className="mt-8 border-primary/20 bg-[linear-gradient(180deg,rgba(240,245,255,0.9),rgba(255,255,255,1))]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-primary" />
          Análise de Crédito da Operação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Inicie uma análise completa com IA ou acesse o histórico de análises anteriores.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={`text-xs ${clientConsultations.serasa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
            <Shield className="h-3 w-3 mr-1" />
            Serasa {clientConsultations.serasa ? '✓' : '—'}
          </Badge>
          <Badge variant="outline" className={`text-xs ${clientConsultations.scr ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
            <CreditCard className="h-3 w-3 mr-1" />
            SCR {clientConsultations.scr ? '✓' : '—'}
          </Badge>
          <Badge variant="outline" className={`text-xs ${clientConsultations.smart ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
            <Building2 className="h-3 w-3 mr-1" />
            Smart {clientConsultations.smart ? '✓' : '—'}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleStartAnalysis}
            className="flex-1 gap-2 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-primary-foreground hover:opacity-95 h-11"
          >
            <Brain className="h-4 w-4" /> Nova Análise
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" /> Análises anteriores
            </p>
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/analise-credito/${s.id}`)}
                  className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <span className="font-medium truncate block">
                      {s.cedente_nome || 'Sem cedente'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

