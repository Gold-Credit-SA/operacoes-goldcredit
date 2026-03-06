import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, reportName, optionalFeatures } = await req.json();

    if (!cpf) {
      return new Response(JSON.stringify({ error: 'CPF é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('SERASA_CLIENT_ID');
    const clientSecret = Deno.env.get('SERASA_CLIENT_SECRET');
    const baseUrl = Deno.env.get('SERASA_API_URL') || 'https://uat-api.serasaexperian.com.br';

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais Serasa não configuradas' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Authenticate - get Bearer token
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const authUrl = `${baseUrl}/security/iam/v1/client-identities/login`;
    console.log('Auth URL:', authUrl);
    console.log('Base URL from env:', baseUrl);

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
    console.log('Serasa auth response body (first 500):', authText.substring(0, 500));

    if (!authRes.ok) {
      console.error('Serasa auth error:', authRes.status, authText.substring(0, 300));
      return new Response(JSON.stringify({ error: `Erro na autenticação Serasa: ${authRes.status}`, details: authText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let authData: any;
    try {
      authData = JSON.parse(authText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta de autenticação Serasa inválida', details: authText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = authData.accessToken || authData.access_token;

    if (!accessToken) {
      console.error('No access token in auth response:', JSON.stringify(authData));
      return new Response(JSON.stringify({ error: 'Token de acesso não retornado pela Serasa' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Serasa auth successful, fetching report...');

    // Step 2: Fetch credit report
    const report = reportName || 'PERFIL_DE_CREDITO_BASICO_PF';
    let reportUrl = `${baseUrl}/credit-services/person-information-report/v1/creditreport?reportName=${report}`;

    if (optionalFeatures) {
      reportUrl += `&optionalFeatures=${optionalFeatures}`;
    }

    // Clean CPF - only digits
    const cleanCpf = cpf.replace(/\D/g, '');

    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Document-Id': cleanCpf,
      },
    });

    if (!reportRes.ok) {
      const reportError = await reportRes.text();
      console.error('Serasa report error:', reportRes.status, reportError);
      return new Response(JSON.stringify({ 
        error: `Erro ao consultar relatório Serasa: ${reportRes.status}`,
        details: reportError,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reportData = await reportRes.json();
    console.log('Serasa report fetched successfully');

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
