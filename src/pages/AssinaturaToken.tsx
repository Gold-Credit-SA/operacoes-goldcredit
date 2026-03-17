import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Shield, FileText, CheckCircle2, Download, RefreshCw, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  type ContratoData, type Certificado, type SignerStatus,
  fetchContrato, fetchContratoPdfUrl, checkSignerStatus,
  listarCertificados, validarCertificado, prepararAssinatura,
  assinarLocal, submeterAssinatura, getDownloadUrl,
} from '@/lib/assinatura-api';

type Step = 'loading' | 'contrato' | 'signer' | 'certificados' | 'assinando' | 'sucesso' | 'erro';

export default function AssinaturaToken() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [contrato, setContrato] = useState<ContratoData | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [signerStatus, setSignerStatus] = useState<SignerStatus>({ online: false });
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificado | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token nao informado.');
      setStep('erro');
      return;
    }

    (async () => {
      try {
        const data = await fetchContrato(token);
        setContrato(data);
        setPdfUrl(fetchContratoPdfUrl(token));
        setStep('contrato');
      } catch (e: any) {
        setError(e.message || 'Erro ao buscar contrato.');
        setStep('erro');
      }
    })();
  }, [token]);

  const checkSigner = useCallback(async () => {
    setStep('signer');
    const status = await checkSignerStatus();
    setSignerStatus(status);

    if (!status.online) {
      return;
    }

    try {
      const certs = await listarCertificados();
      setCertificados(certs);
      setStep('certificados');
    } catch (e: any) {
      setError('Nao foi possivel listar certificados: ' + e.message);
      setStep('erro');
    }
  }, []);

  const handleSign = useCallback(async (cert: Certificado) => {
    if (!token) return;

    setSelectedCert(cert);
    setStep('assinando');
    setProgress(0);

    try {
      setStatusMsg('Validando certificado...');
      setProgress(15);
      const validation = await validarCertificado(token, cert.cpf_cnpj);
      if (!validation.autorizado) {
        setError(validation.mensagem || 'CPF/CNPJ do certificado nao corresponde ao signatario.');
        setStep('erro');
        return;
      }

      setStatusMsg('Preparando assinatura no servidor...');
      setProgress(35);
      const prep = await prepararAssinatura(token);

      setStatusMsg('Assinando com certificado digital...');
      setProgress(55);
      const signed = await assinarLocal({
        hash_b64: prep.hash_bytes_b64,
        algoritmo: prep.algoritmo,
        cert_id: cert.cert_id,
      });

      setStatusMsg('Enviando assinatura...');
      setProgress(80);
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

  if (step === 'loading') {
    return (
      <CenteredLayout>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando contrato...</p>
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
            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => window.location.reload()}>
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

        {step === 'contrato' && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Para assinar este documento, o assinador local deve estar em execucao.
              </p>
              <Button size="lg" className="gap-2" onClick={checkSigner}>
                <MonitorSmartphone className="h-4 w-4" /> Iniciar assinatura
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'signer' && !signerStatus.online && (
          <Card>
            <CardContent className="pt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Assinador nao detectado</AlertTitle>
                <AlertDescription>
                  O assinador local nao esta em execucao em <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost:8765</code>.
                  Inicie o assinador e tente novamente.
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="mt-4 w-full gap-2" onClick={checkSigner}>
                <RefreshCw className="h-4 w-4" /> Verificar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'certificados' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione o certificado</CardTitle>
              <CardDescription>
                Assinador conectado{signerStatus.versao ? ` (v${signerStatus.versao})` : ''}. Escolha o certificado para assinar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {certificados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum certificado encontrado.</p>
              ) : (
                certificados.map((cert) => (
                  <button
                    key={cert.cert_id}
                    onClick={() => handleSign(cert)}
                    className="w-full rounded-lg border p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{cert.subject_cn}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">CPF/CNPJ: {cert.cpf_cnpj}</p>
                        <p className="text-xs text-muted-foreground">Emitido por: {cert.issuer_cn}</p>
                        <p className="text-xs text-muted-foreground">
                          Validade: {new Date(cert.not_after).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{cert.tipo}</Badge>
                    </div>
                  </button>
                ))
              )}
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
