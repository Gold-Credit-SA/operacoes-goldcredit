import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Share2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { listarSolicitacoes, type SolicitacaoResumo } from '@/lib/assinatura-api';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  visualizado: { label: 'Visualizado', variant: 'secondary' },
  assinado: { label: 'Assinado', variant: 'default' },
  expirado: { label: 'Expirado', variant: 'destructive' },
};

interface OperacaoAgrupada {
  documentoId: string;
  titulo: string;
  cedenteNome: string;
  total: number;
  assinados: number;
  pendentes: number;
  expirados: number;
  ultimaAtualizacao?: string;
  solicitacoes: SolicitacaoResumo[];
}

export default function Documentos() {
  const [items, setItems] = useState<SolicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarSolicitacoes(100);
      setItems(data);
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar documentos',
        description: e.message || 'Nao foi possivel listar as solicitacoes.',
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

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/assinar/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado com sucesso.' });
    } catch {
      toast({ title: 'Nao foi possivel copiar o link.', variant: 'destructive' });
    }
  };

  const stats = {
    total: items.length,
    pendentes: items.filter((item) => item.status === 'pendente' || item.status === 'visualizado').length,
    assinados: items.filter((item) => item.status === 'assinado').length,
    expirados: items.filter((item) => item.status === 'expirado').length,
  };

  const operacoes = useMemo<OperacaoAgrupada[]>(() => {
    const grupos = new Map<string, SolicitacaoResumo[]>();

    for (const item of items) {
      const chave = item.documento_id || item.id;
      const existentes = grupos.get(chave) || [];
      existentes.push(item);
      grupos.set(chave, existentes);
    }

    return Array.from(grupos.entries())
      .map(([documentoId, solicitacoes]) => {
        const ordenadas = [...solicitacoes].sort(
          (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
        );
        const cedente =
          ordenadas.find((item) => item.papel_assinatura === 'cedente') ||
          ordenadas.find((item) => item.papel_assinatura !== 'cessionaria_gold_credit') ||
          ordenadas[0];
        const assinados = ordenadas.filter((item) => item.status === 'assinado').length;
        const pendentes = ordenadas.filter((item) => item.status === 'pendente' || item.status === 'visualizado').length;
        const expirados = ordenadas.filter((item) => item.status === 'expirado').length;
        const ultimaAtualizacao = [...ordenadas]
          .sort((a, b) => {
            const dataA = new Date(a.assinado_em || a.criado_em).getTime();
            const dataB = new Date(b.assinado_em || b.criado_em).getTime();
            return dataB - dataA;
          })[0];

        return {
          documentoId,
          titulo: cedente?.titulo || ordenadas[0]?.titulo || 'Operacao sem titulo',
          cedenteNome: cedente?.signatario_nome || 'Cedente nao identificado',
          total: ordenadas.length,
          assinados,
          pendentes,
          expirados,
          ultimaAtualizacao: ultimaAtualizacao?.assinado_em || ultimaAtualizacao?.criado_em,
          solicitacoes: ordenadas,
        };
      })
      .sort((a, b) => new Date(b.ultimaAtualizacao || 0).getTime() - new Date(a.ultimaAtualizacao || 0).getTime());
  }, [items]);

  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista de solicitacoes de assinatura criadas no fluxo publico.
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
        <StatsCard title="Total" value={stats.total} icon={<FileText className="h-5 w-5 text-primary" />} />
        <StatsCard title="Pendentes" value={stats.pendentes} icon={<Clock className="h-5 w-5 text-amber-600" />} />
        <StatsCard title="Assinados" value={stats.assinados} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        <StatsCard title="Expirados" value={stats.expirados} icon={<AlertCircle className="h-5 w-5 text-destructive" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitacoes recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando solicitacoes...</span>
            </div>
          ) : operacoes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma solicitacao encontrada.
            </div>
          ) : (
            operacoes.map((operacao) => (
              <Card key={operacao.documentoId} className="border-border/70 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">
                        Operacao - {operacao.cedenteNome}
                      </p>
                      <p className="text-sm text-muted-foreground">{operacao.titulo}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="h-8 rounded-full px-3 text-xs font-medium">
                        {operacao.total} participantes
                      </Badge>
                      <Badge variant="default" className="h-8 rounded-full px-3 text-xs font-medium">
                        {operacao.assinados} assinaram
                      </Badge>
                      {operacao.pendentes > 0 && (
                        <Badge variant="secondary" className="h-8 rounded-full px-3 text-xs font-medium">
                          {operacao.pendentes} faltando
                        </Badge>
                      )}
                      {operacao.expirados > 0 && (
                        <Badge variant="destructive" className="h-8 rounded-full px-3 text-xs font-medium">
                          {operacao.expirados} expirados
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-1.5">
                      {operacao.solicitacoes[0] && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full border-border/70"
                            title="Copiar link"
                            onClick={() => handleCopyLink(operacao.solicitacoes[0].token_acesso)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/70" title="Ver detalhes completos" asChild>
                            <Link to={`/contratos/documentos/${operacao.solicitacoes[0].token_acesso}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {operacao.solicitacoes[0].link_assinatura && (
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/70" title="Abrir link publico" asChild>
                              <a href={operacao.solicitacoes[0].link_assinatura} target="_blank" rel="noopener noreferrer">
                                <Share2 className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {operacao.solicitacoes[0].link_assinatura && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full border-border/70"
                              title="Copiar URL completa"
                              onClick={() => navigator.clipboard.writeText(operacao.solicitacoes[0].link_assinatura || '')}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{operacao.total} participantes</span>
                      <span className="h-1 w-1 rounded-full bg-border" />
                      <span>{operacao.assinados} assinaram</span>
                      {operacao.pendentes > 0 && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span>{operacao.pendentes} faltando</span>
                        </>
                      )}
                      {operacao.expirados > 0 && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span>{operacao.expirados} expirados</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
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
