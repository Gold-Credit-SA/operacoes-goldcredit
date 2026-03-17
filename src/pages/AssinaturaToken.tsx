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

  // Step 1 – Load contract
  useEffect(() => {
    if (!token) { setError('Token não informado.'); setStep('erro'); return; }
    (async () => {
      try {
        const data = await fetchContrato(token);
        setContrato(data);
        setPdfUrl(await fetchContratoPdfUrl(token));
        setStep('contrato');
      } catch (e: any) {
        setError(e.message || 'Erro ao buscar contrato.');
        setStep('erro');
      }
    })();
  }, [token]);

  // Step 2 – Check local signer
  const checkSigner = useCallback(async () => {
    setStep('signer');
    const status = await checkSignerStatus();
    setSignerStatus(status);
    if (status.online) {
      try {
        const certs = await listarCertificados();
        setCertificados(certs);
        setStep('certificados');
      } catch (e: any) {
        setError('Não foi possível listar certificados: ' + e.message);
        setStep('erro');
      }
    }
  }, []);

  // Steps 3-6 – Full signing flow
  const handleSign = useCallback(async (cert: Certificado) => {
    if (!token || !contrato) return;
    setSelectedCert(cert);
    setStep('assinando');
    setProgress(0);

    try {
      // Validate certificate
      setStatusMsg('Validando certificado...');
      setProgress(15);
      const validation = await validarCertificado(token, cert.cpf_cnpj);
      if (!validation.valido) {
        setError(validation.mensagem || 'CPF/CNPJ do certificado não corresponde ao signatário.');
        setStep('erro');
        return;
      }

      // Prepare signature
      setStatusMsg('Preparando assinatura no servidor...');
      setProgress(35);
      const prep = await prepararAssinatura(token);

      // Sign locally
      setStatusMsg('Assinando com certificado digital...');
      setProgress(55);
      const signed = await assinarLocal({
        hash_b64: prep.hash_b64,
        algoritmo: prep.algoritmo,
        thumbprint: cert.thumbprint,
      });

      // Submit
      setStatusMsg('Enviando assinatura...');
      setProgress(80);
      const result = await submeterAssinatura({
        token_acesso: token,
        assinatura_cms_b64: signed.assinatura_cms_b64,
        cert_pem: signed.cert_pem,
        cert_tipo: cert.tipo,
      });

      if (!result.sucesso) {
        setError(result.mensagem || 'Falha ao submeter assinatura.');
        setStep('erro');
        return;
      }

      setProgress(100);
      setStatusMsg('Assinatura concluída!');
      setTimeout(() => setStep('sucesso'), 600);
    } catch (e: any) {
      setError(e.message || 'Erro durante o processo de assinatura.');
      setStep('erro');
    }
  }, [token, contrato]);

  // ── Render ──

  if (step === 'loading') {
    return (
      <CenteredLayout>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Carregando contrato...</p>
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Assinatura Digital</h1>
            <p className="text-xs text-muted-foreground">Certificado ICP-Brasil</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Contract info – always visible after loading */}
        {contrato && <ContratoCard contrato={contrato} pdfUrl={pdfUrl} />}

        {/* Step: Show contract + start button */}
        {step === 'contrato' && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Para assinar este documento, o aplicativo assinador local deve estar em execução.
              </p>
              <Button size="lg" className="gap-2" onClick={checkSigner}>
                <MonitorSmartphone className="h-4 w-4" /> Iniciar Assinatura
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Signer offline */}
        {step === 'signer' && !signerStatus.online && (
          <Card>
            <CardContent className="pt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Assinador não detectado</AlertTitle>
                <AlertDescription>
                  O aplicativo assinador local não está em execução em <code className="text-xs bg-muted px-1 py-0.5 rounded">localhost:8765</code>.
                  Inicie o assinador e tente novamente.
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="mt-4 w-full gap-2" onClick={checkSigner}>
                <RefreshCw className="h-4 w-4" /> Verificar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Select certificate */}
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
                    key={cert.thumbprint}
                    onClick={() => handleSign(cert)}
                    className="w-full text-left border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cert.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">CPF/CNPJ: {cert.cpf_cnpj}</p>
                        <p className="text-xs text-muted-foreground">Emitido por: {cert.issuer}</p>
                        <p className="text-xs text-muted-foreground">Validade: {cert.validade}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{cert.tipo}</Badge>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Signing in progress */}
        {step === 'assinando' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">{statusMsg}</p>
              </div>
              <Progress value={progress} className="h-2" />
              {selectedCert && (
                <p className="text-xs text-muted-foreground">Certificado: {selectedCert.subject}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Success */}
        {step === 'sucesso' && token && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Documento assinado com sucesso!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A assinatura digital foi aplicada e registrada.
                </p>
              </div>
              <Button size="lg" className="gap-2" asChild>
                <a href={getDownloadUrl(token)} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> Baixar PDF Assinado
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──

function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center w-full max-w-lg">{children}</div>
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
            <CardTitle className="text-base">{contrato.tipo_documento}</CardTitle>
            <CardDescription className="mt-1">
              {contrato.cedente_nome} — {contrato.cedente_cpf_cnpj}
            </CardDescription>
          </div>
          <Badge variant="secondary">{contrato.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Signatário:</span>
            <p className="font-medium text-foreground">{contrato.signatario_nome}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CPF/CNPJ:</span>
            <p className="font-medium text-foreground">{contrato.signatario_cpf_cnpj}</p>
          </div>
        </div>

        {contrato.observacao && (
          <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">{contrato.observacao}</p>
        )}

        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPdf(!showPdf)}>
          <FileText className="h-4 w-4" /> {showPdf ? 'Ocultar PDF' : 'Visualizar PDF'}
        </Button>

        {showPdf && (
          <div className="border rounded-lg overflow-hidden mt-2">
            <iframe src={pdfUrl} className="w-full h-[500px]" title="Preview do contrato" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
