import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Brain, Search, Filter, ArrowRight, Loader2, MessageSquareQuote, Sparkles, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface SessionRow {
  id: string;
  client_cpf_cnpj: string;
  client_name: string | null;
  cedente_cpf_cnpj: string | null;
  cedente_nome: string | null;
  sacados: any;
  initial_analysis: any;
  created_at: string;
  updated_at: string;
}

interface FeedbackRow {
  id: string;
  session_id: string;
  decisao_final: string;
  finalidade: string | null;
  resultado_real: string | null;
  created_by_name: string | null;
  updated_at: string;
}

const DECISION_LABEL: Record<string, { label: string; cls: string }> = {
  APROVADO: { label: '✅ Aprovado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  APROVADO_COM_RESSALVAS: { label: '⚠️ Com ressalvas', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  REPROVADO: { label: '❌ Reprovado', cls: 'bg-red-50 text-red-700 border-red-200' },
  PENDENTE: { label: '⏳ Pendente', cls: 'bg-muted text-muted-foreground' },
};

const IA_DECISION_LABEL: Record<string, { label: string; cls: string }> = {
  APROVAR: { label: 'IA: Aprovar', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  APROVAR_COM_RESSALVAS: { label: 'IA: Ressalvas', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  REPROVAR: { label: 'IA: Reprovar', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export default function HistoricoAnaliseCredito() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackRow>>({});
  const [deleteTarget, setDeleteTarget] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchCedente, setSearchCedente] = useState('');
  const [searchSacado, setSearchSacado] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<string>('todas');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sessRes, fbRes] = await Promise.all([
        supabase
          .from('credit_analysis_sessions')
          .select('id, client_cpf_cnpj, client_name, cedente_cpf_cnpj, cedente_nome, sacados, initial_analysis, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('credit_analysis_feedback')
          .select('id, session_id, decisao_final, finalidade, resultado_real, created_by_name, updated_at')
          .order('updated_at', { ascending: false }),
      ]);

      if (sessRes.data) setSessions(sessRes.data as SessionRow[]);
      if (fbRes.data) {
        const map: Record<string, FeedbackRow> = {};
        for (const f of fbRes.data as FeedbackRow[]) {
          // Most recent (already ordered)
          if (!map[f.session_id]) map[f.session_id] = f;
        }
        setFeedbacks(map);
      }
      setLoading(false);
    })();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('credit_analysis_messages').delete().eq('session_id', deleteTarget.id);
      await supabase.from('credit_analysis_feedback').delete().eq('session_id', deleteTarget.id);
      const { error } = await supabase.from('credit_analysis_sessions').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
      setFeedbacks(prev => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      toast({ title: 'Análise excluída', description: 'A análise foi removida do histórico.' });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({
        title: 'Erro ao excluir',
        description: e?.message || 'Não foi possível excluir esta análise.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const cQ = searchCedente.trim().toLowerCase();
    const sQ = searchSacado.trim().toLowerCase();

    return sessions.filter(s => {
      // Cedente filter
      if (cQ) {
        const matchCed = (s.cedente_nome || '').toLowerCase().includes(cQ)
          || (s.cedente_cpf_cnpj || '').toLowerCase().includes(cQ);
        if (!matchCed) return false;
      }

      // Sacado filter (search across all sacados)
      if (sQ) {
        const sacList: any[] = Array.isArray(s.sacados) ? s.sacados : [];
        const allSacados = [
          ...sacList.map((x: any) => `${x?.name || ''} ${x?.cpf_cnpj || ''}`),
          `${s.client_name || ''} ${s.client_cpf_cnpj || ''}`,
        ].join(' ').toLowerCase();
        if (!allSacados.includes(sQ)) return false;
      }

      // Decision filter
      if (decisionFilter !== 'todas') {
        if (decisionFilter === 'sem_parecer') {
          if (feedbacks[s.id]) return false;
        } else {
          const fb = feedbacks[s.id];
          if (!fb || fb.decisao_final !== decisionFilter) return false;
        }
      }

      return true;
    });
  }, [sessions, feedbacks, searchCedente, searchSacado, decisionFilter]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const comParecer = Object.keys(feedbacks).length;
    const aprovadas = Object.values(feedbacks).filter(f => f.decisao_final === 'APROVADO').length;
    const reprovadas = Object.values(feedbacks).filter(f => f.decisao_final === 'REPROVADO').length;
    return { total, comParecer, aprovadas, reprovadas };
  }, [sessions, feedbacks]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Análises de Crédito</h1>
              <p className="text-sm text-muted-foreground">Todas as análises realizadas pela IA e pareceres dos gestores.</p>
            </div>
          </div>
          <Link to="/analise-credito/novo">
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" /> Nova Análise
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Com parecer</p>
            <p className="text-2xl font-bold mt-1">{stats.comParecer}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Aprovadas</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.aprovadas}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Reprovadas</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{stats.reprovadas}</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cedente (nome ou CNPJ)"
                value={searchCedente}
                onChange={e => setSearchCedente(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sacado (nome ou CPF/CNPJ)"
                value={searchSacado}
                onChange={e => setSearchSacado(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={decisionFilter} onValueChange={setDecisionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as decisões</SelectItem>
                <SelectItem value="APROVADO">✅ Aprovado</SelectItem>
                <SelectItem value="APROVADO_COM_RESSALVAS">⚠️ Aprovado com ressalvas</SelectItem>
                <SelectItem value="REPROVADO">❌ Reprovado</SelectItem>
                <SelectItem value="PENDENTE">⏳ Pendente</SelectItem>
                <SelectItem value="sem_parecer">Sem parecer do gestor</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma análise encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cedente</TableHead>
                      <TableHead>Sacado(s)</TableHead>
                      <TableHead>IA</TableHead>
                      <TableHead>Parecer Gestor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(s => {
                      const fb = feedbacks[s.id];
                      const ia = s.initial_analysis as any;
                      const iaDec = ia?.decisao;
                      const sacList: any[] = Array.isArray(s.sacados) ? s.sacados : [];
                      const sacadoLabel = sacList.length > 1
                        ? `${sacList.length} sacados`
                        : (sacList[0]?.name || s.client_name || s.client_cpf_cnpj || '—');

                      return (
                        <TableRow key={s.id} className="hover:bg-muted/40">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            <br />
                            <span className="text-[10px]">{format(new Date(s.created_at), 'HH:mm')}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <p className="font-medium truncate max-w-[200px]">{s.cedente_nome || '—'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.cedente_cpf_cnpj || ''}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            <p className="truncate max-w-[200px]">{sacadoLabel}</p>
                            {sacList.length === 1 && sacList[0]?.cpf_cnpj && (
                              <p className="text-xs text-muted-foreground font-mono">{sacList[0].cpf_cnpj}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {iaDec && IA_DECISION_LABEL[iaDec] ? (
                              <Badge variant="outline" className={IA_DECISION_LABEL[iaDec].cls}>
                                {IA_DECISION_LABEL[iaDec].label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fb ? (
                              <div className="space-y-1">
                                <Badge variant="outline" className={DECISION_LABEL[fb.decisao_final]?.cls}>
                                  {DECISION_LABEL[fb.decisao_final]?.label || fb.decisao_final}
                                </Badge>
                                {fb.finalidade && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                    {fb.finalidade}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <MessageSquareQuote className="h-3 w-3" /> Sem parecer
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link to={`/analise-credito/${s.id}`}>
                                <Button variant="ghost" size="sm" className="gap-1.5">
                                  Abrir <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(s)}
                                aria-label="Excluir análise"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
