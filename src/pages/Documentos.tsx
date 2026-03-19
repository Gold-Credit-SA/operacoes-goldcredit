import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Copy, Eye, FileText, Link2, Loader2, RefreshCw, Send, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { listarSolicitacoes, type SolicitacaoResumo } from '@/lib/assinatura-api';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  visualizado: { label: 'Visualizado', variant: 'secondary' },
  assinado: { label: 'Assinado', variant: 'default' },
  expirado: { label: 'Expirado', variant: 'destructive' },
};

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
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando solicitacoes...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Signatario</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Assinado em</TableHead>
                  <TableHead className="w-[120px]">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma solicitacao encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const status = STATUS_LABELS[item.status] || STATUS_LABELS.pendente;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{item.titulo}</p>
                            <p className="text-xs text-muted-foreground">{item.nome_arquivo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{item.signatario_nome || 'Nao informado'}</p>
                            <p className="text-xs text-muted-foreground">{item.signatario_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.assinatura_obrigatoria_cpf_cnpj || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.assinado_em ? new Date(item.assinado_em).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Copiar link"
                              onClick={() => handleCopyLink(item.token_acesso)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Ver detalhes" asChild>
                              <Link to={`/contratos/documentos/${item.token_acesso}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {item.link_assinatura && (
                              <Button variant="ghost" size="icon" title="Abrir link publico" asChild>
                                <a href={item.link_assinatura} target="_blank" rel="noopener noreferrer">
                                  <Share2 className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {item.link_assinatura && (
                              <Button variant="ghost" size="icon" title="Copiar URL completa" onClick={() => navigator.clipboard.writeText(item.link_assinatura || '')}>
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
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
