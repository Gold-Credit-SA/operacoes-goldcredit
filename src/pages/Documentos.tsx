import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Link2, Loader2, RefreshCw, Send, Share2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { listarSolicitacoes, type SolicitacaoResumo } from '@/lib/assinatura-api';

type OperacaoResumo = {
  documentoId: string;
  titulo: string;
  nomeArquivo: string;
  cedenteNome: string;
  token: string;
  link?: string;
  totalParticipantes: number;
  totalAssinados: number;
  totalPendentes: number;
};

function agruparOperacoes(items: SolicitacaoResumo[]): OperacaoResumo[] {
  const grupos = new Map<string, SolicitacaoResumo[]>();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const chave = item.documento_id || item.id;
    if (!chave) continue;

    const grupo = grupos.get(chave) || [];
    grupo.push(item);
    grupos.set(chave, grupo);
  }

  return Array.from(grupos.entries())
    .map(([documentoId, grupo]) => {
      const ordenados = [...grupo].sort(
        (a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime(),
      );

      const cedente =
        ordenados.find((item) => item.papel_assinatura === 'cedente') ||
        ordenados.find((item) => item.papel_assinatura !== 'cessionaria_gold_credit') ||
        ordenados[0];

      return {
        documentoId,
        titulo: cedente?.titulo || ordenados[0]?.titulo || 'Documento',
        nomeArquivo: cedente?.nome_arquivo || ordenados[0]?.nome_arquivo || '',
        cedenteNome: cedente?.signatario_nome || 'Cedente nao informado',
        token: cedente?.token_acesso || ordenados[0]?.token_acesso || '',
        link: cedente?.link_assinatura || ordenados[0]?.link_assinatura,
        totalParticipantes: ordenados.length,
        totalAssinados: ordenados.filter((item) => item.status === 'assinado').length,
        totalPendentes: ordenados.filter((item) => item.status !== 'assinado').length,
      };
    })
    .sort((a, b) => {
      const aTime = new Date(items.find((item) => item.documento_id === a.documentoId)?.criado_em || 0).getTime();
      const bTime = new Date(items.find((item) => item.documento_id === b.documentoId)?.criado_em || 0).getTime();
      return bTime - aTime;
    });
}

export default function Documentos() {
  const [items, setItems] = useState<SolicitacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await listarSolicitacoes(100);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setItems([]);
      setErro(e?.message || 'Nao foi possivel listar as solicitacoes.');
      toast({
        title: 'Erro ao carregar documentos',
        description: e?.message || 'Nao foi possivel listar as solicitacoes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const operacoes = useMemo(() => agruparOperacoes(items), [items]);

  const copiarTexto = async (texto: string, sucesso: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: sucesso });
    } catch {
      toast({ title: 'Nao foi possivel copiar.', variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operacoes agrupadas por documento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link to="/contratos/assinatura-digital" className="gap-2">
              <Send className="h-4 w-4" />
              Novo documento
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 rounded-2xl border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando operacoes...</span>
        </div>
      ) : erro ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Nao foi possivel carregar as operacoes.</p>
          <p className="mt-2 text-sm text-muted-foreground">{erro}</p>
        </div>
      ) : operacoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhuma operacao encontrada.
        </div>
      ) : (
        <div className="space-y-4">
          {operacoes.map((operacao) => (
            <div key={operacao.documentoId} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-foreground">{operacao.cedenteNome}</div>
                  <div className="text-sm text-muted-foreground">{operacao.titulo}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full border px-3 py-1 text-foreground">
                    {operacao.totalParticipantes} participantes
                  </span>
                  <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">
                    {operacao.totalAssinados} assinaram
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-foreground">
                    {operacao.totalPendentes} faltando
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => operacao.token && copiarTexto(`${window.location.origin}/assinar/${operacao.token}`, 'Link copiado.')}
                    disabled={!operacao.token}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => operacao.token && navigate(`/contratos/documentos/${operacao.token}`)}
                    disabled={!operacao.token}
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => operacao.link && window.open(operacao.link, '_blank', 'noopener,noreferrer')}
                    disabled={!operacao.link}
                    title="Abrir link publico"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => operacao.link && copiarTexto(operacao.link, 'URL copiada.')}
                    disabled={!operacao.link}
                    title="Copiar URL completa"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  {operacao.nomeArquivo || 'Arquivo nao informado'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
