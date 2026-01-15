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

    const { action, cpf_cnpj, search } = await req.json();

    switch (action) {
      case 'list': {
        let query = supabase
          .from('cedentes_completo')
          .select('id, nome, cpf_cnpj, cidade, uf, gerente, operador, limite_global, risco_atual, saldo, bloqueado')
          .order('nome');

        if (search) {
          query = query.or(`nome.ilike.%${search}%,cpf_cnpj.ilike.%${search}%`);
        }

        const { data, error } = await query.limit(100);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'detail': {
        if (!cpf_cnpj) {
          return new Response(JSON.stringify({ success: false, error: 'CPF/CNPJ obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Buscar dados do cedente
        const { data: cedente, error: cedenteError } = await supabase
          .from('cedentes_completo')
          .select('*')
          .eq('cpf_cnpj', cpf_cnpj)
          .single();

        if (cedenteError) throw cedenteError;

        // Buscar operações
        const { data: operacoes } = await supabase
          .from('operacoes_individualizadas')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj)
          .order('data', { ascending: false });

        // Buscar receitas
        const { data: receitas } = await supabase
          .from('receita_por_cedente')
          .select('*')
          .eq('cpf_cnpj', cpf_cnpj)
          .order('data_pagamento', { ascending: false });

        // Buscar títulos em aberto
        const { data: titulosAberto } = await supabase
          .from('titulos_em_aberto')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj);

        // Buscar títulos quitados
        const { data: titulosQuitados } = await supabase
          .from('titulos_quitados')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj);

        // Buscar títulos recomprados
        const { data: titulosRecomprados } = await supabase
          .from('titulos_recomprados')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj);

        // Calcular primeira e última operação
        const primeiraOp = operacoes?.length ? operacoes[operacoes.length - 1]?.data : null;
        const ultimaOp = operacoes?.length ? operacoes[0]?.data : null;

        // Calcular totais de operações
        const totalOperacoes = operacoes?.length || 0;
        const valorBrutoTotal = operacoes?.reduce((acc, op) => acc + (op.valor_bruto || 0), 0) || 0;
        const valorLiquidoTotal = operacoes?.reduce((acc, op) => acc + (op.valor_liquido || 0), 0) || 0;
        const receitaTotal = operacoes?.reduce((acc, op) => acc + (op.valor_receita || 0), 0) || 0;

        // Calcular carteira (títulos em aberto)
        const carteiraTotal = titulosAberto?.reduce((acc, t) => acc + (t.valor || 0), 0) || 0;
        const carteiraVencidos = titulosAberto?.filter(t => {
          if (!t.vencimento) return false;
          return new Date(t.vencimento) < new Date();
        }).reduce((acc, t) => acc + (t.valor || 0), 0) || 0;

        // Agrupar por tipo de título
        const carteiraPorTipo: Record<string, { risco: number; vencimento: number; vencidos: number }> = {};
        titulosAberto?.forEach(t => {
          const tipo = t.tipo || 'OUTROS';
          if (!carteiraPorTipo[tipo]) {
            carteiraPorTipo[tipo] = { risco: 0, vencimento: 0, vencidos: 0 };
          }
          carteiraPorTipo[tipo].risco += t.valor || 0;
          
          if (t.vencimento) {
            const venc = new Date(t.vencimento);
            const hoje = new Date();
            if (venc < hoje) {
              carteiraPorTipo[tipo].vencidos += t.valor || 0;
            } else {
              carteiraPorTipo[tipo].vencimento += t.valor || 0;
            }
          }
        });

        // Calcular concentração de sacados
        const sacadosConcentracao: Record<string, { nome: string; risco: number }> = {};
        titulosAberto?.forEach(t => {
          const sacadoKey = t.cpf_cnpj_sacado || 'DESCONHECIDO';
          if (!sacadosConcentracao[sacadoKey]) {
            sacadosConcentracao[sacadoKey] = { nome: t.sacado || 'Desconhecido', risco: 0 };
          }
          sacadosConcentracao[sacadoKey].risco += t.valor || 0;
        });

        const topSacados = Object.entries(sacadosConcentracao)
          .map(([cpf_cnpj, data]) => ({
            cpf_cnpj,
            nome: data.nome,
            risco: data.risco,
            concentracao: carteiraTotal > 0 ? (data.risco / carteiraTotal) * 100 : 0
          }))
          .sort((a, b) => b.risco - a.risco)
          .slice(0, 10);

        // Calcular liquidez
        const totalQuitados = titulosQuitados?.length || 0;
        const valorQuitado = titulosQuitados?.reduce((acc, t) => acc + (t.valor_liquidado || 0), 0) || 0;
        
        // Calcular pontualidade (quitados antes do vencimento)
        const quitadosPontuais = titulosQuitados?.filter(t => {
          if (!t.quitacao || !t.vencimento) return false;
          return new Date(t.quitacao) <= new Date(t.vencimento);
        }).length || 0;

        // Calcular atrasos
        const quitadosAtraso = titulosQuitados?.filter(t => {
          if (!t.quitacao || !t.vencimento) return false;
          return new Date(t.quitacao) > new Date(t.vencimento);
        }).length || 0;

        const totalRecomprados = titulosRecomprados?.length || 0;
        const valorRecomprado = titulosRecomprados?.reduce((acc, t) => acc + (t.valor_face || 0), 0) || 0;

        // Calcular percentuais de liquidez
        const totalTitulosHistorico = totalQuitados + totalRecomprados;
        const percentualPontual = totalTitulosHistorico > 0 ? (quitadosPontuais / totalTitulosHistorico) * 100 : 0;
        const percentualAtraso = totalTitulosHistorico > 0 ? (quitadosAtraso / totalTitulosHistorico) * 100 : 0;
        const percentualRecompra = totalTitulosHistorico > 0 ? (totalRecomprados / totalTitulosHistorico) * 100 : 0;

        // Receita por período
        const receitaPorMes: Record<string, number> = {};
        receitas?.forEach(r => {
          if (r.data_pagamento) {
            const mes = r.data_pagamento.substring(0, 7);
            receitaPorMes[mes] = (receitaPorMes[mes] || 0) + (r.total || 0);
          }
        });

        const receitaMensal = Object.entries(receitaPorMes)
          .map(([mes, valor]) => ({ mes, valor }))
          .sort((a, b) => b.mes.localeCompare(a.mes))
          .slice(0, 12);

        return new Response(JSON.stringify({
          success: true,
          data: {
            cedente,
            resumo: {
              primeiraOperacao: primeiraOp,
              ultimaOperacao: ultimaOp,
              totalOperacoes,
              valorBrutoTotal,
              valorLiquidoTotal,
              receitaTotal,
            },
            carteira: {
              total: carteiraTotal,
              vencidos: carteiraVencidos,
              percentualVencido: carteiraTotal > 0 ? (carteiraVencidos / carteiraTotal) * 100 : 0,
              porTipo: Object.entries(carteiraPorTipo).map(([tipo, dados]) => ({
                tipo,
                ...dados,
                percentualRisco: carteiraTotal > 0 ? (dados.risco / carteiraTotal) * 100 : 0
              }))
            },
            concentracaoSacados: topSacados,
            liquidez: {
              totalQuitados,
              valorQuitado,
              totalRecomprados,
              valorRecomprado,
              percentualPontual,
              percentualAtraso,
              percentualRecompra,
              percentualLiquidado: 100 - percentualRecompra,
            },
            receitaMensal,
            ultimasOperacoes: operacoes?.slice(0, 10) || [],
            ultimaReceitas: receitas?.slice(0, 10) || [],
          }
        }), {
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
    console.error('Cedente info error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
