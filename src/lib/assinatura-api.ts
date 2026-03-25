import { supabase } from '@/integrations/supabase/client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://goldsign.onrender.com';
const LOCAL_SIGNER_URL = import.meta.env.VITE_LOCAL_SIGNER_URL || 'http://localhost:8765';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getBrowserOrigin() {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  return window.location.origin;
}

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function normalizePublicFlowUrl(rawLink: string, fallbackPath: string) {
  const browserOrigin = getBrowserOrigin();

  try {
    const parsed = new URL(rawLink);
    if (!isLocalhostHost(parsed.hostname)) {
      return parsed.toString();
    }
    if (browserOrigin) {
      return `${browserOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return rawLink;
  } catch {
    if (browserOrigin) {
      return `${browserOrigin}/${fallbackPath}/${rawLink}`;
    }
    return `/${fallbackPath}/${rawLink}`;
  }
}

export function getPublicSigningUrl(token: string, rawLink?: string) {
  if (rawLink) {
    return normalizePublicFlowUrl(rawLink, 'assinar');
  }
  const browserOrigin = getBrowserOrigin();
  return browserOrigin ? `${browserOrigin}/assinar/${token}` : `/assinar/${token}`;
}

export function getPublicOperationUrl(bundleToken: string, rawLink?: string) {
  if (rawLink) {
    return normalizePublicFlowUrl(rawLink, 'assinar-operacao');
  }
  const browserOrigin = getBrowserOrigin();
  return browserOrigin
    ? `${browserOrigin}/assinar-operacao/${bundleToken}`
    : `/assinar-operacao/${bundleToken}`;
}

export interface ContratoData {
  solicitacao_id: string;
  documento_id: string;
  operacao_id?: string;
  bundle_token?: string;
  operacao_total_documentos?: number;
  operacao_documento_indice?: number;
  titulo: string;
  nome_arquivo: string;
  papel_assinatura?: 'cedente' | 'cessionaria_gold_credit' | 'responsavel_solidario';
  signatario_nome: string;
  signatario_email: string;
  mensagem?: string;
  assinatura_obrigatoria_tipo?: string;
  assinatura_obrigatoria_cpf_cnpj?: string;
  assinatura_obrigatoria_nome?: string;
  status: string;
  expira_em: string;
}

export interface SolicitacaoResumo {
  id: string;
  documento_id: string;
  operacao_id?: string;
  bundle_token?: string;
  operacao_total_documentos?: number;
  operacao_documento_indice?: number;
  titulo: string;
  nome_arquivo: string;
  papel_assinatura?: 'cedente' | 'cessionaria_gold_credit' | 'responsavel_solidario';
  signatario_nome: string;
  signatario_email: string;
  assinatura_obrigatoria_cpf_cnpj?: string;
  mensagem?: string;
  status: string;
  criado_em: string;
  assinado_em?: string;
  expira_em?: string;
  token_acesso: string;
  tem_assinado: boolean;
  link_assinatura?: string;
  link_operacao?: string;
}

export interface ValidacaoCertificadoResponse {
  autorizado: boolean;
  cert_doc: string;
  cliente_nome?: string;
  assinatura_obrigatoria_cpf_cnpj?: string;
  assinatura_obrigatoria_nome?: string;
  mensagem?: string;
}

export interface PreparacaoResponse {
  hash_bytes_b64: string;
  hash_hex: string;
  algoritmo: string;
  documento_id: string;
  solicitacao_id: string;
}

export interface SubmissaoPayload {
  token_acesso: string;
  assinatura_cms_b64: string;
  cert_pem: string;
  cert_tipo: 'A1' | 'A3';
}

async function backendFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
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

export function fetchContratoPdfUrl(token: string) {
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

export interface CriarSolicitacaoDocumentoPayload {
  arquivo: File;
  titulo: string;
  tipo_documento?: string;
  contrato_mae?: boolean;
  assinatura_pagina_cedente?: number;
  assinatura_x_cedente?: number;
  assinatura_y_cedente?: number;
  assinatura_largura_cedente?: number;
  assinatura_altura_cedente?: number;
  assinatura_pagina_gc?: number;
  assinatura_x_gc?: number;
  assinatura_y_gc?: number;
  assinatura_largura_gc?: number;
  assinatura_altura_gc?: number;
  assinatura_pagina_rs?: number;
  assinatura_x_rs?: number;
  assinatura_y_rs?: number;
  assinatura_largura_rs?: number;
  assinatura_altura_rs?: number;
}

export interface CriarSolicitacaoPayload {
  documentos: CriarSolicitacaoDocumentoPayload[];
  signatario_nome: string;
  signatario_email: string;
  signatario_cpf_cnpj: string;
  mensagem?: string;
  incluir_assinatura_gold_credit?: boolean;
  responsavel_solidario_nome?: string;
  responsavel_solidario_email?: string;
  responsavel_solidario_cpf_cnpj?: string;
}

export interface CriarSolicitacaoItem {
  id: string;
  documento_id: string;
  titulo: string;
  nome_arquivo: string;
  token_acesso: string;
  papel_assinatura?: 'cedente' | 'cessionaria_gold_credit' | 'responsavel_solidario';
  signatario_nome?: string;
  signatario_email?: string;
  assinatura_obrigatoria_cpf_cnpj?: string;
  status: string;
  expira_em: string;
  link_assinatura: string;
}

export interface CriarSolicitacaoResponse extends CriarSolicitacaoItem {
  solicitacoes?: CriarSolicitacaoItem[];
  operacao_id?: string;
  total_documentos?: number;
  links_operacao?: {
    papel_assinatura: 'cedente' | 'responsavel_solidario' | 'cessionaria_gold_credit';
    nome?: string;
    token: string;
    link: string;
    total_documentos?: number;
  }[];
}

export async function listarSolicitacoes(limit = 50) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/goldsign-proxy?target=${encodeURIComponent(`/api/assinatura/listar?limit=${limit}`)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Erro ${res.status}`);
  }

  return res.json() as Promise<SolicitacaoResumo[]>;
}

export async function criarSolicitacao(payload: CriarSolicitacaoPayload) {
  const formData = new FormData();
  for (const documento of payload.documentos) {
    formData.append('arquivos', documento.arquivo);
  }
  formData.append('documentos_json', JSON.stringify(payload.documentos.map((documento) => ({
    titulo: documento.titulo,
    tipo_documento: documento.tipo_documento || '',
    contrato_mae: Boolean(documento.contrato_mae),
    assinatura_pagina_cedente: documento.assinatura_pagina_cedente ?? 0,
    assinatura_x_cedente: documento.assinatura_x_cedente ?? 0.06,
    assinatura_y_cedente: documento.assinatura_y_cedente ?? 0.06,
    assinatura_largura_cedente: documento.assinatura_largura_cedente ?? 0.42,
    assinatura_altura_cedente: documento.assinatura_altura_cedente ?? 0.10,
    assinatura_pagina_gc: documento.assinatura_pagina_gc ?? 0,
    assinatura_x_gc: documento.assinatura_x_gc ?? 0.06,
    assinatura_y_gc: documento.assinatura_y_gc ?? 0.41,
    assinatura_largura_gc: documento.assinatura_largura_gc ?? 0.34,
    assinatura_altura_gc: documento.assinatura_altura_gc ?? 0.07,
    assinatura_pagina_rs: documento.assinatura_pagina_rs ?? 0,
    assinatura_x_rs: documento.assinatura_x_rs ?? 0.54,
    assinatura_y_rs: documento.assinatura_y_rs ?? 0.08,
    assinatura_largura_rs: documento.assinatura_largura_rs ?? 0.42,
    assinatura_altura_rs: documento.assinatura_altura_rs ?? 0.10,
  }))));
  formData.append('signatario_nome', payload.signatario_nome);
  formData.append('signatario_email', payload.signatario_email);
  formData.append('signatario_cpf_cnpj', payload.signatario_cpf_cnpj);
  formData.append('mensagem', payload.mensagem || '');
  formData.append('incluir_assinatura_gold_credit', String(Boolean(payload.incluir_assinatura_gold_credit)));
  if (payload.responsavel_solidario_email) {
    formData.append('responsavel_solidario_nome', payload.responsavel_solidario_nome ?? '');
    formData.append('responsavel_solidario_email', payload.responsavel_solidario_email);
    formData.append('responsavel_solidario_cpf_cnpj', payload.responsavel_solidario_cpf_cnpj ?? '');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/goldsign-proxy?target=${encodeURIComponent('/api/assinatura/criar')}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Erro ${res.status}`);
  }
  return res.json() as Promise<CriarSolicitacaoResponse>;
}

export interface OperacaoPublicaDocumento {
  solicitacao_id: string;
  documento_id: string;
  token_acesso: string;
  titulo: string;
  nome_arquivo: string;
  status: string;
  mensagem?: string;
  papel_assinatura?: 'cedente' | 'responsavel_solidario' | 'cessionaria_gold_credit';
  operacao_documento_indice?: number;
  tem_assinado?: boolean;
}

export interface OperacaoPublicaData {
  bundle_token: string;
  operacao_id?: string;
  papel_assinatura?: 'cedente' | 'responsavel_solidario' | 'cessionaria_gold_credit';
  signatario_nome?: string;
  signatario_email?: string;
  signatario_cpf_cnpj?: string;
  total_documentos: number;
  total_assinados: number;
  total_pendentes: number;
  documentos: OperacaoPublicaDocumento[];
}

export async function fetchOperacao(bundleToken: string) {
  return backendFetch<OperacaoPublicaData>(`/api/assinatura/operacao/${bundleToken}`);
}

export interface SignerStatus {
  online: boolean;
  versao?: string;
}

export interface Certificado {
  cert_id: string;
  subject_cn: string;
  issuer_cn: string;
  cpf_cnpj: string;
  not_after: string;
  tipo: 'A1' | 'A3';
  serial_number?: string;
  valido?: boolean;
}

export interface AssinaturaLocalPayload {
  hash_b64: string;
  algoritmo: string;
  cert_id: string;
}

export interface AssinaturaLocalResponse {
  assinatura_cms_b64: string;
  cert_pem: string;
  cert_tipo: 'A1' | 'A3';
}

async function localFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${LOCAL_SIGNER_URL}${path}`, {
    ...options,
    headers,
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
  const data = await localFetch<{
    sucesso: boolean;
    certificados?: Certificado[];
    erro?: string;
  }>('/api/certificados');

  if (!data.sucesso) {
    throw new Error(data.erro || 'Nao foi possivel listar os certificados.');
  }

  return data.certificados || [];
}

export async function assinarLocal(payload: AssinaturaLocalPayload) {
  const data = await localFetch<
    ({ sucesso: true } & AssinaturaLocalResponse) |
    { sucesso: false; erro?: string }
  >('/api/assinar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!data.sucesso) {
    throw new Error('erro' in data && data.erro ? data.erro : 'Falha ao assinar com o certificado local.');
  }

  return data;
}
