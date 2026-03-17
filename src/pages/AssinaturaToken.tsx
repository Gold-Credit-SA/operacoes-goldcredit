import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Shield, FileText, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type ContratoData, type Certificado, type SignerStatus,
  fetchContrato, fetchContratoPdfUrl, checkSignerStatus,
  listarCertificados, validarCertificado, prepararAssinatura,
  assinarLocal, submeterAssinatura, getDownloadUrl,
} from '@/lib/assinatura-api';

type Step = 'loading' | 'pronto' | 'assinando' | 'sucesso' | 'erro';
type ValidationState = 'idle' | 'checking' | 'invalid';

export default function AssinaturaToken() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [contrato, setContrato] = useState<ContratoData | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [signerStatus, setSignerStatus] = useState<SignerStatus>({ online: false });
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificado | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const iniciarAssinatura = useCallback(async (cert: Certificado) => {
    if (!token) {
      return;
    }

    setSelectedCert(cert);
    setValidationState('idle');
    setValidationMessage('');
    setStep('assinando');
    setProgress(20);

    try {
      setStatusMsg('Preparando assinatura no servidor...');
      setProgress(40);
      const prep = await prepararAssinatura(token);

      setStatusMsg('Assinando com certificado digital...');
      setProgress(65);
      const signed = await assinarLocal({
        hash_b64: prep.hash_bytes_b64,
        algoritmo: prep.algoritmo,
        cert_id: cert.cert_id,
      });

      setStatusMsg('Enviando assinatura...');
      setProgress(85);
      const result = await submeterAssinatura({
        token_acesso: token,
        assinatura_cms_b64: signed.assinatura_cms_b64,
        cert_pem: signed.cert_pem,
        cert_tipo: signed.cert_tipo || cert.tipo,
      });

      if (!result.sucesso) {
        setError(result.mensagem || 'Falha ao submeter assinatura.');
        setStep('erro');
        return;
      }

      setProgress(100);
      setStatusMsg('Assinatura concluida!');
      setTimeout(() => setStep('sucesso'), 600);
    } catch (e: any) {
      setError(e.message || 'Erro durante o processo de assinatura.');
      setStep('erro');
    }
  }, [token]);

  const validarCertificadoSelecionado = useCallback(async (cert: Certificado) => {
    if (!token) {
      return;
    }

    setSelectedCert(cert);
    setValidationState('checking');
    setValidationMessage('');

    try {
      const validation = await validarCertificado(token, cert.cpf_cnpj);
      if (!validation.autorizado) {
        setValidationState('invalid');
        setValidationMessage(validation.mensagem || 'CPF/CNPJ do certificado nao corresponde ao signatario esperado.');
        return;
      }

      setStatusMsg('Certificado validado. Iniciando assinatura...');
      setProgress(10);
      await iniciarAssinatura(cert);
    } catch (e: any) {
      setValidationState('invalid');
      setValidationMessage(e.message || 'Nao foi possivel validar o certificado selecionado.');
    }
  }, [iniciarAssinatura, token]);

  const carregarFluxo = useCallback(async () => {
    if (!token) {
      setError('Token nao informado.');
      setStep('erro');
      return;
    }

    setError('');
    setSelectedCert(null);
    setValidationState('idle');
    setValidationMessage('');
    setStep('loading');

    try {
      const data = await fetchContrato(token);
      setContrato(data);
      setPdfUrl(fetchContratoPdfUrl(token));

      const status = await checkSignerStatus();
      setSignerStatus(status);

      if (!status.online) {
        setCertificados([]);
        setStep('pronto');
        return;
      }

      const certs = await listarCertificados();
      setCertificados(certs);
      setStep('pronto');
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar o fluxo de assinatura.');
      setStep('erro');
    }
  }, [token]);

  useEffect(() => {
    carregarFluxo();
  }, [carregarFluxo]);

  if (step === 'loading') {
    return (
      <CenteredLayout>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando contrato e certificados...</p>
      </CenteredLayout>
    );
  }

  if (step === 'erro') {
    return (
      <CenteredLayout>
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4 w-full gap-2" onClick={carregarFluxo}>
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </CenteredLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Assinatura Digital</h1>
            <p className="text-xs text-muted-foreground">Certificado ICP-Brasil</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {contrato && <ContratoCard contrato={contrato} pdfUrl={pdfUrl} />}

        {step === 'pronto' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecionar certificado</CardTitle>
              <CardDescription>
                Ao escolher um certificado valido, a assinatura comeca automaticamente sem nova selecao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!signerStatus.online ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Assinador nao detectado</AlertTitle>
                  <AlertDescription>
                    O assinador local nao esta em execucao em <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost:8765</code>.
                    Inicie o assinador e clique em verificar novamente.
                  </AlertDescription>
                </Alert>
              ) : certificados.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhum certificado encontrado</AlertTitle>
                  <AlertDescription>
                    O assinador foi detectado{signerStatus.versao ? ` (v${signerStatus.versao})` : ''}, mas nenhum certificado disponivel foi retornado.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Certificado digital</label>
                    <Select
                      value={selectedCert?.cert_id || ''}
                      onValueChange={(certId) => {
                        const cert = certificados.find((item) => item.cert_id === certId);
                        if (cert) {
                          void validarCertificadoSelecionado(cert);
                        }
                      }}
                      disabled={validationState === 'checking'}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione o certificado para assinar" />
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

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Assinador local</p>
                        <p className="text-xs text-muted-foreground">
                          Conectado{signerStatus.versao ? ` · versao ${signerStatus.versao}` : ''}.
                        </p>
                      </div>
                      <Badge variant="outline">Online</Badge>
                    </div>

                    {selectedCert && (
                      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                        <p>Certificado: <span className="font-medium text-foreground">{selectedCert.subject_cn}</span></p>
                        <p>CPF/CNPJ: {selectedCert.cpf_cnpj}</p>
                        <p>Emitido por: {selectedCert.issuer_cn}</p>
                        <p>Validade: {new Date(selectedCert.not_after).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                  </div>

                  {validationState === 'checking' && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertTitle>Validando certificado</AlertTitle>
                      <AlertDescription>
                        Estamos conferindo se o certificado pertence a pessoa ou empresa esperada para esta assinatura.
                      </AlertDescription>
                    </Alert>
                  )}

                  {validationState === 'invalid' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Certificado nao autorizado</AlertTitle>
                      <AlertDescription>{validationMessage}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={carregarFluxo} disabled={validationState === 'checking'}>
                <RefreshCw className="h-4 w-4" /> Verificar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'assinando' && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">{statusMsg}</p>
              </div>
              <Progress value={progress} className="h-2" />
              {selectedCert && (
                <p className="text-xs text-muted-foreground">Certificado: {selectedCert.subject_cn}</p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'sucesso' && token && (
          <Card>
            <CardContent className="space-y-4 pt-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Documento assinado com sucesso!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A assinatura digital foi aplicada e registrada.
                </p>
              </div>
              <Button size="lg" className="gap-2" asChild>
                <a href={getDownloadUrl(token)} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> Baixar PDF assinado
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg text-center">{children}</div>
    </div>
  );
}

function ContratoCard({ contrato, pdfUrl }: { contrato: ContratoData; pdfUrl: string }) {
  const [showPdf, setShowPdf] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{contrato.titulo}</CardTitle>
            <CardDescription className="mt-1">{contrato.nome_arquivo}</CardDescription>
          </div>
          <Badge variant="secondary">{contrato.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Signatario:</span>
            <p className="font-medium text-foreground">{contrato.signatario_nome}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <p className="font-medium text-foreground">{contrato.signatario_email}</p>
          </div>
        </div>

        {contrato.mensagem && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{contrato.mensagem}</p>
        )}

        {contrato.assinatura_obrigatoria_cpf_cnpj && (
          <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <p>Documento exigido no certificado: {contrato.assinatura_obrigatoria_cpf_cnpj}</p>
            {contrato.assinatura_obrigatoria_nome && (
              <p>Assinante esperado: {contrato.assinatura_obrigatoria_nome}</p>
            )}
          </div>
        )}

        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPdf(!showPdf)}>
          <FileText className="h-4 w-4" /> {showPdf ? 'Ocultar PDF' : 'Visualizar PDF'}
        </Button>

        {showPdf && (
          <div className="mt-2 overflow-hidden rounded-lg border">
            <iframe src={pdfUrl} className="h-[500px] w-full" title="Preview do contrato" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
