import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prefixo das tabelas no banco externo
const TABLE_PREFIX = 'smartsecurities_';

function getConnectionString(): string {
  const host = Deno.env.get('EXTERNAL_DB_HOST')!;
  const port = Deno.env.get('EXTERNAL_DB_PORT') || '5432';
  const user = Deno.env.get('EXTERNAL_DB_USER')!;
  const pass = Deno.env.get('EXTERNAL_DB_PASS')!;
  const name = Deno.env.get('EXTERNAL_DB_NAME')!;
  
  return `postgres://${user}:${pass}@${host}:${port}/${name}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = postgres(getConnectionString(), {
    ssl: 'require',
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    const { action, filters } = await req.json();

    switch (action) {
      case 'test-connection': {
        const result = await sql`SELECT 1 as connected`;
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Conexão com banco externo estabelecida!',
          data: result 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list-tables': {
        const result = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `;
        return new Response(JSON.stringify({ 
          success: true, 
          data: result 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'describe-table': {
        const tableName = filters?.table || `${TABLE_PREFIX}cedentes`;
        const result = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        return new Response(JSON.stringify({ 
          success: true, 
          data: result 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cedentes-list': {
        let result;
        if (filters?.search) {
          const searchTerm = `%${filters.search}%`;
          result = await sql`
            SELECT * 
            FROM smartsecurities_cedentes 
            WHERE nome ILIKE ${searchTerm} OR cpf_cnpj ILIKE ${searchTerm}
            ORDER BY nome 
            LIMIT 500
          `;
        } else {
          result = await sql`
            SELECT * 
            FROM smartsecurities_cedentes 
            ORDER BY nome 
            LIMIT 500
          `;
        }
        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cedente-info': {
        if (!filters?.cpf_cnpj) {
          throw new Error('CPF/CNPJ é obrigatório');
        }

        const cpfCnpj = filters.cpf_cnpj.replace(/\D/g, '');
        
        // Buscar dados do cedente
        const cedenteResult = await sql`
          SELECT * FROM smartsecurities_cedentes 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          LIMIT 1
        `;

        if (cedenteResult.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Cedente não encontrado no Smart.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const cedente = cedenteResult[0];

        // Buscar operações
        const operacoes = await sql`
          SELECT * FROM smartsecurities_operacoes_individualizadas 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY data DESC 
          LIMIT 50
        `;

        // Buscar títulos em aberto
        const titulosAberto = await sql`
          SELECT * FROM smartsecurities_titulos_em_aberto 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY vencimento ASC 
          LIMIT 100
        `;

        // Buscar títulos quitados
        const titulosQuitados = await sql`
          SELECT * FROM smartsecurities_titulos_quitados 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY quitacao DESC 
          LIMIT 100
        `;

        // Buscar receitas
        const receitas = await sql`
          SELECT * FROM smartsecurities_receita_por_cedente 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY data_pagamento DESC 
          LIMIT 50
        `;

        // Buscar títulos recomprados
        const recomprados = await sql`
          SELECT * FROM smartsecurities_titulos_recomprados 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY recompra DESC 
          LIMIT 50
        `;

        // Buscar suspeita de fraude
        const suspeitaFraude = await sql`
          SELECT * FROM smartsecurities_titulos_quitados_suspeita_fraude 
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente, '.', ''), '-', ''), '/', '') = ${cpfCnpj}
          ORDER BY data_quitacao DESC 
          LIMIT 50
        `;

        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            cedente,
            operacoes,
            titulosAberto,
            titulosQuitados,
            receitas,
            recomprados,
            suspeitaFraude,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'stats': {
        const counts = await sql`
          SELECT 
            (SELECT COUNT(*) FROM smartsecurities_cedentes) as cedentes,
            (SELECT COUNT(*) FROM smartsecurities_operacoes_individualizadas) as operacoes,
            (SELECT COUNT(*) FROM smartsecurities_receita_por_cedente) as receitas,
            (SELECT COUNT(*) FROM smartsecurities_titulos_em_aberto) as titulos_aberto,
            (SELECT COUNT(*) FROM smartsecurities_titulos_quitados) as titulos_quitados,
            (SELECT COUNT(*) FROM smartsecurities_titulos_prorrogados) as titulos_prorrogados,
            (SELECT COUNT(*) FROM smartsecurities_titulos_recomprados) as titulos_recomprados
        `;

        const totals = await sql`
          SELECT 
            (SELECT COALESCE(SUM(total), 0) FROM smartsecurities_receita_por_cedente) as receita,
            (SELECT COALESCE(SUM(valor_bruto), 0) FROM smartsecurities_operacoes_individualizadas) as operacoes_bruto,
            (SELECT COALESCE(SUM(valor_liquido), 0) FROM smartsecurities_operacoes_individualizadas) as operacoes_liquido,
            (SELECT COALESCE(SUM(valor_receita), 0) FROM smartsecurities_operacoes_individualizadas) as operacoes_receita
        `;

        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            counts: counts[0],
            totals: totals[0]
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'operacoes': {
        const cedente = filters?.cedente ? `%${filters.cedente}%` : null;
        const dataInicio = filters?.dataInicio || null;
        const dataFim = filters?.dataFim || null;

        const result = await sql`
          SELECT * FROM smartsecurities_operacoes_individualizadas 
          WHERE 
            (${cedente}::text IS NULL OR cedente ILIKE ${cedente})
            AND (${dataInicio}::date IS NULL OR data >= ${dataInicio}::date)
            AND (${dataFim}::date IS NULL OR data <= ${dataFim}::date)
          ORDER BY data DESC 
          LIMIT 500
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'receitas': {
        const cedente = filters?.cedente ? `%${filters.cedente}%` : null;
        const dataInicio = filters?.dataInicio || null;
        const dataFim = filters?.dataFim || null;

        const result = await sql`
          SELECT * FROM smartsecurities_receita_por_cedente 
          WHERE 
            (${cedente}::text IS NULL OR cedente ILIKE ${cedente})
            AND (${dataInicio}::date IS NULL OR data_pagamento >= ${dataInicio}::date)
            AND (${dataFim}::date IS NULL OR data_pagamento <= ${dataFim}::date)
          ORDER BY data_pagamento DESC 
          LIMIT 500
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'titulos-aberto': {
        const cedente = filters?.cedente ? `%${filters.cedente}%` : null;
        const sacado = filters?.sacado ? `%${filters.sacado}%` : null;
        const dataInicio = filters?.dataInicio || null;
        const dataFim = filters?.dataFim || null;

        const result = await sql`
          SELECT * FROM smartsecurities_titulos_em_aberto 
          WHERE 
            (${cedente}::text IS NULL OR cedente ILIKE ${cedente})
            AND (${sacado}::text IS NULL OR sacado ILIKE ${sacado})
            AND (${dataInicio}::date IS NULL OR vencimento >= ${dataInicio}::date)
            AND (${dataFim}::date IS NULL OR vencimento <= ${dataFim}::date)
          ORDER BY vencimento ASC 
          LIMIT 500
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cedentes-detalhes': {
        const nome = filters?.nome ? `%${filters.nome}%` : null;
        const uf = filters?.uf || null;

        const result = await sql`
          SELECT * FROM smartsecurities_cedentes 
          WHERE 
            (${nome}::text IS NULL OR nome ILIKE ${nome})
            AND (${uf}::text IS NULL OR uf = ${uf})
          ORDER BY nome 
          LIMIT 500
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resumo-por-periodo': {
        const result = await sql`
          SELECT 
            TO_CHAR(data, 'YYYY-MM') as mes,
            SUM(valor_bruto) as bruto,
            SUM(valor_liquido) as liquido,
            SUM(valor_receita) as receita,
            COUNT(*) as count
          FROM smartsecurities_operacoes_individualizadas
          WHERE data IS NOT NULL
          GROUP BY TO_CHAR(data, 'YYYY-MM')
          ORDER BY mes DESC
          LIMIT 24
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'top-cedentes': {
        const result = await sql`
          SELECT 
            cedente as nome,
            SUM(valor_bruto) as valor,
            COUNT(*) as operacoes
          FROM smartsecurities_operacoes_individualizadas
          WHERE cedente IS NOT NULL
          GROUP BY cedente
          ORDER BY valor DESC
          LIMIT 20
        `;

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ação não reconhecida' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('External DB error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao conectar ao banco externo'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } finally {
    await sql.end();
  }
});
