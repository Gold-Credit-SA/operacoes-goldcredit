import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { fetchContratoPdfUrl, getDownloadUrl, getPublicSigningUrl, listarSolicitacoes, type SolicitacaoResumo } from '@/lib/assinatura-api';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  visualizado: { label: 'Visualizado', variant: 'secondary' },
  assinado: { label: 'Assinado', variant: 'default' },
  expirado: { label: 'Expirado', variant: 'destructive' },
};

function formatarData(valor?: string) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR');
}

export default function DocumentoDetalhe() {
  const { token } = useParams<{ token: string }>();
  const [items, setItems] = useState<SolicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Documento nao informado.');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const data = await listarSolicitacoes(200);
        setItems(data);
        setError('');
      } catch (e: any) {
        setError(e.message || 'Nao foi possivel carregar os detalhes do documento.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const documento = useMemo(
    () => items.find((item) => item.token_acesso === token) || null,
    [items, token],
  );

  const documentosRelacionados = useMemo(() => {
    if (!documento) return [];
    if (documento.operacao_id) {
      return items
        .filter((item) => item.operacao_id === documento.operacao_id)
        .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    }
    const chaveDoc = (documento.assinatura_obrigatoria_cpf_cnpj || '').replace(/\D/g, '');
    const chaveEmail = (documento.signatario_email || '').trim().toLowerCase();

    return items
      .filter((item) => {
        const itemDoc = (item.assinatura_obrigatoria_cpf_cnpj || '').replace(/\D/g, '');
        const itemEmail = (item.signatario_email || '').trim().toLowerCase();
        if (chaveDoc && itemDoc) return itemDoc === chaveDoc;
        return chaveEmail && itemEmail === chaveEmail;
      })
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [documento, items]);

  const stats = useMemo(() => ({
    total: documentosRelacionados.length,
    assinados: documentosRelacionados.filter((item) => item.status === 'assinado').length,
    pendentes: documentosRelacionados.filter((item) => item.status === 'pendente' || item.status === 'visualizado').length,
    expirados: documentosRelacionados.filter((item) => item.status === 'expirado').length,
  }), [documentosRelacionados]);

  const copiarLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado com sucesso.' });
    } catch {
      toast({ title: 'Nao foi possivel copiar o link.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Carregando detalhes do documento...</p>
        </div>
      </div>
    );
  }

  if (error || !documento) {
    return (
      <div className="max-w-4xl space-y-6 p-6">
        <Button variant="ghost" asChild className="gap-2">
          <RouterLink to="/contratos/documentos">
            <ArrowLeft className="h-4 w-4" />
            Voltar para documentos
          </RouterLink>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Documento nao encontrado</AlertTitle>
          <AlertDescription>{error || 'Nao encontramos essa solicitacao no painel atual.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const status = STATUS_LABELS[documento.status] || STATUS_LABELS.pendente;
  const pdfUrl = fetchContratoPdfUrl(documento.token_acesso);
  const linkPublico = getPublicSigningUrl(documento.token_acesso, documento.link_assinatura);

  return (
    <div className="max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" asChild className="gap-2 px-0">
            <RouterLink to="/contratos/documentos">
              <ArrowLeft className="h-4 w-4" />
              Voltar para documentos
            </RouterLink>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{documento.titulo}</h1>
            <p className="text-sm text-muted-foreground">{documento.nome_arquivo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Button variant="outline" className="gap-2" onClick={() => copiarLink(linkPublico)}>
            <Copy className="h-4 w-4" />
            Copiar link
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir link publico
            </a>
          </Button>
          {documento.status === 'assinado' && (
            <Button className="gap-2" asChild>
              <a href={getDownloadUrl(documento.token_acesso)} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                Baixar assinado
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ResumoCard titulo="Total do signatario" valor={stats.total} />
        <ResumoCard titulo="Assinados" valor={stats.assinados} />
        <ResumoCard titulo="Pendentes" valor={stats.pendentes} />
        <ResumoCard titulo="Expirados" valor={stats.expirados} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumo da solicitacao</CardTitle>
            <CardDescription>Detalhes do documento atual e do signatario vinculado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <CampoDetalhe rotulo="Signatario" valor={documento.signatario_nome || 'Nao informado'} />
              <CampoDetalhe rotulo="E-mail" valor={documento.signatario_email || 'Nao informado'} />
              <CampoDetalhe rotulo="CPF/CNPJ" valor={documento.assinatura_obrigatoria_cpf_cnpj || 'Nao informado'} />
              <CampoDetalhe rotulo="Criado em" valor={formatarData(documento.criado_em)} />
              <CampoDetalhe rotulo="Assinado em" valor={formatarData(documento.assinado_em)} />
              <CampoDetalhe rotulo="Expira em" valor={formatarData(documento.expira_em)} />
            </div>

            {documento.mensagem && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mensagem enviada</p>
                <p className="mt-2 text-sm text-foreground">{documento.mensagem}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controle do signatario</CardTitle>
            <CardDescription>
              Acompanhe todos os documentos recentes vinculados ao mesmo signatario para saber o que ja foi e o que ainda falta assinar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pendentes">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="assinados">Assinados</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>

              <TabsContent value="pendentes">
                <TabelaRelacionados
                  items={documentosRelacionados.filter((item) => item.status === 'pendente' || item.status === 'visualizado' || item.status === 'expirado')}
                />
              </TabsContent>

              <TabsContent value="assinados">
                <TabelaRelacionados items={documentosRelacionados.filter((item) => item.status === 'assinado')} />
              </TabsContent>

              <TabsContent value="todos">
                <TabelaRelacionados items={documentosRelacionados} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview do documento</CardTitle>
          <CardDescription>Visualizacao do PDF vinculado a esta solicitacao.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <iframe src={pdfUrl} className="h-[780px] w-full bg-white" title={`PDF ${documento.nome_arquivo}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResumoCard({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold text-foreground">{valor}</p>
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </CardContent>
    </Card>
  );
}

function CampoDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{valor}</p>
    </div>
  );
}

function TabelaRelacionados({ items }: { items: SolicitacaoResumo[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Nenhum documento encontrado nesta visao.</p>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
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
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatarData(item.criado_em)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
