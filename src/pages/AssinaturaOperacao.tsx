import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  assinarLocal,
  checkSignerStatus,
  fetchOperacao,
  getDownloadUrl,
  listarCertificados,
  prepararAssinatura,
  submeterAssinatura,
  type Certificado,
  type OperacaoPublicaData,
  type SignerStatus,
  validarCertificado,
} from '@/lib/assinatura-api';

type Step = 'loading' | 'selecionar-certificado' | 'detalhes' | 'assinando' | 'sucesso' | 'erro';

export default function AssinaturaOperacao() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [operacao, setOperacao] = useState<OperacaoPublicaData | null>(null);
  const [signerStatus, setSignerStatus] = useState<SignerStatus>({ online: false });
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const certificadoSelecionado = useMemo(
    () => certificados.find((item) => item.cert_id === selectedCertId) || null,
    [certificados, selectedCertId],
  );

  const pendentes = operacao?.documentos.filter((item) => item.status === 'pendente' || item.status === 'visualizado') || [];

  const carregar = async () => {
    if (!token) {
      setError('Token da operacao nao informado.');
      setStep('erro');
      return;
    }

    setStep('loading');
    setError('');
    try {
      const [data, status] = await Promise.all([fetchOperacao(token), checkSignerStatus()]);
      setOperacao(data);
      setSignerStatus(status);
      setSelecionados(data.documentos.filter((item) => item.status === 'pendente' || item.status === 'visualizado').map((item) => item.token_acesso));

      if (!status.online) {
        setCertificados([]);
        setStep('selecionar-certificado');
        return;
      }

      const certs = await listarCertificados();
      setCertificados(certs);
      setStep('selecionar-certificado');
    } catch (e: any) {
      setError(e.message || 'Nao foi possivel carregar a operacao.');
      setStep('erro');
    }
  };

  useEffect(() => {
    void carregar();
  }, [token]);

  const validarCertificadoSelecionado = async (certId: string) => {
    if (!operacao) return;
    const cert = certificados.find((item) => item.cert_id === certId);
    if (!cert) return;
    setSelectedCertId(certId);

    const alvo = operacao.documentos.find((item) => item.status === 'pendente' || item.status === 'visualizado');
    if (!alvo) {
      setStep('detalhes');
      return;
    }

    try {
      const validacao = await validarCertificado(alvo.token_acesso, cert.cpf_cnpj);
      if (!validacao.autorizado) {
        setError(validacao.mensagem || 'Certificado nao autorizado para esta operacao.');
        setStep('erro');
        return;
      }
      setStep('detalhes');
    } catch (e: any) {
      setError(e.message || 'Nao foi possivel validar o certificado.');
      setStep('erro');
    }
  };

  const toggleDocumento = (tokenAcesso: string, checked: boolean) => {
    setSelecionados((prev) => checked ? [...prev, tokenAcesso] : prev.filter((item) => item !== tokenAcesso));
  };

  const assinarSelecionados = async () => {
    if (!operacao || !certificadoSelecionado || !selecionados.length) return;
    setStep('assinando');
    setProgress(5);

    try {
      const docsParaAssinar = operacao.documentos.filter((item) => selecionados.includes(item.token_acesso) && (item.status === 'pendente' || item.status === 'visualizado'));
      for (let i = 0; i < docsParaAssinar.length; i += 1) {
        const doc = docsParaAssinar[i];
        const baseProgress = Math.round((i / Math.max(docsParaAssinar.length, 1)) * 100);

        setStatusMsg(`Validando certificado para ${doc.titulo}...`);
        await validarCertificado(doc.token_acesso, certificadoSelecionado.cpf_cnpj);

        setStatusMsg(`Preparando ${doc.titulo}...`);
        setProgress(Math.max(baseProgress, 10));
        const prep = await prepararAssinatura(doc.token_acesso);

        setStatusMsg(`Assinando ${doc.titulo}...`);
        setProgress(Math.max(baseProgress + 15, 20));
        const assinaturaLocal = await assinarLocal({
          hash_b64: prep.hash_bytes_b64,
          algoritmo: prep.algoritmo,
          cert_id: certificadoSelecionado.cert_id,
        });

        setStatusMsg(`Enviando assinatura de ${doc.titulo}...`);
        setProgress(Math.min(baseProgress + 30, 95));
        await submeterAssinatura({
          token_acesso: doc.token_acesso,
          assinatura_cms_b64: assinaturaLocal.assinatura_cms_b64,
          cert_pem: assinaturaLocal.cert_pem,
          cert_tipo: assinaturaLocal.cert_tipo || certificadoSelecionado.tipo,
        });
      }

      setProgress(100);
      setStatusMsg('Assinaturas concluidas.');
      await carregar();
      setStep('sucesso');
    } catch (e: any) {
      setError(e.message || 'Erro durante a assinatura da operacao.');
      setStep('erro');
    }
  };

  if (step === 'loading') {
    return (
      <CenteredLayout>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando operacao...</p>
      </CenteredLayout>
    );
  }

  if (step === 'erro') {
    return (
      <CenteredLayout>
        <Card className="w-full max-w-xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => void carregar()}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </CenteredLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Assinatura da Operacao</h1>
            <p className="text-xs text-muted-foreground">Assine varios documentos com o mesmo certificado.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {operacao && (
          <Card>
            <CardHeader>
              <CardTitle>{operacao.signatario_nome || 'Operacao de assinatura'}</CardTitle>
              <CardDescription>{operacao.total_documentos} documento(s) · {operacao.total_assinados} assinado(s)</CardDescription>
            </CardHeader>
          </Card>
        )}

        {step === 'selecionar-certificado' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar certificado</CardTitle>
              <CardDescription>Escolha o certificado que sera usado para todos os documentos selecionados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!signerStatus.online ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Assinador nao detectado</AlertTitle>
                  <AlertDescription>Inicie o assinador local em <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost:8765</code> e tente novamente.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label>Certificado digital</Label>
                  <Select value={selectedCertId} onValueChange={(value) => void validarCertificadoSelecionado(value)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecione o certificado" />
                    </SelectTrigger>
                    <SelectContent>
                      {certificados.map((cert) => (
                        <SelectItem key={cert.cert_id} value={cert.cert_id}>
                          {cert.subject_cn} · {cert.cpf_cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={() => void carregar()}>
                <RefreshCw className="h-4 w-4" />
                Verificar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {(step === 'detalhes' || step === 'sucesso') && operacao && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Documentos da operacao</CardTitle>
                <CardDescription>Marque os documentos que deseja assinar agora.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {operacao.documentos.map((doc) => {
                  const isPendente = doc.status === 'pendente' || doc.status === 'visualizado';
                  return (
                    <div key={doc.token_acesso} className="flex items-center gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={selecionados.includes(doc.token_acesso)}
                        disabled={!isPendente || step === 'sucesso'}
                        onCheckedChange={(checked) => toggleDocumento(doc.token_acesso, checked === true)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{doc.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">{doc.nome_arquivo}</p>
                      </div>
                      <Badge variant={doc.status === 'assinado' ? 'default' : doc.status === 'expirado' ? 'destructive' : 'outline'}>
                        {doc.status}
                      </Badge>
                      {doc.status === 'assinado' && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={getDownloadUrl(doc.token_acesso)} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {step === 'detalhes' && (
              <div className="flex justify-end">
                <Button onClick={() => void assinarSelecionados()} disabled={!selecionados.length || !certificadoSelecionado}>
                  Assinar documentos selecionados
                </Button>
              </div>
            )}

            {step === 'sucesso' && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Assinaturas concluidas</AlertTitle>
                <AlertDescription>Os documentos selecionados foram assinados com sucesso.</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {step === 'assinando' && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">{statusMsg}</p>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl text-center">{children}</div>
    </div>
  );
}
