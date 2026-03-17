import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { buscarCedentePorDocumento, buscarCedentesCadastrados, type CedenteCadastroResumo } from '@/lib/cedente-api';
import {
  assinarLocal,
  checkSignerStatus,
  criarSolicitacao,
  listarCertificados,
  prepararAssinatura,
  submeterAssinatura,
  validarCertificado,
  type Certificado,
  type CriarSolicitacaoItem,
  type SignerStatus,
} from '@/lib/assinatura-api';
import {
  getGoldCreditCertificatePreference,
  matchGoldCreditCertificate,
  type GoldCreditCertificatePreference,
} from '@/lib/goldsign-settings';
import { cn } from '@/lib/utils';

type TipoDocumento = 'padrao' | 'contrato_mae';

interface ResultadoLink {
  token_acesso: string;
  link_assinatura: string;
  papel_assinatura: 'cedente' | 'cessionaria_gold_credit';
  signatario_nome?: string;
}

interface ResultadoArquivo {
  arquivo_nome: string;
  titulo: string;
  documento_id: string;
  cedente?: ResultadoLink;
  goldCredit?: ResultadoLink;
  goldCreditStatus: 'nao_aplicavel' | 'pendente' | 'assinado' | 'erro';
  goldCreditErro?: string;
}

export default function AssinaturaDigital() {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('padrao');
  const [titulo, setTitulo] = useState('');
  const [signatarioNome, setSignatarioNome] = useState('');
  const [signatarioEmail, setSignatarioEmail] = useState('');
  const [signatarioCpfCnpj, setSignatarioCpfCnpj] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoArquivo[]>([]);
  const [cedenteOpen, setCedenteOpen] = useState(false);
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedentes, setCedentes] = useState<CedenteCadastroResumo[]>([]);
  const [cedenteSelecionado, setCedenteSelecionado] = useState<CedenteCadastroResumo | null>(null);
  const [buscandoCedentes, setBuscandoCedentes] = useState(false);
  const [carregandoCedente, setCarregandoCedente] = useState(false);
  const [signerStatus, setSignerStatus] = useState<SignerStatus>({ online: false });
  const [carregandoCertificados, setCarregandoCertificados] = useState(false);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [certificadoSelecionadoId, setCertificadoSelecionadoId] = useState('');
  const [validandoCertificado, setValidandoCertificado] = useState(false);
  const [certificadoAutorizado, setCertificadoAutorizado] = useState(false);
  const [mensagemCertificado, setMensagemCertificado] = useState('');
  const [assinandoGoldCredit, setAssinandoGoldCredit] = useState(false);
  const [goldCreditPreference, setGoldCreditPreference] = useState<GoldCreditCertificatePreference | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isContratoMae = tipoDocumento === 'contrato_mae';

  const resultadosGoldCreditPendentes = useMemo(
    () => resultados.filter((item) => item.goldCredit && item.goldCreditStatus !== 'assinado'),
    [resultados],
  );

  const linksCedenteLiberados = !isContratoMae || resultadosGoldCreditPendentes.length === 0;

  const certificadoSelecionado = useMemo(
    () => certificados.find((cert) => cert.cert_id === certificadoSelecionadoId) || null,
    [certificados, certificadoSelecionadoId],
  );

  useEffect(() => {
    if (!isContratoMae) {
      setGoldCreditPreference(null);
      return;
    }

    void getGoldCreditCertificatePreference()
      .then(setGoldCreditPreference)
      .catch(() => setGoldCreditPreference(null));
  }, [isContratoMae]);

  useEffect(() => {
    if (!isContratoMae || !goldCreditPreference || certificados.length === 0 || certificadoSelecionadoId) {
      return;
    }

    const matched = matchGoldCreditCertificate(certificados, goldCreditPreference);
    if (!matched) {
      return;
    }

    setMensagemCertificado('Certificado preferencial da Gold Credit encontrado nesta maquina. Validando automaticamente...');
    void validarCertificadoGoldCredit(matched.cert_id);
  }, [isContratoMae, goldCreditPreference, certificados, certificadoSelecionadoId]);

  useEffect(() => {
    const termo = cedenteSearch.trim();

    if (!cedenteOpen || termo.length < 2) {
      setCedentes([]);
      setBuscandoCedentes(false);
      return;
    }

    const debounce = window.setTimeout(async () => {
      setBuscandoCedentes(true);
      try {
        const data = await buscarCedentesCadastrados(termo);
        setCedentes(data);
      } catch (e: any) {
        setCedentes([]);
        toast({
          title: 'Erro ao buscar cedentes',
          description: e.message || 'Nao foi possivel consultar os cedentes cadastrados.',
          variant: 'destructive',
        });
      } finally {
        setBuscandoCedentes(false);
      }
    }, 300);

    return () => window.clearTimeout(debounce);
  }, [cedenteOpen, cedenteSearch]);

  const formatarCpfCnpj = (valor: string) => {
    const limpo = valor.replace(/\D/g, '');
    if (limpo.length === 11) return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (limpo.length === 14) return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return valor;
  };

  const preencherSignatario = (cedente: CedenteCadastroResumo) => {
    setCedenteSelecionado(cedente);
    setSignatarioNome(cedente.nome || '');
    setSignatarioEmail(cedente.email || '');
    setSignatarioCpfCnpj(formatarCpfCnpj(cedente.cpf_cnpj || ''));
  };

  const selecionarCedente = async (cedente: CedenteCadastroResumo) => {
    setCarregandoCedente(true);
    try {
      const detalhe = await buscarCedentePorDocumento(cedente.cpf_cnpj);
      preencherSignatario(detalhe);
      setCedenteOpen(false);
      setCedenteSearch('');
      setCedentes([]);
      toast({
        title: 'Cedente carregado',
        description: 'Nome, e-mail e CPF/CNPJ foram preenchidos e continuam editaveis.',
      });
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar cedente',
        description: e.message || 'Nao foi possivel preencher os dados do cedente.',
        variant: 'destructive',
      });
    } finally {
      setCarregandoCedente(false);
    }
  };

  const onSelecionarArquivo = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validos: File[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast({ title: `O arquivo ${file.name} nao e um PDF.`, variant: 'destructive' });
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: `O arquivo ${file.name} excede 50MB.`, variant: 'destructive' });
        continue;
      }
      validos.push(file);
    }

    if (validos.length === 0) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setArquivos((prev) => {
      const existentes = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const novos = validos.filter((file) => !existentes.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...prev, ...novos];
    });

    if (inputRef.current) inputRef.current.value = '';
  };

  const limpar = () => {
    setTipoDocumento('padrao');
    setTitulo('');
    setSignatarioNome('');
    setSignatarioEmail('');
    setSignatarioCpfCnpj('');
    setMensagem('');
    setArquivos([]);
    setResultados([]);
    setCedenteOpen(false);
    setCedenteSearch('');
    setCedentes([]);
    setCedenteSelecionado(null);
    setSignerStatus({ online: false });
    setCarregandoCertificados(false);
    setCertificados([]);
    setCertificadoSelecionadoId('');
    setValidandoCertificado(false);
    setCertificadoAutorizado(false);
    setMensagemCertificado('');
    setAssinandoGoldCredit(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const recarregarCertificadosGoldCredit = async () => {
    setCarregandoCertificados(true);
    setMensagemCertificado('');
    setCertificadoAutorizado(false);

    try {
      const status = await checkSignerStatus();
      setSignerStatus(status);

      if (!status.online) {
        setCertificados([]);
        return;
      }

      const lista = await listarCertificados();
      setCertificados(lista);
      const matched = matchGoldCreditCertificate(lista, goldCreditPreference);
      if (matched) {
        setCertificadoSelecionadoId(matched.cert_id);
        setMensagemCertificado('Certificado preferencial da Gold Credit encontrado nesta maquina. Validando automaticamente...');
        void validarCertificadoGoldCredit(matched.cert_id);
      } else if (goldCreditPreference?.gold_credit_cert_document) {
        setMensagemCertificado('Nenhum certificado vinculado da Gold Credit foi encontrado nesta maquina. Selecione outro certificado ou atualize o vinculo nas configuracoes do master.');
      }
    } catch (e: any) {
      setCertificados([]);
      toast({
        title: 'Erro ao carregar certificados',
        description: e.message || 'Nao foi possivel consultar os certificados da Gold Credit.',
        variant: 'destructive',
      });
    } finally {
      setCarregandoCertificados(false);
    }
  };

  const normalizarSolicitacao = (solicitacao: CriarSolicitacaoItem): ResultadoLink => ({
    token_acesso: solicitacao.token_acesso,
    link_assinatura: solicitacao.link_assinatura,
    papel_assinatura: solicitacao.papel_assinatura || 'cedente',
    signatario_nome: solicitacao.signatario_nome,
  });

  const enviar = async () => {
    if (!signatarioNome || !signatarioEmail || !signatarioCpfCnpj || arquivos.length === 0) {
      toast({
        title: 'Preencha os dados obrigatorios e selecione ao menos um PDF.',
        variant: 'destructive',
      });
      return;
    }

    setEnviando(true);
    try {
      const novosResultados: ResultadoArquivo[] = [];

      for (const [index, arquivo] of arquivos.entries()) {
        const tituloArquivo = titulo.trim()
          ? arquivos.length > 1
            ? `${titulo.trim()} - ${arquivo.name.replace(/\.pdf$/i, '')}`
            : titulo.trim()
          : arquivo.name.replace(/\.pdf$/i, '');

        const data = await criarSolicitacao({
          arquivo,
          titulo: tituloArquivo,
          tipo_documento: isContratoMae ? 'contrato_mae' : 'padrao',
          signatario_nome: signatarioNome,
          signatario_email: signatarioEmail,
          signatario_cpf_cnpj: signatarioCpfCnpj,
          mensagem,
          contrato_mae: isContratoMae,
          incluir_assinatura_gold_credit: isContratoMae,
        });

        const solicitacoesCriadas = data.solicitacoes?.length ? data.solicitacoes : [data];
        const cedente = solicitacoesCriadas.find((solicitacao) => (solicitacao.papel_assinatura || 'cedente') === 'cedente');
        const goldCredit = solicitacoesCriadas.find((solicitacao) => solicitacao.papel_assinatura === 'cessionaria_gold_credit');

        novosResultados.push({
          arquivo_nome: arquivo.name,
          titulo: tituloArquivo,
          documento_id: data.documento_id,
          cedente: cedente ? normalizarSolicitacao(cedente) : undefined,
          goldCredit: goldCredit ? normalizarSolicitacao(goldCredit) : undefined,
          goldCreditStatus: goldCredit ? 'pendente' : 'nao_aplicavel',
        });

        setResultados([...novosResultados]);

        if (index < arquivos.length - 1) {
          toast({ title: `${index + 1} de ${arquivos.length} documentos enviados.` });
        }
      }

      if (isContratoMae) {
        await recarregarCertificadosGoldCredit();
      }

      toast({
        title: arquivos.length > 1 ? 'Lote criado com sucesso.' : 'Documento criado com sucesso.',
        description: isContratoMae
          ? 'Assine primeiro a cessionaria Gold Credit para liberar o link do cedente.'
          : 'O link do cedente ja esta pronto para envio.',
      });
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

  const validarCertificadoGoldCredit = async (certId: string) => {
    setCertificadoSelecionadoId(certId);
    setCertificadoAutorizado(false);
    setMensagemCertificado('');

    const cert = certificados.find((item) => item.cert_id === certId);
    const solicitacaoGoldCredit = resultadosGoldCreditPendentes[0]?.goldCredit;
    if (!cert || !solicitacaoGoldCredit) {
      return;
    }

    setValidandoCertificado(true);
    try {
      const validation = await validarCertificado(solicitacaoGoldCredit.token_acesso, cert.cpf_cnpj);
      if (!validation.autorizado) {
        setMensagemCertificado(validation.mensagem || 'O certificado selecionado nao pertence a cessionaria Gold Credit.');
        return;
      }

      setCertificadoAutorizado(true);
      setMensagemCertificado('Certificado da cessionaria validado. Agora voce pode aplicar a assinatura interna.');
    } catch (e: any) {
      setMensagemCertificado(e.message || 'Nao foi possivel validar o certificado da cessionaria.');
    } finally {
      setValidandoCertificado(false);
    }
  };

  const assinarGoldCredit = async () => {
    if (!certificadoSelecionado || !certificadoAutorizado) {
      toast({
        title: 'Selecione e valide o certificado da Gold Credit antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    const pendentes = resultados.filter((item) => item.goldCredit && item.goldCreditStatus !== 'assinado');
    if (pendentes.length === 0) {
      return;
    }

    setAssinandoGoldCredit(true);
    try {
      for (const item of pendentes) {
        const token = item.goldCredit?.token_acesso;
        if (!token) {
          continue;
        }

        const prep = await prepararAssinatura(token);
        const assinaturaLocal = await assinarLocal({
          hash_b64: prep.hash_bytes_b64,
          algoritmo: prep.algoritmo,
          cert_id: certificadoSelecionado.cert_id,
        });

        const resultado = await submeterAssinatura({
          token_acesso: token,
          assinatura_cms_b64: assinaturaLocal.assinatura_cms_b64,
          cert_pem: assinaturaLocal.cert_pem,
          cert_tipo: assinaturaLocal.cert_tipo || certificadoSelecionado.tipo,
        });

        if (!resultado.sucesso) {
          throw new Error(resultado.mensagem || 'Falha ao aplicar a assinatura da cessionaria.');
        }

        setResultados((prev) =>
          prev.map((registro) =>
            registro.goldCredit?.token_acesso === token
              ? { ...registro, goldCreditStatus: 'assinado', goldCreditErro: undefined }
              : registro,
          ),
        );
      }

      toast({
        title: 'Cessionaria assinada com sucesso.',
        description: 'Os links do cedente foram liberados para envio.',
      });
    } catch (e: any) {
      const mensagem = e.message || 'Nao foi possivel aplicar a assinatura da cessionaria.';
      setResultados((prev) =>
        prev.map((registro) =>
          registro.goldCreditStatus === 'pendente'
            ? { ...registro, goldCreditStatus: 'erro', goldCreditErro: mensagem }
            : registro,
        ),
      );
      toast({
        title: 'Erro ao assinar com a Gold Credit',
        description: mensagem,
        variant: 'destructive',
      });
    } finally {
      setAssinandoGoldCredit(false);
    }
  };

  const removerArquivo = (arquivoRemovido: File) => {
    setArquivos((prev) => prev.filter((arquivo) => arquivo !== arquivoRemovido));
  };

  const copiarLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado com sucesso.' });
    } catch {
      toast({ title: 'Nao foi possivel copiar o link.', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie um fluxo de assinatura e, no contrato-mae, aplique primeiro a assinatura da cessionaria Gold Credit antes de enviar o link ao cedente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do documento</CardTitle>
          <CardDescription>
            Escolha o tipo de documento para usar o posicionamento predefinido da assinatura e preencher o signatario automaticamente a partir dos cedentes cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo do documento</Label>
              <Select value={tipoDocumento} onValueChange={(value: TipoDocumento) => setTipoDocumento(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo do documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Documento padrao</SelectItem>
                  <SelectItem value="contrato_mae">Contrato mae</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isContratoMae
                  ? 'Contrato-mae posiciona automaticamente o cedente e a cessionaria na pagina 12.'
                  : 'Documento padrao usa o posicionamento padrao de assinatura.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo do documento</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={isContratoMae ? 'Ex.: Contrato Mae de Cessao' : 'Ex.: Contrato de cessao'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cedente cadastrado</Label>
            <Popover open={cedenteOpen} onOpenChange={setCedenteOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={cedenteOpen}
                  className="h-auto w-full justify-between px-3 py-3 text-left font-normal"
                  disabled={carregandoCedente}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {carregandoCedente ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      {cedenteSelecionado ? (
                        <>
                          <p className="truncate text-sm font-medium text-foreground">{cedenteSelecionado.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatarCpfCnpj(cedenteSelecionado.cpf_cnpj)}
                            {cedenteSelecionado.email ? ` · ${cedenteSelecionado.email}` : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">Buscar nos cedentes cadastrados</p>
                          <p className="text-xs text-muted-foreground">Pesquise por nome ou CPF/CNPJ para preencher o signatario.</p>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[420px] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={cedenteSearch}
                    onValueChange={setCedenteSearch}
                    placeholder="Digite nome ou CPF/CNPJ do cedente..."
                  />
                  <CommandList>
                    {cedenteSearch.trim().length < 2 ? (
                      <CommandEmpty>Digite pelo menos 2 caracteres para buscar.</CommandEmpty>
                    ) : buscandoCedentes ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando cedentes...
                      </div>
                    ) : cedentes.length === 0 ? (
                      <CommandEmpty>Nenhum cedente encontrado.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Cedentes">
                        {cedentes.map((cedente) => (
                          <CommandItem
                            key={cedente.cpf_cnpj}
                            value={`${cedente.nome} ${cedente.cpf_cnpj}`}
                            onSelect={() => selecionarCedente(cedente)}
                            className="flex items-start gap-3 py-3"
                          >
                            <Check
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0',
                                cedenteSelecionado?.cpf_cnpj.replace(/\D/g, '') === cedente.cpf_cnpj.replace(/\D/g, '')
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{cedente.nome || 'Cedente sem nome'}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatarCpfCnpj(cedente.cpf_cnpj)}
                                {cedente.email ? ` · ${cedente.email}` : ' · Sem email cadastrado'}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Ao selecionar um cedente, o nome, e-mail e CPF/CNPJ abaixo sao preenchidos automaticamente, mas podem ser alterados.
            </p>
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

          {isContratoMae && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Fluxo automatico de contrato-mae</p>
                  <p className="text-xs text-muted-foreground">
                    Ao gerar o documento, a assinatura da cessionaria Gold Credit sera preparada antes do link do cedente ser liberado. O posicionamento da pagina 12 fica predefinido no backend.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos PDF</CardTitle>
          <CardDescription>Importe um ou varios PDFs. Limite de 50MB por arquivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {arquivos.length === 0 ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-accent/30">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Clique para selecionar um ou varios PDFs</p>
                <p className="text-xs text-muted-foreground">Os documentos serao enviados para o mesmo signatario</p>
              </div>
              <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onSelecionarArquivo} />
            </label>
          ) : (
            <>
              <div className="space-y-3">
                {arquivos.map((arquivo) => (
                  <div key={`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                    <FileText className="h-8 w-8 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
                      <p className="text-xs text-muted-foreground">{(arquivo.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removerArquivo(arquivo)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30">
                <Upload className="h-4 w-4" />
                Adicionar mais PDFs
                <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onSelecionarArquivo} />
              </label>
            </>
          )}
        </CardContent>
      </Card>

      {resultados.length === 0 ? (
        <div className="flex justify-end">
          <Button size="lg" className="gap-2" onClick={enviar} disabled={enviando}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando lote...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {arquivos.length > 1 ? 'Gerar lote de assinatura' : 'Gerar fluxo de assinatura'}
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {isContratoMae && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Passo 1: assinar a cessionaria Gold Credit</CardTitle>
                <CardDescription>
                  Antes de liberar o link do cedente, aplique a assinatura da cessionaria nos contratos-mae. Os certificados instalados na sua maquina sao carregados abaixo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!signerStatus.online ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    O assinador local nao foi detectado em <code>localhost:8765</code>. Inicie o assinador e recarregue os certificados.
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>Certificado da Gold Credit</Label>
                    <Select
                      value={certificadoSelecionadoId}
                      onValueChange={(value) => {
                        void validarCertificadoGoldCredit(value);
                      }}
                      disabled={!signerStatus.online || carregandoCertificados || assinandoGoldCredit}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione o certificado da cessionaria" />
                      </SelectTrigger>
                      <SelectContent>
                        {certificados.map((cert) => (
                          <SelectItem key={cert.cert_id} value={cert.cert_id}>
                            {cert.subject_cn} · {cert.cpf_cnpj}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {goldCreditPreference?.gold_credit_cert_document ? (
                      <p className="text-xs text-muted-foreground">
                        O sistema tenta selecionar automaticamente o certificado vinculado pelo master. Se ele estiver instalado nesta maquina, voce nao precisa escolher manualmente.
                      </p>
                    ) : null}
                  </div>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void recarregarCertificadosGoldCredit()}
                    disabled={carregandoCertificados || assinandoGoldCredit}
                  >
                    {carregandoCertificados ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Recarregar certificados
                  </Button>
                </div>

                {validandoCertificado && (
                  <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    Estamos validando se o certificado pertence a Gold Credit.
                  </div>
                )}

                {mensagemCertificado && (
                  <div
                    className={cn(
                      'rounded-lg border p-4 text-sm',
                      certificadoAutorizado
                        ? 'border-primary/30 bg-primary/5 text-foreground'
                        : 'border-destructive/30 bg-destructive/5 text-destructive',
                    )}
                  >
                    {mensagemCertificado}
                  </div>
                )}

                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-foreground">Contratos aguardando assinatura da cessionaria</p>
                  <div className="mt-3 space-y-2">
                    {resultados.map((resultado) => (
                      <div key={`${resultado.documento_id}-${resultado.arquivo_nome}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-foreground">{resultado.arquivo_nome}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-[11px] font-medium',
                            resultado.goldCreditStatus === 'assinado'
                              ? 'bg-primary/10 text-primary'
                              : resultado.goldCreditStatus === 'erro'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {resultado.goldCreditStatus === 'nao_aplicavel'
                            ? 'Nao aplicavel'
                            : resultado.goldCreditStatus === 'assinado'
                              ? 'Cessionaria assinada'
                              : resultado.goldCreditStatus === 'erro'
                                ? 'Falha na assinatura'
                                : 'Aguardando assinatura'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => void assinarGoldCredit()}
                    disabled={!signerStatus.online || !certificadoAutorizado || assinandoGoldCredit}
                  >
                    {assinandoGoldCredit ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Assinando cessionaria...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Assinar Gold Credit e liberar links
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {linksCedenteLiberados ? 'Fluxo pronto para envio' : 'Fluxo criado e aguardando assinatura da cessionaria'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {linksCedenteLiberados
                      ? 'Os links do cedente ja podem ser copiados e enviados.'
                      : 'Os links do cedente ficam ocultos ate a Gold Credit concluir a assinatura interna do contrato-mae.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {resultados.map((resultado) => (
                  <div key={`${resultado.documento_id}-${resultado.arquivo_nome}`} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{resultado.arquivo_nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{resultado.titulo}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          Cedente
                        </span>
                        {resultado.goldCredit ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                            Gold Credit
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {resultado.goldCredit ? (
                      <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                        {resultado.goldCreditStatus === 'assinado'
                          ? 'Cessionaria assinada na pagina 12. O link do cedente esta liberado.'
                          : resultado.goldCreditStatus === 'erro'
                            ? resultado.goldCreditErro || 'Falha ao assinar com a cessionaria.'
                            : 'Contrato-mae criado. Falta aplicar a assinatura da cessionaria Gold Credit antes de enviar ao cedente.'}
                      </div>
                    ) : null}

                    {linksCedenteLiberados && resultado.cedente ? (
                      <>
                        <p className="mt-3 truncate text-xs text-muted-foreground">{resultado.cedente.link_assinatura}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => copiarLink(resultado.cedente.link_assinatura)}>
                            <Copy className="h-4 w-4" />
                            Copiar link do cedente
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <a href={resultado.cedente.link_assinatura} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              Abrir link
                            </a>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        O link publico do cedente sera exibido aqui assim que a assinatura interna da Gold Credit for concluida.
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={limpar}>
                  Criar novo lote
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
