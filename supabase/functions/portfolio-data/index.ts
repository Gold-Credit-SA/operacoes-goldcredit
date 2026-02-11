import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, cedente_cpf_cnpj, user_id, assignment_id, status } = await req.json();

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    const isAdmin = roleData?.role === 'admin' || user.email === 'renan@goldcreditsa.com.br';

    // === ASSIGNMENT MANAGEMENT ===

    if (action === 'list-assignments') {
      // Admin sees all, gestor sees own
      let query = supabaseAdmin.from('portfolio_assignments').select('*');
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
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
      // Gestor requests a cedente; admin assigns directly as approved
      const assignStatus = isAdmin ? 'approved' : 'pending';
      const { data, error } = await supabaseAdmin.from('portfolio_assignments').insert({
        user_id: user_id || user.id,
        cedente_cpf_cnpj,
        cedente_nome: null, // will be enriched below
        status: assignStatus,
        requested_by: user.id,
        approved_by: isAdmin ? user.id : null,
        approved_at: isAdmin ? new Date().toISOString() : null,
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
        const pool = new Pool({
          hostname: Deno.env.get("EXTERNAL_DB_HOST")!,
          port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "5432"),
          database: Deno.env.get("EXTERNAL_DB_NAME")!,
          user: Deno.env.get("EXTERNAL_DB_USER")!,
          password: Deno.env.get("EXTERNAL_DB_PASS")!,
        }, 1);
        const conn = await pool.connect();
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
          conn.release();
          await pool.end();
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
      const { error } = await supabaseAdmin.from('portfolio_assignments')
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
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
      // Get assigned cedentes for this user (or all for admin overview)
      let assignQuery = supabaseAdmin.from('portfolio_assignments')
        .select('cedente_cpf_cnpj, cedente_nome')
        .eq('status', 'approved');

      if (action === 'my-portfolio') {
        assignQuery = assignQuery.eq('user_id', user.id);
      } else if (!isAdmin) {
        assignQuery = assignQuery.eq('user_id', user.id);
      }

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
      const pool = new Pool({
        hostname: Deno.env.get("EXTERNAL_DB_HOST")!,
        port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "5432"),
        database: Deno.env.get("EXTERNAL_DB_NAME")!,
        user: Deno.env.get("EXTERNAL_DB_USER")!,
        password: Deno.env.get("EXTERNAL_DB_PASS")!,
      }, 3);

      const connection = await pool.connect();
      try {
        // Build parameterized query for cedentes
        const placeholders = cpfList.map((_, i) => `$${i + 1}`).join(',');

        const cedentesResult = await connection.queryObject(`
          SELECT cpf_cnpj, nome, limite_global, risco_atual, bloqueado, setor, uf, cidade
          FROM smartsecurities_cedentes
          WHERE cpf_cnpj IN (${placeholders})
          ORDER BY nome ASC
        `, cpfList);

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
          const riscoAtual = parseFloat(ced.risco_atual) || 0;
          totalLimite += limiteGlobal;
          totalRisco += riscoAtual;
          const ultimaOp = opsMap[ced.cpf_cnpj];
          const diasInativo = ultimaOp
            ? Math.floor((hoje.getTime() - new Date(ultimaOp).getTime()) / (1000 * 60 * 60 * 24))
            : null;

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
        connection.release();
        await pool.end();
      }
    }

    if (action === 'search-cedentes') {
      // Search cedentes from external DB for adding to portfolio
      const { search_term } = await req.json().catch(() => ({}));
      const pool = new Pool({
        hostname: Deno.env.get("EXTERNAL_DB_HOST")!,
        port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "5432"),
        database: Deno.env.get("EXTERNAL_DB_NAME")!,
        user: Deno.env.get("EXTERNAL_DB_USER")!,
        password: Deno.env.get("EXTERNAL_DB_PASS")!,
      }, 1);
      const conn = await pool.connect();
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
        conn.release();
        await pool.end();
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
