import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map consultaId to Serasa report names and default score models
const REPORT_MAP: Record<string, { reportName: string; type: 'PF' | 'PJ'; defaultScoreModel?: string }> = {
  serasa_basico_pf: { reportName: 'RELATORIO_BASICO_PF_PME', type: 'PF' },
  serasa_avancado_top_score_pf: { reportName: 'RELATORIO_AVANCADO_TOP_SCORE_PF_PME', type: 'PF', defaultScoreModel: 'HRLD' },
  serasa_basico_pj: { reportName: 'RELATORIO_BASICO_PJ_PME', type: 'PJ' },
  serasa_avancado_pj: { reportName: 'RELATORIO_AVANCADO_PJ_PME', type: 'PJ', defaultScoreModel: 'H4PJ' },
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
    const { document, consultaId, optionalFeatures, federalUnit, scoreModel } = body;

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
    console.log('Calling auth URL:', authUrl);

    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    const authText = await authRes.text();
    console.log('Serasa auth response status:', authRes.status);

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

    const accessToken = authData.accessToken || authData.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Token de acesso não retornado pela Serasa' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Serasa auth successful, fetching report:', reportConfig.reportName);

    // Step 2: Build report URL based on PF vs PJ
    const reportPath = isPF
      ? '/credit-services/person-information-report/v1/creditreport'
      : '/credit-services/business-information-report/v1/creditreport';

    let reportUrl = `${baseUrl}${reportPath}?reportName=${reportConfig.reportName}`;

    // Add federalUnit - required by Serasa for PF reports
    const uf = federalUnit || 'SP';
    reportUrl += `&federalUnit=${uf}`;

    if (optionalFeatures) {
      reportUrl += `&optionalFeatures=${optionalFeatures}`;
    }

    // Build reportParameters for score model if applicable
    const reportParams: Array<{ name: string; value: string }> = [];

    // Use provided score model or default from config
    const effectiveScoreModel = scoreModel || reportConfig.defaultScoreModel;
    if (effectiveScoreModel) {
      reportParams.push({ name: 'SCORE', value: effectiveScoreModel });
    }

    // Encode and append reportParameters if any exist
    if (reportParams.length > 0) {
      const encoded = encodeReportParameters(reportParams);
      reportUrl += `&reportParameters=${encoded}`;
      console.log('reportParameters (decoded):', JSON.stringify({ reportParameters: reportParams }));
    }

    console.log('Report URL:', reportUrl);

    // Build headers
    const reportHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Document-Id': cleanDoc,
    };

    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: reportHeaders,
    });

    const reportText = await reportRes.text();

    if (!reportRes.ok) {
      console.error('Serasa report error:', reportRes.status, reportText.substring(0, 500));

      let errorMessage = `Erro ao consultar relatório Serasa: ${reportRes.status}`;
      try {
        const errArr = JSON.parse(reportText);
        if (Array.isArray(errArr) && errArr[0]?.message) {
          const msg = errArr[0].message;
          if (msg.includes('DOCUMENT_NOT_FOUND')) {
            errorMessage = isPF
              ? 'CPF não encontrado na base da Serasa Experian.'
              : 'CNPJ não encontrado na base da Serasa Experian.';
          } else {
            errorMessage = msg;
          }
        }
      } catch {}

      return new Response(JSON.stringify({ error: errorMessage }), {
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

    console.log('Serasa report fetched successfully for', cId);

    return new Response(JSON.stringify({ data: reportData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('serasa-report error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
