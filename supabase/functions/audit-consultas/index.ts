// Audit API: lista consultas para o sistema financeiro
// Auth: Bearer token via AUDIT_API_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const PLATFORM_LABEL: Record<string, string> = {
  serasa: 'Serasa',
  scr: 'SCR (HBI)',
  agrisk: 'AgRisk',
  smart: 'Smart',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: Bearer AUDIT_API_KEY
  const expected = Deno.env.get('AUDIT_API_KEY');
  if (!expected) {
    return json({ error: 'AUDIT_API_KEY not configured' }, 500);
  }
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== expected) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    const from = q.get('from'); // YYYY-MM-DD
    const to = q.get('to');
    const platform = q.get('platform'); // serasa | scr | agrisk | smart
    const userId = q.get('user_id');
    const consultaType = q.get('consulta_type');
    const status = q.get('status');
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(q.get('page_size') || '100', 10) || 100));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase
      .from('consulta_history')
      .select('id, user_id, cnpj, platform, consulta_type, consulta_label, status, entity_name, consulted_by_name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', from);
    if (to) {
      // include the entire 'to' day
      const toDate = /T/.test(to) ? to : `${to}T23:59:59.999Z`;
      query = query.lte('created_at', toDate);
    }
    if (platform) query = query.eq('platform', platform);
    if (userId) query = query.eq('user_id', userId);
    if (consultaType) query = query.eq('consulta_type', consultaType);
    if (status) query = query.eq('status', status);

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    query = query.range(fromIdx, toIdx);

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with user email/name from profiles
    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const profilesMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        profilesMap[p.user_id] = { name: p.name, email: p.email };
      });
    }

    const items = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      platform: r.platform,
      platform_label: PLATFORM_LABEL[r.platform] || r.platform,
      consulta_type: r.consulta_type,
      consulta_label: r.consulta_label,
      status: r.status,
      document: r.cnpj,
      entity_name: r.entity_name,
      user: {
        id: r.user_id,
        name: profilesMap[r.user_id]?.name || r.consulted_by_name || null,
        email: profilesMap[r.user_id]?.email || null,
      },
    }));

    const total = count ?? items.length;
    return json({
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
      filters: { from, to, platform, user_id: userId, consulta_type: consultaType, status },
      items,
    }, 200);
  } catch (e: any) {
    console.error('[audit-consultas] error', e);
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
