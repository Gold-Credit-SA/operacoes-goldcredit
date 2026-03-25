import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map consultaId to Serasa report names and default score models
const REPORT_MAP: Record<string, { reportName: string; type: 'PF' | 'PJ'; defaultScoreModel?: string; defaultOptionalFeatures?: string; segmentCode?: string }> = {
  serasa_basico_pf: { reportName: 'RELATORIO_BASICO_PF_PME', type: 'PF' },
  serasa_avancado_top_score_pf: { reportName: 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME', type: 'PF', defaultScoreModel: 'HRLD' },
  serasa_basico_pj: { reportName: 'RELATORIO_BASICO_PJ_PME', type: 'PJ', defaultScoreModel: 'H4PJ' },
  serasa_avancado_pj: { reportName: 'RELATORIO_AVANCADO_PJ_ANALITICO', type: 'PJ', defaultScoreModel: 'H4PJ', segmentCode: '028' },
};

/** Encode reportParameters as base64 for Serasa API */
function encodeReportParameters(params: Array<{ name: string; value: string }>): string {
  const payload = JSON.stringify({ reportParameters: params });
  return btoa(payload);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { document, consultaId, optionalFeatures, federalUnit, scoreModel, segmentCode } = body;

    // Backwards compatibility: accept old format too
    const doc = document || body.cpf || body.cnpj;
    const cId = consultaId || (body.reportName ? Object.entries(REPORT_MAP).find(([_, v]) => v.reportName === body.reportName)?.[0] : null) || 'serasa_basico_pf';

    if (!doc) {
      return new Response(JSON.stringify({ error: 'Documento é obrigatório (document)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanDoc = doc.replace(/\D/g, '');
    const isPF = cleanDoc.length === 11;
    const isPJ = cleanDoc.length === 14;

    if (!isPF && !isPJ) {
      return new Response(JSON.stringify({ error: 'Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reportConfig = REPORT_MAP[cId];
    if (!reportConfig) {
      return new Response(JSON.stringify({ error: `consultaId não reconhecido: ${cId}. Valores válidos: ${Object.keys(REPORT_MAP).join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate document type matches report type
    if (reportConfig.type === 'PF' && !isPF) {
      return new Response(JSON.stringify({ error: 'Relatório PF requer CPF (11 dígitos). Para CNPJ, use um relatório PJ.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reportConfig.type === 'PJ' && !isPJ) {
      return new Response(JSON.stringify({ error: 'Relatório PJ requer CNPJ (14 dígitos). Para CPF, use um relatório PF.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('SERASA_CLIENT_ID');
    const clientSecret = Deno.env.get('SERASA_CLIENT_SECRET');
    const rawUrl = Deno.env.get('SERASA_API_URL') || 'https://uat-api.serasaexperian.com.br';
    const parsedUrl = new URL(rawUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais Serasa não configuradas' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Authenticate
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const authUrl = `${baseUrl}/security/iam/v1/client-identities/login`;
    console.log('[serasa-report] Auth URL:', authUrl);

    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    const authText = await authRes.text();
    console.log('[serasa-report] Auth status:', authRes.status);

    if (!authRes.ok) {
      return new Response(JSON.stringify({ error: `Erro na autenticação Serasa: ${authRes.status}`, details: authText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let authData: any;
    try {
      authData = JSON.parse(authText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta de autenticação Serasa inválida' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Robust token extraction - handle all known field names from Serasa
    const accessToken = authData.accessToken || authData.AcessToken || authData.access_token || authData.token || authData.Token;
    const tokenType = authData.tokenType || authData.token_type || 'Bearer';
    if (!accessToken) {
      console.error('[serasa-report] Auth response keys:', Object.keys(authData));
      return new Response(JSON.stringify({ error: 'Token de acesso não retornado pela Serasa', authKeys: Object.keys(authData) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[serasa-report] Auth OK. Report:', reportConfig.reportName, '| consultaId:', cId);

    // Step 2: Build report URL based on PF vs PJ
    const reportPath = isPF
      ? '/credit-services/person-information-report/v1/creditreport'
      : '/credit-services/business-information-report/v1/reports';

    let reportUrl = `${baseUrl}${reportPath}?reportName=${reportConfig.reportName}`;

    // Add federalUnit - required by Serasa
    const uf = federalUnit || 'SP';
    reportUrl += `&federalUnit=${uf}`;

    // Optional features
    const effectiveOptionalFeatures = optionalFeatures || reportConfig.defaultOptionalFeatures;
    if (effectiveOptionalFeatures) {
      reportUrl += `&optionalFeatures=${effectiveOptionalFeatures}`;
    }

    // Build reportParameters for score model and segmentCode
    const reportParams: Array<{ name: string; value: string }> = [];

    // Use provided score model or default from config
    const effectiveScoreModel = scoreModel || reportConfig.defaultScoreModel;
    if (effectiveScoreModel) {
      reportParams.push({ name: 'SCORE', value: effectiveScoreModel });
    }

    // Add segmentCode for analytic reports
    const effectiveSegmentCode = segmentCode || reportConfig.segmentCode;
    if (effectiveSegmentCode) {
      reportParams.push({ name: 'SEGMENTO', value: effectiveSegmentCode });
    }

    // Encode and append reportParameters if any exist
    if (reportParams.length > 0) {
      const encoded = encodeReportParameters(reportParams);
      reportUrl += `&reportParameters=${encoded}`;
      console.log('[serasa-report] reportParameters (decoded):', JSON.stringify({ reportParameters: reportParams }));
    }

    console.log('[serasa-report] Report URL:', reportUrl);

    // Build headers - include all required Serasa headers
    const reportHeaders: Record<string, string> = {
      'Authorization': `${tokenType} ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Document-Id': cleanDoc,
    };

    // X-Retailer-Document-Id is the CNPJ of the company making the query (retailer/consultante)
    // Some Serasa contracts require this for analytic reports
    const retailerDoc = Deno.env.get('SERASA_RETAILER_DOCUMENT') || '';
    if (retailerDoc) {
      reportHeaders['X-Retailer-Document-Id'] = retailerDoc.replace(/\D/g, '');
    }

    // X-Cost-Center if configured
    const costCenter = Deno.env.get('SERASA_COST_CENTER') || '';
    if (costCenter) {
      reportHeaders['X-Cost-Center'] = costCenter;
    }

    console.log('[serasa-report] Headers:', JSON.stringify({
      ...reportHeaders,
      Authorization: `${tokenType} ***REDACTED***`,
    }));

    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: reportHeaders,
    });

    const reportText = await reportRes.text();

    if (!reportRes.ok) {
      console.error('[serasa-report] Report error:', reportRes.status, reportText.substring(0, 1000));

      let errorMessage = `Erro ao consultar relatório Serasa: ${reportRes.status}`;
      let errorDetails: any = null;
      try {
        const errArr = JSON.parse(reportText);
        errorDetails = errArr;
        if (Array.isArray(errArr) && errArr[0]?.message) {
          const msg = errArr[0].message;
          if (msg.includes('DOCUMENT_NOT_FOUND')) {
            errorMessage = isPF
              ? 'CPF não encontrado na base da Serasa Experian.'
              : 'CNPJ não encontrado na base da Serasa Experian.';
          } else if (msg.includes('INVALID-REQUEST') || msg.includes('412')) {
            errorMessage = `Requisição inválida pela Serasa: ${msg}. Verifique se o relatório ${reportConfig.reportName} está habilitado no contrato.`;
          } else {
            errorMessage = msg;
          }
        }
      } catch {}

      return new Response(JSON.stringify({ 
        error: errorMessage, 
        debug: {
          reportName: reportConfig.reportName,
          consultaId: cId,
          httpStatus: reportRes.status,
          errorDetails: errorDetails,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let reportData: any;
    try {
      reportData = JSON.parse(reportText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta de relatório Serasa inválida' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log which data blocks are present for debugging
    const topKeys = Object.keys(reportData || {});
    const reportObj = reportData?.reports?.[0] || reportData;
    const reportKeys = Object.keys(reportObj || {});
    console.log('[serasa-report] Success for', cId, '| Top keys:', topKeys.join(','), '| Report keys:', reportKeys.join(','));
    
    // Check for behavioral/positive data presence
    const hasBehavioral = !!(reportObj?.behavioralData || reportObj?.positiveData);
    const hasOptionalFeatures = !!reportObj?.optionalFeatures;
    console.log('[serasa-report] hasBehavioralData:', hasBehavioral, '| hasOptionalFeatures:', hasOptionalFeatures);

    return new Response(JSON.stringify({ data: reportData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[serasa-report] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
