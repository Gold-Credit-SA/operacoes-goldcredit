// Edge function crm-send-prospect — envia um prospect para o CRM externo.
//
// Lê a URL e o token da tabela `crm_settings` (singleton id=1). Caso o
// secret CRM_API_TOKEN esteja configurado no projeto, ele tem
// precedência sobre o token armazenado em DB — assim o admin pode
// "promover" o token para secret sem mexer no front.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface RequestBody {
  empresa?: string;
  cnpj?: string;
  dadosEmpresa?: unknown;
  consultaScr?: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Valida usuário
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Sessão inválida' }, 401);

    const body = (await req.json()) as RequestBody;
    if (!body?.cnpj || !body?.empresa) {
      return json({ error: 'Campos obrigatórios: empresa e cnpj.' }, 400);
    }

    // Lê configs com service role (RLS de admin não bloqueia)
    const { data: settings, error: settingsErr } = await supabase
      .from('crm_settings')
      .select('url, api_token')
      .eq('id', 1)
      .maybeSingle();

    if (settingsErr) return json({ error: 'Falha ao ler configuração do CRM.' }, 500);

    const url = settings?.url?.trim();
    const token = Deno.env.get('CRM_API_TOKEN') || settings?.api_token?.trim() || '';

    if (!url) return json({ error: 'URL do CRM não configurada nas Configurações.' }, 400);
    if (!token) return json({ error: 'Token do CRM não configurado.' }, 400);

    const endpoint = url.replace(/\/$/, '') + '/api/public/prospects-internos';
    const payload = {
      empresa: body.empresa,
      cnpj: body.cnpj,
      dadosEmpresa: body.dadosEmpresa ?? null,
      consultaScr: body.consultaScr ?? null,
      enviadoEm: new Date().toISOString(),
    };

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    if (!resp.ok) {
      return json({
        error: `CRM retornou ${resp.status}`,
        details: parsed,
      }, 200); // HTTP 200 para o front conseguir ler o erro de negócio
    }

    return json({ success: true, response: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[crm-send-prospect] uncaught:', err);
    return json({ error: message }, 500);
  }
});
