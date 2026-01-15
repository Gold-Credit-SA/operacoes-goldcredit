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

        // Calcular taxa média: (desagio / valor_bruto / prazo_medio) * 30 * 100
        // Onde desagio = valor_bruto - valor_liquido
        const taxasOperacoes = operacoes?.filter(op => 
          op.valor_bruto && op.valor_bruto > 0 && op.prazo_medio && op.prazo_medio > 0
        ).map(op => {
          const desagio = op.valor_bruto - (op.valor_liquido || 0);
          return (desagio / op.valor_bruto / op.prazo_medio) * 30 * 100;
        }) || [];
        const taxaMedia = taxasOperacoes.length > 0 
          ? taxasOperacoes.reduce((acc, taxa) => acc + taxa, 0) / taxasOperacoes.length 
          : 0;

        // Calcular limites
        const limiteGlobal = cedente.limite_global || 0;
        const riscoAtual = cedente.risco_atual || 0;
        const limiteDisponivel = Math.max(0, limiteGlobal - riscoAtual);
        const saldo = cedente.saldo || 0;

        // Calcular carteira (títulos em aberto)
        const carteiraTotal = titulosAberto?.reduce((acc, t) => acc + (t.valor || 0), 0) || 0;
        const carteiraVencidos = titulosAberto?.filter(t => {
          if (!t.vencimento) return false;
          return new Date(t.vencimento) < new Date();
        }).reduce((acc, t) => acc + (t.valor || 0), 0) || 0;

        // Calcular taxa de confirmação
        const confirmacaoStats = {
          confirmado: { qtd: 0, valor: 0 },     // conf = 'C'
          parcial: { qtd: 0, valor: 0 },        // conf = 'CI'
          pendente: { qtd: 0, valor: 0 },       // conf = 'P'
          semConfirmacao: { qtd: 0, valor: 0 }  // conf = null ou vazio
        };

        titulosAberto?.forEach(t => {
          const valor = t.valor || 0;
          const conf = t.conf?.toUpperCase();
          
          if (conf === 'C') {
            confirmacaoStats.confirmado.qtd++;
            confirmacaoStats.confirmado.valor += valor;
          } else if (conf === 'CI') {
            confirmacaoStats.parcial.qtd++;
            confirmacaoStats.parcial.valor += valor;
          } else if (conf === 'P') {
            confirmacaoStats.pendente.qtd++;
            confirmacaoStats.pendente.valor += valor;
          } else {
            confirmacaoStats.semConfirmacao.qtd++;
            confirmacaoStats.semConfirmacao.valor += valor;
          }
        });

        const totalTitulosAberto = titulosAberto?.length || 0;
        const totalValorAberto = carteiraTotal;

        const confirmacao = {
          confirmado: {
            qtd: confirmacaoStats.confirmado.qtd,
            valor: confirmacaoStats.confirmado.valor,
            percentual: totalTitulosAberto > 0 ? (confirmacaoStats.confirmado.qtd / totalTitulosAberto) * 100 : 0
          },
          parcial: {
            qtd: confirmacaoStats.parcial.qtd,
            valor: confirmacaoStats.parcial.valor,
            percentual: totalTitulosAberto > 0 ? (confirmacaoStats.parcial.qtd / totalTitulosAberto) * 100 : 0
          },
          pendente: {
            qtd: confirmacaoStats.pendente.qtd,
            valor: confirmacaoStats.pendente.valor,
            percentual: totalTitulosAberto > 0 ? (confirmacaoStats.pendente.qtd / totalTitulosAberto) * 100 : 0
          },
          semConfirmacao: {
            qtd: confirmacaoStats.semConfirmacao.qtd,
            valor: confirmacaoStats.semConfirmacao.valor,
            percentual: totalTitulosAberto > 0 ? (confirmacaoStats.semConfirmacao.qtd / totalTitulosAberto) * 100 : 0
          },
          total: {
            qtd: totalTitulosAberto,
            valor: totalValorAberto
          }
        };

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

        console.log('Cedente detail fetched successfully:', cpf_cnpj);

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
              taxaMedia,
            },
            limites: {
              global: limiteGlobal,
              disponivel: limiteDisponivel,
              risco: riscoAtual,
              saldo: saldo,
            },
            confirmacao,
            carteira: {
              total: carteiraTotal,
              vencidos: carteiraVencidos,
              percentualVencido: carteiraTotal > 0 ? (carteiraVencidos / carteiraTotal) * 100 : 0,
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
            ultimasOperacoes: operacoes?.slice(0, 10).map(op => {
              // Fórmula: (desagio / valor_bruto / prazo_medio) * 30 * 100
              const desagio = (op.valor_bruto || 0) - (op.valor_liquido || 0);
              const taxa = op.valor_bruto && op.valor_bruto > 0 && op.prazo_medio && op.prazo_medio > 0
                ? (desagio / op.valor_bruto / op.prazo_medio) * 30 * 100
                : 0;
              return {
                id: op.id,
                operacao: op.operacao,
                data: op.data,
                valor_bruto: op.valor_bruto,
                valor_liquido: op.valor_liquido,
                prazo_medio: op.prazo_medio,
                valor_taxa: taxa,
                etapa: op.etapa
              };
            }) || [],
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
