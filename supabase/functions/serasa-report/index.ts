import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    // Extract just the base URL (protocol + host), stripping any path
    const rawUrl = Deno.env.get('SERASA_API_URL') || 'https://uat-api.serasaexperian.com.br';
    const parsedUrl = new URL(rawUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais Serasa não configuradas' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Authenticate - get Bearer token
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
    console.log('Serasa auth response body (first 500):', authText.substring(0, 500));

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
      return new Response(JSON.stringify({ error: 'Resposta de autenticação Serasa inválida', details: authText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = authData.accessToken || authData.access_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Token de acesso não retornado pela Serasa', authResponse: authData }), {
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

    const cleanCpf = cpf.replace(/\D/g, '');

    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Document-Id': cleanCpf,
      },
    });

    const reportText = await reportRes.text();

    if (!reportRes.ok) {
      console.error('Serasa report error:', reportRes.status, reportText.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: `Erro ao consultar relatório Serasa: ${reportRes.status}`,
        details: reportText.substring(0, 500),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let reportData: any;
    try {
      reportData = JSON.parse(reportText);
    } catch {
      return new Response(JSON.stringify({ error: 'Resposta de relatório Serasa inválida', details: reportText.substring(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
