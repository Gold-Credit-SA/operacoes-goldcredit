import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MASTER_EMAIL = 'renan@goldcreditsa.com.br';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userEmail = userData.user.email || '';
    const userId = userData.user.id;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const payload = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
    const action = payload.action || 'get';

    if (action === 'get') {
      const { data, error } = await supabaseAdmin
        .from('goldsign_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: data || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userEmail !== MASTER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Access denied. Only master admin can update signing settings.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clear') {
      const { error } = await supabaseAdmin
        .from('goldsign_settings')
        .upsert({
          id: 1,
          gold_credit_cert_subject_cn: null,
          gold_credit_cert_document: null,
          gold_credit_cert_serial_number: null,
          gold_credit_cert_tipo: null,
          gold_credit_cert_issuer_cn: null,
          gold_credit_cert_linked_by: null,
          gold_credit_cert_linked_by_email: null,
          gold_credit_cert_linked_at: null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set') {
      const documento = String(payload.gold_credit_cert_document || '').replace(/\D/g, '');
      if (!documento) {
        return new Response(JSON.stringify({ error: 'Documento do certificado e obrigatorio.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabaseAdmin
        .from('goldsign_settings')
        .upsert({
          id: 1,
          gold_credit_cert_subject_cn: payload.gold_credit_cert_subject_cn || null,
          gold_credit_cert_document: documento,
          gold_credit_cert_serial_number: payload.gold_credit_cert_serial_number || null,
          gold_credit_cert_tipo: payload.gold_credit_cert_tipo || null,
          gold_credit_cert_issuer_cn: payload.gold_credit_cert_issuer_cn || null,
          gold_credit_cert_linked_by: userId || null,
          gold_credit_cert_linked_by_email: userEmail || null,
          gold_credit_cert_linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      const { data } = await supabaseAdmin
        .from('goldsign_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      return new Response(JSON.stringify({ success: true, data: data || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
