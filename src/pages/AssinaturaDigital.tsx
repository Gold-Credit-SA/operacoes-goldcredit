import { type ChangeEvent, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Loader2, Send, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { criarSolicitacao } from '@/lib/assinatura-api';

interface ResultadoCriacao {
  token_acesso: string;
  link_assinatura: string;
}

export default function AssinaturaDigital() {
  const [titulo, setTitulo] = useState('');
  const [signatarioNome, setSignatarioNome] = useState('');
  const [signatarioEmail, setSignatarioEmail] = useState('');
  const [signatarioCpfCnpj, setSignatarioCpfCnpj] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCriacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelecionarArquivo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'Selecione um arquivo PDF.', variant: 'destructive' });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'O arquivo excede 50MB.', variant: 'destructive' });
      return;
    }

    setArquivo(file);
  };

  const limpar = () => {
    setTitulo('');
    setSignatarioNome('');
    setSignatarioEmail('');
    setSignatarioCpfCnpj('');
    setMensagem('');
    setArquivo(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const enviar = async () => {
    if (!titulo || !signatarioNome || !signatarioEmail || !signatarioCpfCnpj || !arquivo) {
      toast({
        title: 'Preencha todos os campos obrigatorios.',
        variant: 'destructive',
      });
      return;
    }

    setEnviando(true);
    try {
      const data = await criarSolicitacao({
        arquivo,
        titulo,
        signatario_nome: signatarioNome,
        signatario_email: signatarioEmail,
        signatario_cpf_cnpj: signatarioCpfCnpj,
        mensagem,
      });
      setResultado({
        token_acesso: data.token_acesso,
        link_assinatura: data.link_assinatura,
      });
      toast({ title: 'Documento enviado com sucesso.' });
    } catch (e: any) {
      toast({
        title: 'Erro ao criar solicitacao',
        description: e.message || 'Nao foi possivel enviar o documento.',
        variant: 'destructive',
      });
    } finally {
      setEnviando(false);
    }
  };

  const copiarLink = async () => {
    if (!resultado?.link_assinatura) return;
    try {
      await navigator.clipboard.writeText(resultado.link_assinatura);
      toast({ title: 'Link copiado com sucesso.' });
    } catch {
      toast({ title: 'Nao foi possivel copiar o link.', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie um PDF, defina o signatario e gere um link publico de assinatura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do documento</CardTitle>
          <CardDescription>Essas informacoes serao usadas para criar a solicitacao no backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Titulo do documento</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Contrato de cessao" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do signatario</Label>
              <Input id="nome" value={signatarioNome} onChange={(e) => setSignatarioNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email do signatario</Label>
              <Input id="email" type="email" value={signatarioEmail} onChange={(e) => setSignatarioEmail(e.target.value)} placeholder="email@dominio.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpfcnpj">CPF/CNPJ obrigatorio para assinar</Label>
            <Input id="cpfcnpj" value={signatarioCpfCnpj} onChange={(e) => setSignatarioCpfCnpj(e.target.value)} placeholder="Somente o documento do certificado que pode assinar" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem opcional</Label>
            <Textarea id="mensagem" rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Mensagem exibida ao abrir o link de assinatura" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo PDF</CardTitle>
          <CardDescription>Limite de 50MB por arquivo.</CardDescription>
        </CardHeader>
        <CardContent>
          {!arquivo ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-accent/30">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Clique para selecionar o PDF</p>
                <p className="text-xs text-muted-foreground">Ou arraste o arquivo para esta area</p>
              </div>
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onSelecionarArquivo} />
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <FileText className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
                <p className="text-xs text-muted-foreground">{(arquivo.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setArquivo(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!resultado ? (
        <div className="flex justify-end">
          <Button size="lg" className="gap-2" onClick={enviar} disabled={enviando}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gerar link de assinatura
              </>
            )}
          </Button>
        </div>
      ) : (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Solicitacao criada com sucesso</h3>
                <p className="text-xs text-muted-foreground">Copie o link abaixo e envie para o signatario.</p>
              </div>
            </div>

            <div className="rounded-md border bg-background px-3 py-2 text-sm text-foreground">
              {resultado.link_assinatura}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={copiarLink}>
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <a href={resultado.link_assinatura} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir link
                </a>
              </Button>
              <Button variant="ghost" onClick={limpar}>
                Criar outro documento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
