import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Per-request client connection (serverless-safe, avoids idle pooled sessions)
const externalDbConfig = {
  hostname: Deno.env.get("EXTERNAL_DB_HOST")!,
  port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "5432"),
  database: Deno.env.get("EXTERNAL_DB_NAME")!,
  user: Deno.env.get("EXTERNAL_DB_USER")!,
  password: Deno.env.get("EXTERNAL_DB_PASS")!,
};

async function connectExternalClient() {
  const client = new Client(externalDbConfig);
  await client.connect();
  return client;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate token using getUser
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    const { action, cedente_cpf_cnpj, user_id, assignment_id, status, rejection_reason, data_inicio, data_fim, periodo_meses, registros } = await req.json();

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    const isAdmin = roleData?.role === 'admin' || user.email === 'renan@goldcreditsa.com.br';

    // === ASSIGNMENT MANAGEMENT ===

    if (action === 'list-assignments') {
      // Always restricted to the logged-in user's portfolio (even admins see only their own)
      let query = supabaseAdmin.from('portfolio_assignments')
        .select('*')
        .eq('user_id', user.id);
      if (status) {
        query = query.eq('status', status);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, assignments: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'request-assignment') {
      // Direct assignment — no approval needed
      const { data, error } = await supabaseAdmin.from('portfolio_assignments').insert({
        user_id: user_id || user.id,
        cedente_cpf_cnpj,
        cedente_nome: null,
        status: 'approved',
        requested_by: user.id,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).select().single();

      if (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: 'Cedente já vinculado a este gestor' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }

      // Enrich with name from external DB
      try {
        const conn = await connectExternalClient();
        try {
          const result = await conn.queryObject<{ nome: string }>(`
            SELECT nome FROM smartsecurities_cedentes WHERE cpf_cnpj = $1 LIMIT 1
          `, [cedente_cpf_cnpj]);
          if (result.rows.length > 0) {
            await supabaseAdmin.from('portfolio_assignments')
              .update({ cedente_nome: result.rows[0].nome })
              .eq('id', data.id);
            data.cedente_nome = result.rows[0].nome;
          }
        } finally {
          await conn.end();
        }
      } catch (e) {
        console.error("Error enriching cedente name:", e);
      }

      return new Response(JSON.stringify({ success: true, assignment: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  if (action === 'approve-assignment' || action === 'reject-assignment') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const newStatus = action === 'approve-assignment' ? 'approved' : 'rejected';
      if (action === 'reject-assignment' && !rejection_reason) {
        return new Response(JSON.stringify({ error: 'Motivo da recusa é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const updateData: Record<string, unknown> = {
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };
      if (action === 'reject-assignment') {
        updateData.rejection_reason = rejection_reason;
      }
      const { error } = await supabaseAdmin.from('portfolio_assignments')
        .update(updateData)
        .eq('id', assignment_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove-assignment') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabaseAdmin.from('portfolio_assignments')
        .delete()
        .eq('id', assignment_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PORTFOLIO DATA (from external DB) ===

    if (action === 'my-portfolio' || action === 'portfolio-overview') {
      // Always restricted to the logged-in user's portfolio (even admins see only their own)
      const assignQuery = supabaseAdmin.from('portfolio_assignments')
        .select('cedente_cpf_cnpj, cedente_nome')
        .eq('status', 'approved')
        .eq('user_id', user.id);

      const { data: assignments, error: aErr } = await assignQuery;
      if (aErr) throw aErr;

      const cpfList = assignments?.map(a => a.cedente_cpf_cnpj) || [];

      if (cpfList.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          cedentes: [],
          metricas: { total_cedentes: 0, total_limite: 0, total_risco: 0, total_disponivel: 0, total_operacoes_30d: 0 },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Connect to external DB
      const connection = await connectExternalClient();
      try {
        // Build parameterized query for cedentes
        const placeholders = cpfList.map((_, i) => `$${i + 1}`).join(',');

        const cedentesResult = await connection.queryObject(`
          SELECT cpf_cnpj, nome, limite_global, bloqueado, setor, uf, cidade, vencimento_contrato
          FROM smartsecurities_cedentes
          WHERE cpf_cnpj IN (${placeholders})
          ORDER BY nome ASC
        `, cpfList);

        // Calcular risco real a partir dos títulos em aberto
        const riscoResult = await connection.queryObject(`
          SELECT cpf_cnpj_cedente, COALESCE(SUM(valor), 0) as risco_calculado
          FROM smartsecurities_titulos_em_aberto
          WHERE cpf_cnpj_cedente IN (${placeholders})
          GROUP BY cpf_cnpj_cedente
        `, cpfList);

        const riscoMap: Record<string, number> = {};
        for (const r of riscoResult.rows as any[]) {
          riscoMap[r.cpf_cnpj_cedente] = parseFloat(String(r.risco_calculado)) || 0;
        }

        // Last operation per cedente
        const opsResult = await connection.queryObject(`
          SELECT cpf_cnpj_cedente, MAX(data) as ultima_operacao
          FROM smartsecurities_operacoes_individualizadas
          WHERE cpf_cnpj_cedente IN (${placeholders})
          GROUP BY cpf_cnpj_cedente
        `, cpfList);

        const opsMap: Record<string, string> = {};
        for (const row of opsResult.rows as any[]) {
          opsMap[row.cpf_cnpj_cedente] = new Date(row.ultima_operacao).toISOString().split('T')[0];
        }

        // Operations in last 30 days
        const ops30Result = await connection.queryObject(`
          SELECT COUNT(*) as count
          FROM smartsecurities_operacoes_individualizadas
          WHERE cpf_cnpj_cedente IN (${placeholders})
          AND data >= CURRENT_DATE - INTERVAL '30 days'
        `, cpfList);

        const hoje = new Date();
        let totalLimite = 0, totalRisco = 0;

        const cedentes = (cedentesResult.rows as any[]).map(ced => {
          const limiteGlobal = parseFloat(ced.limite_global) || 0;
          const riscoAtual = riscoMap[ced.cpf_cnpj] || 0;
          totalLimite += limiteGlobal;
          totalRisco += riscoAtual;
          const ultimaOp = opsMap[ced.cpf_cnpj];
          const diasInativo = ultimaOp
            ? Math.floor((hoje.getTime() - new Date(ultimaOp).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          // Calcular pendência de aditivo
          const vencimentoContrato = ced.vencimento_contrato || null;
          let pendenciaAditivo = 'Sem contrato';
          if (vencimentoContrato) {
            const vencDate = new Date(vencimentoContrato);
            const diffDias = Math.floor((vencDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDias < 0) pendenciaAditivo = 'Vencido';
            else if (diffDias <= 30) pendenciaAditivo = 'Vence em breve';
            else pendenciaAditivo = 'Regular';
          }

          return {
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome,
            limite_global: limiteGlobal,
            limite_disponivel: limiteGlobal - riscoAtual,
            risco_atual: riscoAtual,
            bloqueado: ced.bloqueado,
            setor: ced.setor,
            uf: ced.uf,
            cidade: ced.cidade,
            vencimento_contrato: vencimentoContrato,
            pendencia_aditivo: pendenciaAditivo,
            ultima_operacao: ultimaOp || null,
            dias_inativo: diasInativo,
          };
        });

        const metricas = {
          total_cedentes: cedentes.length,
          total_limite: totalLimite,
          total_risco: totalRisco,
          total_disponivel: totalLimite - totalRisco,
          total_operacoes_30d: parseInt((ops30Result.rows[0] as any)?.count || '0'),
        };

        return new Response(JSON.stringify({ success: true, cedentes, metricas }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await connection.end();
      }
    }

    if (action === 'list-cedentes-all') {
      // List all cedentes from external DB, marking which are in user's portfolio
      const { data: userAssignments } = await supabaseAdmin
        .from('portfolio_assignments')
        .select('cedente_cpf_cnpj')
        .eq('user_id', user.id)
        .eq('status', 'approved');
      const carteiraCpfs = new Set((userAssignments || []).map(a => a.cedente_cpf_cnpj));

      const conn = await connectExternalClient();
      try {
        const result = await conn.queryObject(`
          SELECT cpf_cnpj, nome FROM smartsecurities_cedentes ORDER BY nome ASC LIMIT 500
        `);
        const cedentes = (result.rows as any[]).map(r => ({
          cpf_cnpj: r.cpf_cnpj,
          nome: r.nome,
          na_carteira: carteiraCpfs.has(r.cpf_cnpj),
        }));
        // Sort: carteira first
        cedentes.sort((a, b) => (a.na_carteira === b.na_carteira ? 0 : a.na_carteira ? -1 : 1));

        return new Response(JSON.stringify({ success: true, cedentes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    if (action === 'search-cedentes') {
      // Search cedentes from external DB for adding to portfolio
      const { search_term } = await req.json().catch(() => ({}));
      const conn = await connectExternalClient();
      try {
        // Already parsed above, re-parse body
        const body = { search_term: cedente_cpf_cnpj }; // reuse field
        const term = body.search_term || '';
        const result = await conn.queryObject(`
          SELECT cpf_cnpj, nome, limite_global, risco_atual, bloqueado
          FROM smartsecurities_cedentes
          WHERE nome ILIKE $1 OR cpf_cnpj LIKE $2
          ORDER BY nome ASC
          LIMIT 20
        `, [`%${term}%`, `%${term}%`]);

        return new Response(JSON.stringify({ success: true, cedentes: result.rows }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    // === SUGGESTIONS: cedentes where gerente matches user name ===
    if (action === 'suggest-by-gerente') {
      // Get user profile name
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const userName = profileData?.name?.trim();
      if (!userName) {
        return new Response(JSON.stringify({ success: true, sugestoes: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get already assigned cpf_cnpjs for this user (any status)
      const { data: existingAssignments } = await supabaseAdmin
        .from('portfolio_assignments')
        .select('cedente_cpf_cnpj')
        .eq('user_id', user.id);
      const assignedCpfs = new Set((existingAssignments || []).map(a => a.cedente_cpf_cnpj));

      const conn = await connectExternalClient();
      try {
        const result = await conn.queryObject(`
          SELECT cpf_cnpj, nome, gerente, limite_global, bloqueado, setor, uf, cidade
          FROM smartsecurities_cedentes
          WHERE LOWER(TRIM(gerente)) = LOWER($1)
          ORDER BY nome ASC
        `, [userName]);

        // Filter out already assigned
        const sugestoes = (result.rows as any[]).filter(r => !assignedCpfs.has(r.cpf_cnpj));

        return new Response(JSON.stringify({ success: true, sugestoes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    // === ADMIN: Auto-assign cedentes by gerente name match ===
    if (action === 'auto-assign-by-gerente') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all profiles
      const { data: profiles } = await supabaseAdmin.from('profiles').select('user_id, name');
      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ success: true, vinculados: 0, detalhes: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get existing assignments to avoid duplicates
      const { data: existingAssignments } = await supabaseAdmin
        .from('portfolio_assignments')
        .select('user_id, cedente_cpf_cnpj');
      const existingSet = new Set(
        (existingAssignments || []).map(a => `${a.user_id}|${a.cedente_cpf_cnpj}`)
      );

      // Query external DB for all cedentes with gerente field
      const conn = await connectExternalClient();
      try {
        const result = await conn.queryObject(`
          SELECT cpf_cnpj, nome, gerente
          FROM smartsecurities_cedentes
          WHERE gerente IS NOT NULL AND TRIM(gerente) != ''
        `);

        // Build name->user_id map (case-insensitive, trimmed)
        const nameMap: Record<string, { user_id: string; name: string }> = {};
        for (const p of profiles) {
          nameMap[p.name.trim().toLowerCase()] = { user_id: p.user_id, name: p.name };
        }

        const toInsert: any[] = [];
        const detalhes: any[] = [];

        for (const ced of result.rows as any[]) {
          const gerenteNorm = (ced.gerente || '').trim().toLowerCase();
          const matched = nameMap[gerenteNorm];
          if (matched && !existingSet.has(`${matched.user_id}|${ced.cpf_cnpj}`)) {
            toInsert.push({
              user_id: matched.user_id,
              cedente_cpf_cnpj: ced.cpf_cnpj,
              cedente_nome: ced.nome,
              status: 'approved',
              requested_by: user.id,
              approved_by: user.id,
              approved_at: new Date().toISOString(),
            });
            detalhes.push({ gestor: matched.name, cedente: ced.nome, cpf_cnpj: ced.cpf_cnpj });
          }
        }

        // Bulk insert
        if (toInsert.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('portfolio_assignments')
            .insert(toInsert);
          if (insertError) throw insertError;
        }

        return new Response(JSON.stringify({ success: true, vinculados: toInsert.length, detalhes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    // === ADVANCED METRICS for portfolio ===
    if (action === 'portfolio-advanced-metrics') {
      const pMeses = periodo_meses || 6;
      const dInicio = data_inicio || null; // YYYY-MM-DD
      const dFim = data_fim || null; // YYYY-MM-DD

      // Build date filter clause for operations
      let dateFilter: string;
      let dateFilterPrev: string;
      if (dInicio) {
        const endDate = dFim || new Date().toISOString().split('T')[0];
        dateFilter = `AND data >= '${dInicio}' AND data <= '${endDate}'`;
        // Previous period: same duration before dInicio
        const start = new Date(dInicio);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1); // day before start
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        dateFilterPrev = `AND data >= '${prevStart.toISOString().split('T')[0]}' AND data < '${dInicio}'`;
      } else {
        dateFilter = `AND data >= CURRENT_DATE - INTERVAL '${pMeses} months'`;
        dateFilterPrev = `AND data >= CURRENT_DATE - INTERVAL '${pMeses * 2} months' AND data < CURRENT_DATE - INTERVAL '${pMeses} months'`;
      }

      // Get assigned cedentes — always restricted to the logged-in user's portfolio
      // (even admins see only their own carteira here, not the global view)
      const assignQuery = supabaseAdmin.from('portfolio_assignments')
        .select('cedente_cpf_cnpj, cedente_nome')
        .eq('status', 'approved')
        .eq('user_id', user.id);
      const { data: assignments } = await assignQuery;
      const cpfList = assignments?.map(a => a.cedente_cpf_cnpj) || [];

      if (cpfList.length === 0) {
        return new Response(JSON.stringify({ success: true, data: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const conn = await connectExternalClient();
      try {
        const ph = cpfList.map((_, i) => `$${i + 1}`).join(',');

        // 1. Cedentes base data
        const cedRes = await conn.queryObject(`
          SELECT cpf_cnpj, nome, limite_global, bloqueado, setor, uf
          FROM smartsecurities_cedentes WHERE cpf_cnpj IN (${ph}) ORDER BY nome
        `, cpfList);

        // 2. Risco (títulos em aberto - todos os tipos)
        const riscoRes = await conn.queryObject(`
          SELECT cpf_cnpj_cedente, COALESCE(SUM(valor), 0) as risco
          FROM smartsecurities_titulos_em_aberto
          WHERE cpf_cnpj_cedente IN (${ph})
          GROUP BY cpf_cnpj_cedente
        `, cpfList);
        const riscoMap: Record<string, number> = {};
        for (const r of riscoRes.rows as any[]) riscoMap[r.cpf_cnpj_cedente] = parseFloat(r.risco) || 0;

        // 3. Operations per cedente (current period)
        const opsRes = await conn.queryObject(`
          SELECT cpf_cnpj_cedente, COUNT(*)::int as qtd, COALESCE(SUM(valor_bruto),0) as volume,
                 MAX(data) as ultima_op, MIN(data) as primeira_op
          FROM smartsecurities_operacoes_individualizadas
          WHERE cpf_cnpj_cedente IN (${ph})
            ${dateFilter}
          GROUP BY cpf_cnpj_cedente
        `, cpfList);
        const opsMap: Record<string, any> = {};
        for (const r of opsRes.rows as any[]) opsMap[r.cpf_cnpj_cedente] = r;

        // 4. Operations previous period (for comparison)
        const opsPrevRes = await conn.queryObject(`
          SELECT cpf_cnpj_cedente, COUNT(*)::int as qtd, COALESCE(SUM(valor_bruto),0) as volume
          FROM smartsecurities_operacoes_individualizadas
          WHERE cpf_cnpj_cedente IN (${ph})
            ${dateFilterPrev}
          GROUP BY cpf_cnpj_cedente
        `, cpfList);
        const opsPrevMap: Record<string, any> = {};
        for (const r of opsPrevRes.rows as any[]) opsPrevMap[r.cpf_cnpj_cedente] = r;

        // 5. Monthly operations breakdown
        const monthlyDateFilter = data_inicio
          ? `AND data >= '${data_inicio}'${data_fim ? ` AND data <= '${data_fim}'` : ''}`
          : `AND data >= CURRENT_DATE - INTERVAL '12 months'`;
        const monthlyRes = await conn.queryObject(`
          SELECT TO_CHAR(data, 'YYYY-MM') as mes,
                 COUNT(*)::int as qtd, COALESCE(SUM(valor_bruto),0) as volume,
                 COUNT(DISTINCT cpf_cnpj_cedente)::int as cedentes_ativos
          FROM smartsecurities_operacoes_individualizadas
          WHERE cpf_cnpj_cedente IN (${ph})
            ${monthlyDateFilter}
          GROUP BY TO_CHAR(data, 'YYYY-MM')
          ORDER BY mes
        `, cpfList);

        // Build cedentes enriched
        const hoje = new Date();
        let totalVolume = 0, totalOps = 0, totalRisco = 0, totalLimite = 0;
        const cedentesEnriched = (cedRes.rows as any[]).map(c => {
          const ops = opsMap[c.cpf_cnpj];
          const opsPrev = opsPrevMap[c.cpf_cnpj];
          const risco = riscoMap[c.cpf_cnpj] || 0;
          const limite = parseFloat(c.limite_global) || 0;
          const volume = parseFloat(ops?.volume || '0');
          const qtd = parseInt(ops?.qtd || '0');
          const volumePrev = parseFloat(opsPrev?.volume || '0');
          const qtdPrev = parseInt(opsPrev?.qtd || '0');
          const ultimaOp = ops?.ultima_op ? new Date(ops.ultima_op) : null;
          const diasInativo = ultimaOp ? Math.floor((hoje.getTime() - ultimaOp.getTime()) / 86400000) : 999;

          totalVolume += volume;
          totalOps += qtd;
          totalRisco += risco;
          totalLimite += limite;

          return {
            cpf_cnpj: c.cpf_cnpj,
            nome: c.nome || 'Sem nome',
            limite, risco, volume, qtd,
            volumePrev, qtdPrev,
            variacaoVolume: volumePrev > 0 ? ((volume - volumePrev) / volumePrev) * 100 : (volume > 0 ? 100 : 0),
            variacaoQtd: qtdPrev > 0 ? ((qtd - qtdPrev) / qtdPrev) * 100 : (qtd > 0 ? 100 : 0),
            diasInativo,
            uf: c.uf,
            setor: c.setor,
            bloqueado: c.bloqueado,
          };
        });

        // Totals previous period
        let totalVolumePrev = 0, totalOpsPrev = 0;
        for (const v of Object.values(opsPrevMap) as any[]) {
          totalVolumePrev += parseFloat(v.volume || '0');
          totalOpsPrev += parseInt(v.qtd || '0');
        }

        const cedentesAtivos = cedentesEnriched.filter(c => c.qtd > 0).length;
        const cedentesInativos = cedentesEnriched.length - cedentesAtivos;
        const ticketMedio = totalOps > 0 ? totalVolume / totalOps : 0;

        // Concentration index (HHI) based on RISCO (exposure), not volume
        // This ensures HHI is non-zero whenever there are open títulos
        const hhiBase = totalRisco > 0 ? totalRisco : totalVolume;
        const hhi = hhiBase > 0
          ? cedentesEnriched.reduce((sum, c) => {
              const share = totalRisco > 0 ? c.risco : c.volume;
              return sum + Math.pow((share / hhiBase) * 100, 2);
            }, 0)
          : 0;

        const resumo = {
          totalCedentes: cedentesEnriched.length,
          cedentesAtivos,
          cedentesInativos,
          totalVolume, totalOps, totalRisco, totalLimite,
          totalDisponivel: totalLimite - totalRisco,
          ticketMedio,
          variacaoVolume: totalVolumePrev > 0 ? ((totalVolume - totalVolumePrev) / totalVolumePrev) * 100 : 0,
          variacaoOps: totalOpsPrev > 0 ? ((totalOps - totalOpsPrev) / totalOpsPrev) * 100 : 0,
          concentracaoHHI: Math.round(hhi),
          taxaAtividade: cedentesEnriched.length > 0 ? (cedentesAtivos / cedentesEnriched.length) * 100 : 0,
        };

        // Rankings
        const rankingVolume = [...cedentesEnriched].sort((a, b) => b.volume - a.volume).slice(0, 15);
        const rankingOps = [...cedentesEnriched].sort((a, b) => b.qtd - a.qtd).slice(0, 15);
        const rankingRisco = [...cedentesEnriched].sort((a, b) => b.risco - a.risco).slice(0, 15);
        const rankingInativos = [...cedentesEnriched].filter(c => c.diasInativo > 30).sort((a, b) => b.diasInativo - a.diasInativo);

        // Risk concentration
        const concentracaoRisco = rankingRisco.slice(0, 10).map(c => ({
          ...c,
          percentualCarteira: totalRisco > 0 ? (c.risco / totalRisco) * 100 : 0,
        }));

        // Recommendations
        const recomendacoes: any[] = [];
        // Top 3 concentration
        if (concentracaoRisco.length >= 3) {
          const top3Pct = concentracaoRisco.slice(0, 3).reduce((s, c) => s + c.percentualCarteira, 0);
          if (top3Pct > 60) {
            recomendacoes.push({
              tipo: 'concentracao',
              titulo: 'Concentração elevada de risco',
              descricao: `Os 3 maiores cedentes concentram ${top3Pct.toFixed(1)}% do risco total. Considere redistribuir exposição.`,
              cedentes: concentracaoRisco.slice(0, 3).map(c => c.nome),
            });
          }
        }
        // Inactive cedentes
        const muitoInativos = rankingInativos.filter(c => c.diasInativo > 90);
        if (muitoInativos.length > 0) {
          recomendacoes.push({
            tipo: 'inatividade',
            titulo: `${muitoInativos.length} cedente(s) inativos há mais de 90 dias`,
            descricao: 'Avalie retomar operações ou redistribuir esses cedentes para otimizar a carteira.',
            cedentes: muitoInativos.slice(0, 5).map(c => c.nome),
          });
        }
        // Low utilization
        const baixaUtilizacao = cedentesEnriched.filter(c => c.limite > 0 && c.risco / c.limite < 0.1 && c.qtd > 0);
        if (baixaUtilizacao.length >= 3) {
          recomendacoes.push({
            tipo: 'utilizacao',
            titulo: `${baixaUtilizacao.length} cedentes com utilização abaixo de 10%`,
            descricao: 'Há espaço para aumentar operações com esses cedentes sem aumentar risco relativo.',
            cedentes: baixaUtilizacao.slice(0, 5).map(c => c.nome),
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: {
            resumo,
            rankingVolume,
            rankingOps,
            rankingRisco,
            rankingInativos,
            concentracaoRisco,
            evolucaoMensal: monthlyRes.rows,
            recomendacoes,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    // === ADMIN: Get all gestors with portfolio counts ===
    if (action === 'admin-overview') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all profiles (non-admin users are gestors)
      const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
      const { data: allAssignments } = await supabaseAdmin.from('portfolio_assignments').select('*');

      const gestors = (profiles || []).map(p => {
        const assignments = (allAssignments || []).filter(a => a.user_id === p.user_id);
        return {
          ...p,
          total_cedentes: assignments.filter(a => a.status === 'approved').length,
          pending_requests: assignments.filter(a => a.status === 'pending').length,
        };
      });

      const pendingTotal = (allAssignments || []).filter(a => a.status === 'pending').length;

      return new Response(JSON.stringify({ success: true, gestors, pendingTotal }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === GESTOR DASHBOARD ===
    if (action === 'debug-smart-variants') {
      const conn = await connectExternalClient();
      try {
        const r = await conn.queryObject(`
          SELECT COALESCE(situacao,'(null)') as situacao,
                 COUNT(*)::int as qtd,
                 COALESCE(SUM(valor),0)::float as v_valor,
                 COALESCE(SUM(valor_total),0)::float as v_total,
                 COALESCE(SUM(valor + COALESCE(valor_juros,0) + COALESCE(valor_multa,0)),0)::float as v_juros_multa
          FROM smartsecurities_titulos_em_aberto
          WHERE etapa IS NULL OR etapa=''
          GROUP BY situacao
          ORDER BY v_valor DESC
        `);
        return new Response(JSON.stringify({ rows: r.rows }, (_,v)=> typeof v==='bigint'?v.toString():v), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally { await conn.end(); }
    }

    if (action === 'gestor-dashboard') {
      // Use date filters from body (already parsed above)
      const filterDataInicio = data_inicio || null;
      const filterDataFim = data_fim || null;

      // Build SQL date clauses for operations/receitas
      let receitaDateClause = "WHERE data_pagamento >= CURRENT_DATE - INTERVAL '6 months'";
      let volumeDateClause = "WHERE data >= CURRENT_DATE - INTERVAL '6 months'";
      let receitaMesClause = "WHERE TO_CHAR(data_pagamento, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')";
      let inadDateClause = "WHERE vencimento < CURRENT_DATE";

      if (filterDataInicio && filterDataFim) {
        receitaDateClause = `WHERE data_pagamento >= '${filterDataInicio}' AND data_pagamento <= '${filterDataFim}'`;
        volumeDateClause = `WHERE data >= '${filterDataInicio}' AND data <= '${filterDataFim}'`;
        receitaMesClause = `WHERE data_pagamento >= '${filterDataInicio}' AND data_pagamento <= '${filterDataFim}'`;
        inadDateClause = `WHERE vencimento < '${filterDataFim}' AND vencimento >= '${filterDataInicio}'`;
      } else if (filterDataInicio) {
        receitaDateClause = `WHERE data_pagamento >= '${filterDataInicio}'`;
        volumeDateClause = `WHERE data >= '${filterDataInicio}'`;
        receitaMesClause = `WHERE data_pagamento >= '${filterDataInicio}'`;
      } else if (filterDataFim) {
        receitaDateClause = `WHERE data_pagamento <= '${filterDataFim}'`;
        volumeDateClause = `WHERE data <= '${filterDataFim}'`;
        receitaMesClause = `WHERE data_pagamento <= '${filterDataFim}'`;
        inadDateClause = `WHERE vencimento < '${filterDataFim}'`;
      }

      // 1. Get approved cedentes — always restricted to the logged-in user
      const assignQuery = supabaseAdmin.from('portfolio_assignments')
        .select('cedente_cpf_cnpj, cedente_nome')
        .eq('status', 'approved')
        .eq('user_id', user.id);
      const { data: assignments } = await assignQuery;
      const cpfList = assignments?.map(a => a.cedente_cpf_cnpj) || [];

      const carteiraNomes = new Set(
        (assignments || []).map(a => (a.cedente_nome || '').toUpperCase().trim()).filter(Boolean)
      );

      const conn = await connectExternalClient();
      try {
        // --- ANIVERSARIANTES (global) ---
        const anivRes = await conn.queryObject(`
          SELECT a.nome, a.nascimento, a.empresa
          FROM smartsecurities_aniversariantes a
          WHERE a.nascimento IS NOT NULL
            AND a.empresa IS NOT NULL AND TRIM(a.empresa) != ''
        `);

        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth() + 1;
        const todayYear = today.getFullYear();
        const todayMidnight = new Date(todayYear, todayMonth - 1, todayDay);

        const proximosAniversariantes = (anivRes.rows as any[]).map(row => {
          try {
            const d = new Date(row.nascimento);
            if (isNaN(d.getTime())) return null;
            const bDay = d.getDate();
            const bMonth = d.getMonth() + 1;
            if (bDay < 1 || bDay > 31 || bMonth < 1 || bMonth > 12) return null;
            let nextBirthday = new Date(todayYear, bMonth - 1, bDay);
            if (nextBirthday.getMonth() !== bMonth - 1) return null;
            if (nextBirthday < todayMidnight) {
              nextBirthday = new Date(todayYear + 1, bMonth - 1, bDay);
              if (nextBirthday.getMonth() !== bMonth - 1) return null;
            }
            const diasFaltam = Math.round((nextBirthday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
            const empresaTrimmed = (row.empresa || '').trim();
            return {
              nome: (row.nome || '').trim(),
              empresa: empresaTrimmed,
              data_nascimento: row.nascimento,
              dias_faltam: diasFaltam,
              dia: bDay,
              mes: bMonth,
              na_carteira: carteiraNomes.has(empresaTrimmed.toUpperCase()),
            };
          } catch { return null; }
        })
        .filter((a: any) => a !== null && a.dias_faltam >= 0 && a.dias_faltam <= 365)
        .filter((a: any, i: number, arr: any[]) => 
          arr.findIndex((b: any) => b.nome === a.nome && b.empresa === a.empresa) === i
        )
        .sort((a: any, b: any) => a.dias_faltam - b.dias_faltam);

        // --- GENERAL BI METRICS ---
        // 1. Clientes ativos = cedentes que operaram nos últimos 30 dias
        const clientesRes = await conn.queryObject(`
          SELECT COUNT(DISTINCT o.cpf_cnpj_cedente)::int as total
          FROM smartsecurities_operacoes_individualizadas o
          WHERE o.data >= CURRENT_DATE - INTERVAL '30 days'
        `);
        const clientesAtivos = (clientesRes.rows[0] as any)?.total || 0;

        // 2. Carteira = títulos em aberto CONVENCIONAL (situação 'Aberto' e fora da etapa Documental/Trustee)
        const carteiraRes = await conn.queryObject(`
          SELECT COALESCE(SUM(valor), 0)::float as total
          FROM smartsecurities_titulos_em_aberto
          WHERE situacao = 'Aberto'
            AND (etapa IS NULL OR etapa <> 'Documental')
        `);
        const carteiraTotal = parseFloat((carteiraRes.rows[0] as any)?.total) || 0;

        // 3. Inadimplência = títulos classificados como inadimplentes pelo Smart (situação contém 'Inadimpl')
        const inadRes = await conn.queryObject(`
          SELECT COALESCE(SUM(valor), 0)::float as total
          FROM smartsecurities_titulos_em_aberto
          WHERE situacao ILIKE '%inadimpl%'
        `);
        const inadimplencia = parseFloat((inadRes.rows[0] as any)?.total) || 0;

        // 4. Receita do período
        const receitaMesRes = await conn.queryObject(`
          SELECT COALESCE(SUM(total), 0)::float as total
          FROM smartsecurities_receita_por_cedente
          ${receitaMesClause}
        `);
        const receitaMesAtual = parseFloat((receitaMesRes.rows[0] as any)?.total) || 0;

        // 5. Risco por cedente (top 10 for donut chart)
        const riscoCedenteRes = await conn.queryObject(`
          SELECT c.nome, COALESCE(SUM(t.valor), 0)::float as risco
          FROM smartsecurities_titulos_em_aberto t
          JOIN smartsecurities_cedentes c ON c.cpf_cnpj = t.cpf_cnpj_cedente
          GROUP BY c.nome
          HAVING COALESCE(SUM(t.valor), 0) > 0
          ORDER BY risco DESC
          LIMIT 10
        `);
        const riscoCedente = (riscoCedenteRes.rows as any[]).map(r => ({
          nome: r.nome,
          valor: parseFloat(r.risco) || 0,
        }));

        // 6. Receita por mês
        const receitaMensalRes = await conn.queryObject(`
          SELECT TO_CHAR(data_pagamento, 'YYYY-MM') as mes, COALESCE(SUM(total), 0)::float as receita
          FROM smartsecurities_receita_por_cedente
          ${receitaDateClause}
          GROUP BY TO_CHAR(data_pagamento, 'YYYY-MM')
          ORDER BY mes
        `);
        const receitaMensal = (receitaMensalRes.rows as any[]).map(r => ({
          mes: r.mes,
          receita: parseFloat(r.receita) || 0,
        }));

        // 7. Volume operado por mês
        const volumeMensalRes = await conn.queryObject(`
          SELECT TO_CHAR(data, 'YYYY-MM') as mes, COALESCE(SUM(valor_bruto), 0)::float as volume
          FROM smartsecurities_operacoes_individualizadas
          ${volumeDateClause}
          GROUP BY TO_CHAR(data, 'YYYY-MM')
          ORDER BY mes
        `);
        const volumeMensal = (volumeMensalRes.rows as any[]).map(r => ({
          mes: r.mes,
          volume: parseFloat(r.volume) || 0,
        }));

        // 8. Alertas de inadimplência (títulos vencidos, top 15 por valor)
        const alertasInadRes = await conn.queryObject(`
          SELECT t.cpf_cnpj_cedente, c.nome as cedente_nome, t.sacado, 
                 t.valor::float, t.vencimento,
                 (CURRENT_DATE - t.vencimento::date)::int as dias_atraso
          FROM smartsecurities_titulos_em_aberto t
          LEFT JOIN smartsecurities_cedentes c ON c.cpf_cnpj = t.cpf_cnpj_cedente
          WHERE t.vencimento < CURRENT_DATE
          ORDER BY t.valor DESC
          LIMIT 15
        `);
        const alertasInadimplencia = (alertasInadRes.rows as any[]).map(r => ({
          cedente: r.cedente_nome || r.cpf_cnpj_cedente,
          sacado: r.sacado || 'N/I',
          valor: parseFloat(r.valor) || 0,
          vencimento: r.vencimento,
          diasAtraso: parseInt(r.dias_atraso) || 0,
        }));

        // 9. Reconciliação Smart — breakdown por situação para conferência
        const reconRes = await conn.queryObject(`
          SELECT
            COALESCE(situacao, '(sem situação)') as situacao,
            COALESCE(etapa, '') as etapa,
            COUNT(*)::int as qtd,
            COALESCE(SUM(valor), 0)::float as soma
          FROM smartsecurities_titulos_em_aberto
          GROUP BY situacao, etapa
          ORDER BY soma DESC
        `);
        const breakdown = (reconRes.rows as any[]).map(r => ({
          situacao: r.situacao,
          etapa: r.etapa || null,
          qtd: parseInt(r.qtd) || 0,
          valor: parseFloat(r.soma) || 0,
        }));
        const totalGeralAberto = breakdown.reduce((acc, b) => acc + b.valor, 0);
        const totalDocumental = breakdown
          .filter(b => b.etapa === 'Documental')
          .reduce((acc, b) => acc + b.valor, 0);

        return new Response(JSON.stringify({
          success: true,
          proximosAniversariantes,
          alertasInadimplencia,
          metricas: {
            clientesAtivos,
            carteiraTotal,
            inadimplencia,
            receitaMesAtual,
            riscoCedente,
            receitaMensal,
            volumeMensal,
          },
          reconciliacao: {
            totalGeralAberto,
            totalDocumental,
            carteiraConvencional: carteiraTotal,
            inadimplenciaSmart: inadimplencia,
            breakdown,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        await conn.end();
      }
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in portfolio-data:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
