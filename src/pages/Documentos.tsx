import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Eye, FileText, Link2, Loader2, RefreshCw, Send, Share2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { listarSolicitacoes, type SolicitacaoResumo } from '@/lib/assinatura-api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  visualizado: { label: 'Visualizado', variant: 'secondary' },
  assinado: { label: 'Assinado', variant: 'default' },
  expirado: { label: 'Expirado', variant: 'destructive' },
};

const PAPEL_LABELS: Record<string, string> = {
  cedente: 'Cedente',
  cessionaria_gold_credit: 'Cessionária',
  responsavel_solidario: 'Resp. Solidário',
};

interface OperacaoGroup {
  documento_id: string;
  titulo: string;
  nome_arquivo: string;
  criado_em: string;
  signatarios: SolicitacaoResumo[];
}

function groupByOperacao(items: SolicitacaoResumo[]): OperacaoGroup[] {
  const map = new Map<string, OperacaoGroup>();

  for (const item of items) {
    const key = item.documento_id;
    if (!map.has(key)) {
      map.set(key, {
        documento_id: key,
        titulo: item.titulo,
        nome_arquivo: item.nome_arquivo,
        criado_em: item.criado_em,
        signatarios: [],
      });
    }
    map.get(key)!.signatarios.push(item);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  );
}

function getOperacaoStatus(signatarios: SolicitacaoResumo[]): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const allAssinado = signatarios.every((s) => s.status === 'assinado');
  if (allAssinado) return { label: 'Concluído', variant: 'default' };

  const anyExpirado = signatarios.some((s) => s.status === 'expirado');
  if (anyExpirado) return { label: 'Expirado', variant: 'destructive' };

  const assinados = signatarios.filter((s) => s.status === 'assinado').length;
  if (assinados > 0) return { label: `${assinados}/${signatarios.length} assinado(s)`, variant: 'secondary' };

  return { label: 'Pendente', variant: 'outline' };
}

export default function Documentos() {
  const [items, setItems] = useState<SolicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarSolicitacoes(100);
      setItems(data);
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar documentos',
        description: e.message || 'Não foi possível listar as solicitações.',
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const operacoes = useMemo(() => groupByOperacao(items), [items]);

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/assinar/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado com sucesso.' });
    } catch {
      toast({ title: 'Não foi possível copiar o link.', variant: 'destructive' });
    }
  };

  const toggleExpand = (docId: string) => {
    setExpandedOps((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const stats = {
    total: operacoes.length,
    pendentes: operacoes.filter((op) => {
      const s = getOperacaoStatus(op.signatarios);
      return s.variant === 'outline' || s.variant === 'secondary';
    }).length,
    concluidos: operacoes.filter((op) => getOperacaoStatus(op.signatarios).variant === 'default').length,
    expirados: operacoes.filter((op) => getOperacaoStatus(op.signatarios).variant === 'destructive').length,
  };

  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de operações de assinatura agrupadas por documento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/contratos/assinatura-digital">
            <Button className="gap-2">
              <Send className="h-4 w-4" />
              Novo documento
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard title="Operações" value={stats.total} icon={<FileText className="h-5 w-5 text-primary" />} />
        <StatsCard title="Pendentes" value={stats.pendentes} icon={<Clock className="h-5 w-5 text-amber-600" />} />
        <StatsCard title="Concluídos" value={stats.concluidos} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        <StatsCard title="Expirados" value={stats.expirados} icon={<AlertCircle className="h-5 w-5 text-destructive" />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando operações...</span>
        </div>
      ) : operacoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma operação encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {operacoes.map((op) => {
            const opStatus = getOperacaoStatus(op.signatarios);
            const isExpanded = expandedOps.has(op.documento_id);
            const cedenteItem = op.signatarios.find((s) => s.papel_assinatura === 'cedente');
            const nomeOperacao = cedenteItem?.signatario_nome || op.signatarios[0]?.signatario_nome || 'Sem nome';

            return (
              <Collapsible
                key={op.documento_id}
                open={isExpanded}
                onOpenChange={() => toggleExpand(op.documento_id)}
              >
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">{nomeOperacao}</p>
                            <Badge variant={opStatus.variant}>{opStatus.label}</Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{op.titulo}</span>
                            <span>•</span>
                            <span>{op.nome_arquivo}</span>
                            <span>•</span>
                            <span>{new Date(op.criado_em).toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span>{op.signatarios.length} signatário(s)</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="border-t p-0">
                      <div className="divide-y">
                        {op.signatarios.map((item) => {
                          const status = STATUS_LABELS[item.status] || STATUS_LABELS.pendente;
                          const papel = item.papel_assinatura ? PAPEL_LABELS[item.papel_assinatura] || item.papel_assinatura : '—';

                          return (
                            <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {item.signatario_nome || 'Não informado'}
                                  </p>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {papel}
                                  </Badge>
                                  <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                                    {status.label}
                                  </Badge>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{item.signatario_email}</span>
                                  {item.assinatura_obrigatoria_cpf_cnpj && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono">{item.assinatura_obrigatoria_cpf_cnpj}</span>
                                    </>
                                  )}
                                  {item.assinado_em && (
                                    <>
                                      <span>•</span>
                                      <span>Assinado em {new Date(item.assinado_em).toLocaleString('pt-BR')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Copiar link"
                                  onClick={(e) => { e.stopPropagation(); handleCopyLink(item.token_acesso); }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalhes" asChild>
                                  <Link to={`/contratos/documentos/${item.token_acesso}`}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                                {item.link_assinatura && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir link público" asChild>
                                    <a href={item.link_assinatura} target="_blank" rel="noopener noreferrer">
                                      <Share2 className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                )}
                                {item.link_assinatura && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Copiar URL completa"
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.link_assinatura || ''); }}
                                  >
                                    <Link2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-muted p-2">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
