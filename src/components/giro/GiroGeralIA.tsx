import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, ArrowRight, RefreshCw, Sparkles, TrendingUp, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { formatDateBR } from '@/lib/utils';

interface CedenteBehavior {
  cpf_cnpj: string;
  nome: string;
  setor?: string;
  cidade?: string;
  uf?: string;
  bloqueado?: string;
  limite_global: number;
  limite_disponivel: number;
  risco_atual: number;
  ultima_operacao: string | null;
  dias_inativo: number | null;
  total_ops_180d: number;
  intervalo_medio_dias: number;
  dia_medio_mes: number;
  semana_mes_top: number;
  quitados_30d_qtd: number;
  quitados_30d_valor: number;
  quitados_60d_qtd: number;
  quitados_60d_valor: number;
  score_giro: number;
  recomendacao: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO';
  motivo: string;
  sinais: string[];
}

const recBadgeVariant = (r: string) =>
  r === 'ALTA' ? 'default' : r === 'MEDIA' ? 'secondary' : r === 'NAO' ? 'destructive' : 'outline';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatCpfCnpj = (value: string | undefined) => {
  if (!value) return '-';
  const c = value.replace(/\D/g, '');
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
};

export function GiroGeralIA() {
  const [cedentes, setCedentes] = useState<CedenteBehavior[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRec, setFilterRec] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [aiTarget, setAiTarget] = useState<CedenteBehavior | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('giro-carteira', {
        body: { action: 'behavior-all' },
      });
      if (error) throw error;
      if (data?.success) {
        setCedentes(data.cedentes);
        toast({ title: 'Análise concluída', description: `${data.cedentes.length} cedentes avaliados` });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao carregar análise', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    let r = cedentes;
    if (filterRec !== 'all') r = r.filter(c => c.recomendacao === filterRec);
    if (search.trim()) {
      const t = search.toLowerCase();
      r = r.filter(c => c.nome?.toLowerCase().includes(t) || c.cpf_cnpj.includes(t));
    }
    return r;
  }, [cedentes, search, filterRec]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  const counts = useMemo(() => ({
    alta: cedentes.filter(c => c.recomendacao === 'ALTA').length,
    media: cedentes.filter(c => c.recomendacao === 'MEDIA').length,
    baixa: cedentes.filter(c => c.recomendacao === 'BAIXA').length,
  }), [cedentes]);

  const openAi = async (c: CedenteBehavior) => {
    setAiTarget(c);
    setAiText('');
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('giro-carteira', {
        body: { action: 'ai-narrative', cedentes: [c] },
      });
      if (error) throw error;
      if (data?.error) setAiText(`Erro IA: ${data.error}`);
      else setAiText(data?.narrativa || 'Sem resposta');
    } catch (e) {
      setAiText('Falha ao gerar análise IA.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header / stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{cedentes.length}</p>
        </CardContent></Card>
        <Card className="border-emerald-500/40"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recomendação ALTA</p>
          <p className="text-2xl font-bold text-emerald-600">{counts.alta}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recomendação MÉDIA</p>
          <p className="text-2xl font-bold">{counts.media}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recomendação BAIXA</p>
          <p className="text-2xl font-bold text-muted-foreground">{counts.baixa}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={filterRec} onValueChange={(v) => { setFilterRec(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas recomendações</SelectItem>
            <SelectItem value="ALTA">ALTA</SelectItem>
            <SelectItem value="MEDIA">MÉDIA</SelectItem>
            <SelectItem value="BAIXA">BAIXA</SelectItem>
            <SelectItem value="NAO">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Oportunidades de Giro ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cedente</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Recomendação</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-center">Última op.</TableHead>
                    <TableHead className="text-center">Padrão</TableHead>
                    <TableHead className="text-center">Liquidados 30d</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum cedente</TableCell></TableRow>
                  ) : paginated.map(c => (
                    <TableRow key={c.cpf_cnpj}>
                      <TableCell>
                        <p className="font-medium truncate max-w-[200px]">{c.nome || '-'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(c.cpf_cnpj)}</p>
                      </TableCell>
                      <TableCell className="text-center font-bold">{c.score_giro}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={recBadgeVariant(c.recomendacao) as any}>{c.recomendacao}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium text-sm ${(c.limite_disponivel || 0) <= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        {formatCurrency(c.limite_disponivel)}
                        <div className="text-[10px] text-muted-foreground font-normal">de {formatCurrency(c.limite_global)}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c.ultima_operacao ? (
                          <>
                            <div>{formatDateBR(c.ultima_operacao, '-')}</div>
                            {c.dias_inativo !== null && (
                              <div className="text-xs text-muted-foreground">{c.dias_inativo}d atrás</div>
                            )}
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {c.total_ops_180d > 0 ? (
                          <>
                            <div>{c.intervalo_medio_dias}d entre ops.</div>
                            <div className="text-muted-foreground">{c.semana_mes_top}ª sem · dia ~{c.dia_medio_mes}</div>
                          </>
                        ) : <span className="text-muted-foreground">sem hist.</span>}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c.quitados_30d_qtd > 0 ? (
                          <>
                            <div className="font-medium text-emerald-600">{c.quitados_30d_qtd}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(c.quitados_30d_valor)}</div>
                          </>
                        ) : c.quitados_60d_qtd > 0 ? (
                          <span className="text-xs text-muted-foreground">{c.quitados_60d_qtd} em 60d</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[300px] text-xs text-muted-foreground">{c.motivo}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" title="Análise IA" onClick={() => openAi(c)}>
                            <Sparkles className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Abrir consulta" onClick={() => navigate(`/consulta?cpf_cnpj=${c.cpf_cnpj}`)}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Exibindo</span>
                <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 25, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
                <span>de {filtered.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(page - 1)} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm mx-2">Página {page} de {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(page + 1)} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(totalPages)} disabled={page === totalPages}><ChevronsRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aiTarget} onOpenChange={(o) => { if (!o) setAiTarget(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise IA — {aiTarget?.nome}
            </DialogTitle>
            <DialogDescription>{formatCpfCnpj(aiTarget?.cpf_cnpj)}</DialogDescription>
          </DialogHeader>

          {aiTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="font-bold text-lg">{aiTarget.score_giro}</p>
                </div>
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground">Recomendação</p>
                  <Badge variant={recBadgeVariant(aiTarget.recomendacao) as any}>{aiTarget.recomendacao}</Badge>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-medium">Sinais detectados:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  {aiTarget.sinais.length > 0
                    ? aiTarget.sinais.map((s, i) => <li key={i}>{s}</li>)
                    : <li>Sem sinais relevantes.</li>}
                </ul>
              </div>

              <div className="border-l-4 border-primary bg-primary/5 p-3 rounded">
                <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Recomendação IA
                </p>
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise...
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{aiText}</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiTarget(null)}>Fechar</Button>
                <Button onClick={() => { navigate(`/consulta?cpf_cnpj=${aiTarget.cpf_cnpj}`); setAiTarget(null); }}>
                  Abrir consulta <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
