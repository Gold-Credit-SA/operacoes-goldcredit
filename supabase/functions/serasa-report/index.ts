import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type DocumentType = 'cpf' | 'cnpj';
type EndpointType = 'person' | 'business';

interface SerasaReportConfig {
  id: string;
  documentType: DocumentType;
  endpointType: EndpointType;
  reportName: string;
  reportParameters: string;
  optionalFeatures?: string;
}

const SERASA_REPORTS: Record<string, SerasaReportConfig> = {
  serasa_basico_pj: {
    id: 'serasa_basico_pj',
    documentType: 'cnpj',
    endpointType: 'business',
    reportName: 'RELATORIO_BASICO_PJ_PME',
    reportParameters:
      'ewogICJyZXBvcnRQYXJhbWV0ZXJzIiA6IFsgewogICAgIm5hbWUiIDogIkxJTUlURV9DUkVESVRPIiwKICAgICJ2YWx1ZSIgOiAiSExDMyIKICB9LCB7CiAgICAibmFtZSIgOiAiU0NPUkUiLAogICAgInZhbHVlIiA6ICJIUEpNIgogIH0sIHsKICAgICJuYW1lIiA6ICJSSVNDT19OT1ZBU19FTVBSRVNBUyIsCiAgICAidmFsdWUiIDogIkhORTMiCiAgfSwgewogICAgIm5hbWUiIDogIlBPTlRVQUxJREFERV9QQUdBTUVOVE8iLAogICAgInZhbHVlIiA6ICJISVAzIgogIH0gXQp9PQ',
  },
  serasa_avancado_pj_analitico: {
    id: 'serasa_avancado_pj_analitico',
    documentType: 'cnpj',
    endpointType: 'business',
    reportName: 'RELATORIO_AVANCADO_PJ_PME_ANALITICO',
    reportParameters:
      'ewogICJyZXBvcnRQYXJhbWV0ZXJzIiA6IFsgewogICAgIm5hbWUiIDogIkxJTUlURV9DUkVESVRPIiwKICAgICJ2YWx1ZSIgOiAiSExDMyIKICB9LCB7CiAgICAibmFtZSIgOiAiUklTQ09fTk9WQVNfRU1QUkVTQVMiLAogICAgInZhbHVlIiA6ICJITkUzIgogIH0sIHsKICAgICJuYW1lIiA6ICJQT05UVUFMSURBREVfUEFHQU1FTlRPIiwKICAgICJ2YWx1ZSIgOiAiSElQMyIKICB9LCB7CiAgICAibmFtZSIgOiAic2VnbWVudENvZGUiLAogICAgInZhbHVlIiA6ICIwMjgiCiAgfSBdCn0',
  },
  serasa_basico_pf: {
    id: 'serasa_basico_pf',
    documentType: 'cpf',
    endpointType: 'person',
    reportName: 'RELATORIO_BASICO_PF_PME',
    reportParameters: 'ewogICJyZXBvcnRQYXJhbWV0ZXJzIiA6IFsgewogICAgIm5hbWUiIDogIlJFTkRBX0VTVElNQURBX1BGIiwKICAgICJ2YWx1ZSIgOiAiSFJQNSIKICB9IF0KfQ',
    optionalFeatures: 'HISTORICO_PAGAMENTO, MAIS_ANOTACOES_1000, RENDA_ESTIMADA_PF',
  },
  serasa_avancado_top_score_pf: {
    id: 'serasa_avancado_top_score_pf',
    documentType: 'cpf',
    endpointType: 'person',
    reportName: 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME',
    reportParameters: 'ewogICJyZXBvcnRQYXJhbWV0ZXJzIiA6IFsgewogICAgIm5hbWUiIDogIlJFTkRBX0VTVElNQURBX1BGIiwKICAgICJ2YWx1ZSIgOiAiSFJQNSIKICB9IF0KfT0',
    optionalFeatures: 'HISTORICO_PAGAMENTO',
  },
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getReportPath(endpointType: EndpointType): string {
  return endpointType === 'business'
    ? '/credit-services/business-information-report/v1/reports'
    : '/credit-services/person-information-report/v1/creditreport';
}

function getCleanDocument(document: string): string {
  return document.replace(/\D/g, '');
}

async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const authUrl = `${baseUrl}/security/iam/v1/client-identities/login`;
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
  });

  const authText = await authRes.text();

  if (!authRes.ok) {
    throw new Error(`Erro na autenticacao Serasa: ${authRes.status} ${authText.substring(0, 300)}`);
  }

  let authData: Record<string, unknown>;
  try {
    authData = JSON.parse(authText);
  } catch {
    throw new Error(`Resposta de autenticacao Serasa invalida: ${authText.substring(0, 300)}`);
  }

  const accessToken = String(authData.accessToken || authData.access_token || '');
  if (!accessToken) {
    throw new Error('Token de acesso nao retornado pela Serasa');
  }

  const expiresInRaw = Number(authData.expiresIn || authData.expires_in || 3600);
  const expiresInMs = Number.isFinite(expiresInRaw) ? expiresInRaw * 1000 : 3600 * 1000;
  cachedToken = {
    value: accessToken,
    expiresAt: Date.now() + expiresInMs,
  };

  return accessToken;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document, consultaId } = await req.json();

    if (!document) {
      return jsonResponse({ error: 'CPF ou CNPJ e obrigatorio' }, 400);
    }

    if (!consultaId || !SERASA_REPORTS[consultaId]) {
      return jsonResponse({ error: 'Consulta Serasa invalida' }, 400);
    }

    const config = SERASA_REPORTS[consultaId];
    const cleanDocument = getCleanDocument(String(document));

    if (config.documentType === 'cpf' && cleanDocument.length !== 11) {
      return jsonResponse({ error: 'Esta consulta requer CPF com 11 digitos' }, 400);
    }

    if (config.documentType === 'cnpj' && cleanDocument.length !== 14) {
      return jsonResponse({ error: 'Esta consulta requer CNPJ com 14 digitos' }, 400);
    }

    const clientId = Deno.env.get('SERASA_CLIENT_ID');
    const clientSecret = Deno.env.get('SERASA_CLIENT_SECRET');
    const rawUrl = Deno.env.get('SERASA_API_URL') || 'https://uat-api.serasaexperian.com.br';
    const parsedUrl = new URL(rawUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Credenciais Serasa nao configuradas' }, 500);
    }

    const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);
    const reportUrl = new URL(`${baseUrl}${getReportPath(config.endpointType)}`);
    reportUrl.searchParams.set('reportName', config.reportName);
    reportUrl.searchParams.set('reportParameters', config.reportParameters);
    if (config.optionalFeatures) {
      reportUrl.searchParams.set('optionalFeatures', config.optionalFeatures);
    }

    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Document-Id': cleanDocument,
      },
    });

    const reportText = await reportRes.text();

    if (!reportRes.ok) {
      let errorMessage = `Erro ao consultar relatorio Serasa: ${reportRes.status}`;

      try {
        const errorData = JSON.parse(reportText);
        const firstError = Array.isArray(errorData) ? errorData[0] : errorData;
        const rawMessage = String(firstError?.message || firstError?.error || '');
        if (rawMessage.includes('DOCUMENT_NOT_FOUND')) {
          errorMessage = 'Documento nao encontrado na base da Serasa Experian.';
        } else if (rawMessage) {
          errorMessage = rawMessage;
        }
      } catch {
        if (reportText) {
          errorMessage = `${errorMessage}: ${reportText.substring(0, 300)}`;
        }
      }

      return jsonResponse({ error: errorMessage });
    }

    let reportData: unknown;
    try {
      reportData = JSON.parse(reportText);
    } catch {
      return jsonResponse(
        {
          error: 'Resposta de relatorio Serasa invalida',
          details: reportText.substring(0, 300),
        },
        502,
      );
    }

    return jsonResponse({ data: reportData });
  } catch (err) {
    console.error('serasa-report error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});
