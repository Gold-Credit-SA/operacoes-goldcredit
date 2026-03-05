import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HBI_USER_ID = 'be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4';

function getPreviousMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function authenticate(apiUrl: string): Promise<string> {
  const clientId = Deno.env.get('HBI_CLIENT_ID');
  const clientSecret = Deno.env.get('HBI_CLIENT_SECRET');
  const grantType = Deno.env.get('HBI_GRANT_TYPE');
  const scope = Deno.env.get('HBI_SCOPE');

  if (!clientId || !clientSecret || !grantType || !scope) {
    throw new Error('Credenciais HBI não configuradas.');
  }

  const res = await fetch(`${apiUrl}/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user': HBI_USER_ID,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
      scope: scope,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha na autenticação HBI (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data?.data?.jwt || data?.access_token || data?.token;
  if (!token) {
    throw new Error(`Token não retornado pela API HBI.`);
  }
  return token;
}

async function querySCR(apiUrl: string, token: string, cnpj: string): Promise<any> {
  const baseDateInitial = getPreviousMonth();
  
  const url = `${apiUrl}/query/scr/v2/new/${cnpj}`;
  const body = {
    baseDateInitial,
    uuidTypeScr: HBI_USER_ID,
  };
  
  console.log(`[hbi-scr] POST ${url}`);
  console.log(`[hbi-scr] Body: ${JSON.stringify(body)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`[hbi-scr] Response status: ${res.status}, body: ${text.substring(0, 500)}`);
  
  if (!res.ok) {
    throw new Error(`Erro na consulta SCR (${res.status}): ${text}`);
  }

  return JSON.parse(text);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro na consulta SCR (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data;
}

async function pollResults(apiUrl: string, token: string, cnpj: string): Promise<any> {
  const maxAttempts = 10;
  const delayMs = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delayMs));

    const res = await fetch(`${apiUrl}/query/list/v2?service=SCR&q=${cnpj}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'user': HBI_USER_ID,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Polling attempt ${i + 1} failed (${res.status}): ${text}`);
      continue;
    }

    const data = await res.json();

    // Check if we have results - adapt based on actual API response structure
    const results = Array.isArray(data) ? data : data?.data || data?.results || data?.content;
    if (results && (Array.isArray(results) ? results.length > 0 : true)) {
      return Array.isArray(results) ? results[0] : results;
    }
  }

  throw new Error('Tempo esgotado aguardando resultado da consulta SCR. Tente novamente em alguns minutos.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj || typeof cnpj !== 'string') {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = Deno.env.get('HBI_API_URL');
    if (!apiUrl) {
      throw new Error('URL da API HBI não configurada.');
    }

    console.log(`[hbi-scr] Autenticando na API HBI...`);
    const token = await authenticate(apiUrl);

    console.log(`[hbi-scr] Enviando consulta SCR para CNPJ: ${cnpj}`);
    const queryResult = await querySCR(apiUrl, token, cnpj);

    // Check if the query returned data directly or needs polling
    const hasData = queryResult && Object.keys(queryResult).length > 0 &&
      !queryResult.queued && !queryResult.pending;

    let finalResult;
    if (hasData) {
      console.log(`[hbi-scr] Resultado retornado diretamente.`);
      finalResult = queryResult;
    } else {
      console.log(`[hbi-scr] Resultado pendente, iniciando polling...`);
      finalResult = await pollResults(apiUrl, token, cnpj);
    }

    return new Response(
      JSON.stringify({ success: true, data: finalResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[hbi-scr] Erro:`, err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
