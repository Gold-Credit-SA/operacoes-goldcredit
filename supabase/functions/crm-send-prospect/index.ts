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
  consultaSerasa?: unknown;
  palavrasChaveDetectadas?: unknown;
  origem?: string;
  scrHistoryId?: string;
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

    const url = settings?.url?.trim() || 'https://crm.goldcreditcapital.com.br';
    const token = Deno.env.get('CRM_API_TOKEN') || settings?.api_token?.trim() || '';

    if (!token) return json({ error: 'Token do CRM não configurado.' }, 400);

    // Bloqueia reenvio: já existe registro para este CNPJ
    const { data: existing } = await supabase
      .from('crm_prospect_sends')
      .select('id, sent_at, sent_by_name')
      .eq('cnpj', body.cnpj)
      .maybeSingle();
    if (existing) {
      return json({
        error: 'Este prospect já foi enviado ao CRM anteriormente.',
        alreadySent: true,
        sentAt: (existing as any).sent_at,
        sentBy: (existing as any).sent_by_name,
      }, 200);
    }

    const origem = body.origem ?? 'operacional';
    const endpoint = 'https://vmwpnnafceyswzfdbuie.supabase.co/functions/v1/prospects-internos-ingest';
    const payload = {
      empresa: body.empresa,
      cnpj: body.cnpj,
      dados_empresa: body.dadosEmpresa ?? null,
      consulta_scr: body.consultaScr ?? null,
      consulta_serasa: body.consultaSerasa ?? null,
      status: 'novo',
      palavras_chave_detectadas: body.palavrasChaveDetectadas ?? null,
      origem,
      enviado_em: new Date().toISOString(),
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
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    console.log('[crm-send-prospect] CRM status:', resp.status, 'body:', parsed);

    const httpStatus = resp.status;
    const okFlag = parsed && typeof parsed === 'object' && parsed.ok === true;
    const success = httpStatus === 201 && okFlag;

    if (!success) {
      let message = `CRM retornou ${httpStatus}`;
      if (httpStatus === 401) {
        message = 'Token inválido ou diferente do configurado no CRM';
      } else if (httpStatus === 400) {
        message = 'Payload inválido — confira empresa, cnpj, dados_empresa e consulta_scr';
      } else if (parsed && typeof parsed === 'object' && (parsed.error || parsed.message)) {
        message = String(parsed.error || parsed.message);
      }
      return json({
        success: false,
        error: message,
        httpStatus,
        details: parsed,
      }, 200);
    }

    // Registra envio bem-sucedido (service role bypassa RLS).
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const sentByName = (profile as any)?.name || (profile as any)?.email || userData.user.email || null;

    await supabase.from('crm_prospect_sends').insert({
      cnpj: body.cnpj,
      empresa: body.empresa,
      sent_by: userData.user.id,
      sent_by_name: sentByName,
      origem,
      scr_history_id: body.scrHistoryId ?? null,
      request_payload: payload,
      response_payload: parsed,
    });

    return json({ success: true, httpStatus, response: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[crm-send-prospect] uncaught:', err);
    return json({ error: message }, 500);
  }
});
