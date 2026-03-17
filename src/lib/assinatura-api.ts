const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://goldsign.onrender.com';
const LOCAL_SIGNER_URL = import.meta.env.VITE_LOCAL_SIGNER_URL || 'http://localhost:8765';

// ── Backend API ──

export interface ContratoData {
  id: string;
  tipo_documento: string;
  cedente_nome: string;
  cedente_cpf_cnpj: string;
  signatario_nome: string;
  signatario_cpf_cnpj: string;
  status: string;
  criado_em: string;
  observacao?: string;
  documentos?: { id: string; nome: string; url_preview?: string }[];
}

export interface ValidacaoCertificadoResponse {
  valido: boolean;
  mensagem?: string;
}

export interface PreparacaoResponse {
  hash_b64: string;
  algoritmo: string;
}

export interface SubmissaoPayload {
  token_acesso: string;
  assinatura_cms_b64: string;
  cert_pem: string;
  cert_tipo: 'A1' | 'A3';
}

async function backendFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Erro ${res.status}`);
  }
  return res.json();
}

export async function checkBackendHealth() {
  return backendFetch<{ status: string }>('/api/health');
}

export async function fetchContrato(token: string) {
  return backendFetch<ContratoData>(`/api/assinatura/${token}`);
}

export async function fetchContratoPdfUrl(token: string) {
  return `${BACKEND_URL}/api/assinatura/${token}/pdf`;
}

export async function validarCertificado(token: string, cpfCnpj: string) {
  return backendFetch<ValidacaoCertificadoResponse>(
    `/api/assinatura/${token}/validar-certificado`,
    { method: 'POST', body: JSON.stringify({ cpf_cnpj: cpfCnpj }) }
  );
}

export async function prepararAssinatura(token: string) {
  return backendFetch<PreparacaoResponse>(
    `/api/assinatura/${token}/preparar`,
    { method: 'POST' }
  );
}

export async function submeterAssinatura(payload: SubmissaoPayload) {
  return backendFetch<{ sucesso: boolean; mensagem?: string }>(
    '/api/assinatura/submeter',
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function getDownloadUrl(token: string) {
  return `${BACKEND_URL}/api/assinatura/${token}/download-assinado`;
}

// ── Local Signer API ──

export interface SignerStatus {
  online: boolean;
  versao?: string;
}

export interface Certificado {
  subject: string;
  issuer: string;
  cpf_cnpj: string;
  validade: string;
  tipo: 'A1' | 'A3';
  serial: string;
  thumbprint: string;
}

export interface AssinaturaLocalPayload {
  hash_b64: string;
  algoritmo: string;
  thumbprint: string;
}

export interface AssinaturaLocalResponse {
  assinatura_cms_b64: string;
  cert_pem: string;
}

async function localFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LOCAL_SIGNER_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Erro no assinador local: ${res.status}`);
  }
  return res.json();
}

export async function checkSignerStatus(): Promise<SignerStatus> {
  try {
    const data = await localFetch<{ versao?: string }>('/api/status');
    return { online: true, versao: data.versao };
  } catch {
    return { online: false };
  }
}

export async function listarCertificados() {
  return localFetch<Certificado[]>('/api/certificados');
}

export async function assinarLocal(payload: AssinaturaLocalPayload) {
  return localFetch<AssinaturaLocalResponse>('/api/assinar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
