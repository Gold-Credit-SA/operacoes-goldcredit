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
    console.log('Authenticating with Serasa...');

    const authRes = await fetch(`${baseUrl}/security/iam/v1/client-identities/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!authRes.ok) {
      const authError = await authRes.text();
      console.error('Serasa auth error:', authRes.status, authError);
      return new Response(JSON.stringify({ error: `Erro na autenticação Serasa: ${authRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authData = await authRes.json();
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
