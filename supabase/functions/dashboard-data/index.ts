import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, filters } = await req.json();

    switch (action) {
      case 'stats': {
        // Get counts from all tables
        const [
          cedentesCount,
          operacoesCount,
          receitaCount,
          titulosAbertoCount,
          titulosQuitadosCount,
          titulosProrrogadosCount,
          titulosRecompradosCount,
        ] = await Promise.all([
          supabase.from('cedentes_completo').select('id', { count: 'exact', head: true }),
          supabase.from('operacoes_individualizadas').select('id', { count: 'exact', head: true }),
          supabase.from('receita_por_cedente').select('id', { count: 'exact', head: true }),
          supabase.from('titulos_em_aberto').select('id', { count: 'exact', head: true }),
          supabase.from('titulos_quitados').select('id', { count: 'exact', head: true }),
          supabase.from('titulos_prorrogados').select('id', { count: 'exact', head: true }),
          supabase.from('titulos_recomprados').select('id', { count: 'exact', head: true }),
        ]);

        // Get totals
        const { data: receitaTotal } = await supabase
          .from('receita_por_cedente')
          .select('total');
        
        const { data: operacoesTotal } = await supabase
          .from('operacoes_individualizadas')
          .select('valor_bruto, valor_liquido, valor_receita');

        const sumReceita = receitaTotal?.reduce((acc, r) => acc + (r.total || 0), 0) || 0;
        const sumOperacoesBruto = operacoesTotal?.reduce((acc, o) => acc + (o.valor_bruto || 0), 0) || 0;
        const sumOperacoesLiquido = operacoesTotal?.reduce((acc, o) => acc + (o.valor_liquido || 0), 0) || 0;
        const sumOperacoesReceita = operacoesTotal?.reduce((acc, o) => acc + (o.valor_receita || 0), 0) || 0;

        return new Response(JSON.stringify({
          success: true,
          data: {
            counts: {
              cedentes: cedentesCount.count || 0,
              operacoes: operacoesCount.count || 0,
              receitas: receitaCount.count || 0,
              titulosAberto: titulosAbertoCount.count || 0,
              titulosQuitados: titulosQuitadosCount.count || 0,
              titulosProrrogados: titulosProrrogadosCount.count || 0,
              titulosRecomprados: titulosRecompradosCount.count || 0,
            },
            totals: {
              receita: sumReceita,
              operacoesBruto: sumOperacoesBruto,
              operacoesLiquido: sumOperacoesLiquido,
              operacoesReceita: sumOperacoesReceita,
            }
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'cedentes-list': {
        const { data, error } = await supabase
          .from('cedentes_completo')
          .select('id, nome, cpf_cnpj, cidade, uf, gerente, operador')
          .order('nome');

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'operacoes': {
        let query = supabase
          .from('operacoes_individualizadas')
          .select('*')
          .order('data', { ascending: false });

        if (filters?.cedente) {
          query = query.ilike('cedente', `%${filters.cedente}%`);
        }
        if (filters?.dataInicio) {
          query = query.gte('data', filters.dataInicio);
        }
        if (filters?.dataFim) {
          query = query.lte('data', filters.dataFim);
        }
        if (filters?.etapa) {
          query = query.eq('etapa', filters.etapa);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'receitas': {
        let query = supabase
          .from('receita_por_cedente')
          .select('*')
          .order('data_pagamento', { ascending: false });

        if (filters?.cedente) {
          query = query.ilike('cedente', `%${filters.cedente}%`);
        }
        if (filters?.dataInicio) {
          query = query.gte('data_pagamento', filters.dataInicio);
        }
        if (filters?.dataFim) {
          query = query.lte('data_pagamento', filters.dataFim);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'titulos-aberto': {
        let query = supabase
          .from('titulos_em_aberto')
          .select('*')
          .order('vencimento', { ascending: true });

        if (filters?.cedente) {
          query = query.ilike('cedente', `%${filters.cedente}%`);
        }
        if (filters?.sacado) {
          query = query.ilike('sacado', `%${filters.sacado}%`);
        }
        if (filters?.dataInicio) {
          query = query.gte('vencimento', filters.dataInicio);
        }
        if (filters?.dataFim) {
          query = query.lte('vencimento', filters.dataFim);
        }
        if (filters?.situacao) {
          query = query.eq('situacao', filters.situacao);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'titulos-quitados': {
        let query = supabase
          .from('titulos_quitados')
          .select('*')
          .order('quitacao', { ascending: false });

        if (filters?.cedente) {
          query = query.ilike('cedente', `%${filters.cedente}%`);
        }
        if (filters?.dataInicio) {
          query = query.gte('quitacao', filters.dataInicio);
        }
        if (filters?.dataFim) {
          query = query.lte('quitacao', filters.dataFim);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cedentes-detalhes': {
        let query = supabase
          .from('cedentes_completo')
          .select('*')
          .order('nome');

        if (filters?.nome) {
          query = query.ilike('nome', `%${filters.nome}%`);
        }
        if (filters?.cidade) {
          query = query.ilike('cidade', `%${filters.cidade}%`);
        }
        if (filters?.uf) {
          query = query.eq('uf', filters.uf);
        }
        if (filters?.gerente) {
          query = query.ilike('gerente', `%${filters.gerente}%`);
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resumo-por-periodo': {
        // Get operations grouped by month
        const { data: operacoes } = await supabase
          .from('operacoes_individualizadas')
          .select('data, valor_bruto, valor_liquido, valor_receita');

        const porMes: Record<string, { bruto: number; liquido: number; receita: number; count: number }> = {};
        
        operacoes?.forEach(op => {
          if (op.data) {
            const mes = op.data.substring(0, 7); // YYYY-MM
            if (!porMes[mes]) {
              porMes[mes] = { bruto: 0, liquido: 0, receita: 0, count: 0 };
            }
            porMes[mes].bruto += op.valor_bruto || 0;
            porMes[mes].liquido += op.valor_liquido || 0;
            porMes[mes].receita += op.valor_receita || 0;
            porMes[mes].count += 1;
          }
        });

        const resumo = Object.entries(porMes)
          .map(([mes, valores]) => ({ mes, ...valores }))
          .sort((a, b) => b.mes.localeCompare(a.mes));

        return new Response(JSON.stringify({ success: true, data: resumo }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'top-cedentes': {
        // Get top cedentes by volume
        const { data: operacoes } = await supabase
          .from('operacoes_individualizadas')
          .select('cedente, valor_bruto');

        const porCedente: Record<string, { valor: number; operacoes: number }> = {};
        
        operacoes?.forEach(op => {
          if (op.cedente) {
            if (!porCedente[op.cedente]) {
              porCedente[op.cedente] = { valor: 0, operacoes: 0 };
            }
            porCedente[op.cedente].valor += op.valor_bruto || 0;
            porCedente[op.cedente].operacoes += 1;
          }
        });

        const topCedentes = Object.entries(porCedente)
          .map(([nome, dados]) => ({ nome, ...dados }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 20);

        return new Response(JSON.stringify({ success: true, data: topCedentes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
