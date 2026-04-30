import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, ClipboardList, Loader2, MessageSquareQuote, PenLine, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ManagerFeedbackCardProps {
  sessionId: string;
  iaAnalysis: any;
  cedenteCpfCnpj: string | null;
  cedenteNome: string | null;
  sacados: Array<{ cpf_cnpj: string; name: string | null }>;
}

interface FeedbackRow {
  id: string;
  session_id: string;
  decisao_final: string;
  finalidade: string | null;
  parecer_gestor: string;
  observacoes: string | null;
  resultado_real: string | null;
  resultado_observacao: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const DECISION_OPTIONS = [
  { value: 'APROVADO', label: '✅ Aprovado' },
  { value: 'APROVADO_COM_RESSALVAS', label: '⚠️ Aprovado com ressalvas' },
  { value: 'REPROVADO', label: '❌ Reprovado' },
  { value: 'PENDENTE', label: '⏳ Pendente / Em análise' },
];

const RESULT_OPTIONS = [
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'PAGO', label: 'Pago no prazo' },
  { value: 'PAGO_COM_ATRASO', label: 'Pago com atraso' },
  { value: 'INADIMPLENTE', label: 'Inadimplente' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

const decisionBadge = (d: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    APROVADO: { label: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    APROVADO_COM_RESSALVAS: { label: 'Com ressalvas', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    REPROVADO: { label: 'Reprovado', cls: 'bg-red-50 text-red-700 border-red-200' },
    PENDENTE: { label: 'Pendente', cls: 'bg-muted text-muted-foreground' },
  };
  return map[d] || { label: d, cls: 'bg-muted' };
};

export function ManagerFeedbackCard({
  sessionId, iaAnalysis, cedenteCpfCnpj, cedenteNome, sacados,
}: ManagerFeedbackCardProps) {
  const { user, profile } = useAuth() as any;

  const [existing, setExisting] = useState<FeedbackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [decisaoFinal, setDecisaoFinal] = useState<string>('');
  const [finalidade, setFinalidade] = useState('');
  const [parecer, setParecer] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [resultadoReal, setResultadoReal] = useState<string>('');
  const [resultadoObs, setResultadoObs] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('credit_analysis_feedback')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setExisting(data as FeedbackRow);
      setDecisaoFinal(data.decisao_final);
      setFinalidade(data.finalidade || '');
      setParecer(data.parecer_gestor);
      setObservacoes(data.observacoes || '');
      setResultadoReal(data.resultado_real || '');
      setResultadoObs(data.resultado_observacao || '');
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  const handleSave = async () => {
    if (!user) return;
    if (!decisaoFinal) {
      toast.error('Selecione a decisão final.');
      return;
    }
    if (!parecer.trim() || parecer.trim().length < 10) {
      toast.error('Descreva o parecer com pelo menos 10 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        session_id: sessionId,
        cedente_cpf_cnpj: cedenteCpfCnpj,
        cedente_nome: cedenteNome,
        sacados: sacados as any,
        ia_decisao: iaAnalysis?.decisao || null,
        ia_risco: iaAnalysis?.riscoGeral || null,
        ia_parecer: iaAnalysis?.parecer || null,
        decisao_final: decisaoFinal,
        finalidade: finalidade.trim() || null,
        parecer_gestor: parecer.trim(),
        observacoes: observacoes.trim() || null,
        resultado_real: resultadoReal || null,
        resultado_observacao: resultadoObs.trim() || null,
        created_by: user.id,
        created_by_name: profile?.name || user.email || null,
      };

      if (existing) {
        const { error } = await supabase
          .from('credit_analysis_feedback')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Feedback atualizado.');
      } else {
        const { error } = await supabase
          .from('credit_analysis_feedback')
          .insert(payload);
        if (error) throw error;
        toast.success('Feedback registrado. A IA usará este caso para aprender.');
      }
      setEditing(false);
      await loadFeedback();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ─── View mode (já existe e não está editando) ───
  if (existing && !editing) {
    const dec = decisionBadge(existing.decisao_final);
    const res = existing.resultado_real ? RESULT_OPTIONS.find(o => o.value === existing.resultado_real)?.label : null;
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-primary" />
              Parecer do Gestor
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" /> Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={dec.cls}>{dec.label}</Badge>
            {res && <Badge variant="outline" className="bg-muted/50">Resultado: {res}</Badge>}
            <span className="text-xs text-muted-foreground ml-auto">
              {existing.created_by_name || 'Gestor'} · {format(new Date(existing.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          {existing.finalidade && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Finalidade</p>
              <p className="text-sm">{existing.finalidade}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Parecer</p>
            <p className="text-sm whitespace-pre-wrap">{existing.parecer_gestor}</p>
          </div>

          {existing.observacoes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{existing.observacoes}</p>
            </div>
          )}

          {existing.resultado_observacao && (
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Acompanhamento</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{existing.resultado_observacao}</p>
            </div>
          )}

          <div className="pt-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Este parecer faz parte do histórico de aprendizado da IA.
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Edit/Create mode ───
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          {existing ? 'Editar Parecer do Gestor' : 'Registrar Parecer do Gestor'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Seu parecer será salvo no histórico e usado pela IA para aprender com casos passados.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Decisão final *</Label>
            <Select value={decisaoFinal} onValueChange={setDecisaoFinal}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {DECISION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Finalidade da operação</Label>
            <Input
              placeholder="Ex: Capital de giro, antecipação safra…"
              value={finalidade}
              onChange={e => setFinalidade(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Parecer do gestor *</Label>
          <Textarea
            placeholder="Descreva o racional da decisão: o que pesou, o que mitigou risco, o que ainda preocupa…"
            value={parecer}
            onChange={e => setParecer(e.target.value)}
            rows={4}
            maxLength={3000}
          />
          <p className="text-[10px] text-muted-foreground text-right">{parecer.length}/3000</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações adicionais (opcional)</Label>
          <Textarea
            placeholder="Detalhes complementares, condicionantes, garantias adicionais…"
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            maxLength={2000}
          />
        </div>

        <div className="pt-3 border-t border-border/60 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Acompanhamento (preencha quando souber o desfecho)
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Resultado real</Label>
              <Select value={resultadoReal} onValueChange={setResultadoReal}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {RESULT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notas sobre o desfecho</Label>
            <Textarea
              placeholder="Ex: Pago em D+5 com renegociação, atraso de 12 dias…"
              value={resultadoObs}
              onChange={e => setResultadoObs(e.target.value)}
              rows={2}
              maxLength={1500}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          {existing && (
            <Button variant="ghost" onClick={() => { setEditing(false); loadFeedback(); }} disabled={saving}>
              Cancelar
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {existing ? 'Salvar alterações' : 'Registrar parecer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
