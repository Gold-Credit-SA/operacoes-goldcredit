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

        // Buscar títulos em aberto (apenas convencionais, nunca trustee)
        const { data: titulosAberto } = await supabase
          .from('titulos_em_aberto')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj)
          .eq('tipo', 'C') // Apenas títulos convencionais
          .order('vencimento', { ascending: true });

        // Buscar títulos quitados (ordenar por data de quitação, mais recentes primeiro)
        const { data: titulosQuitados } = await supabase
          .from('titulos_quitados')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj)
          .order('quitacao', { ascending: false });

        // Buscar títulos recomprados
        const { data: titulosRecomprados } = await supabase
          .from('titulos_recomprados')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj);

        // Buscar títulos prorrogados
        const { data: titulosProrrogados } = await supabase
          .from('titulos_prorrogados')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj);

        // Buscar títulos com suspeita de fraude
        const { data: suspeitasFraude } = await supabase
          .from('titulos_quitados_suspeita_fraude')
          .select('*')
          .eq('cpf_cnpj_cedente', cpf_cnpj)
          .order('data_quitacao', { ascending: false });

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

        // Calcular prazo médio geral das operações
        const prazosMedios = operacoes?.filter(op => op.prazo_medio && op.prazo_medio > 0).map(op => op.prazo_medio) || [];
        const prazoMedioOperacoes = prazosMedios.length > 0 
          ? prazosMedios.reduce((acc, p) => acc + p, 0) / prazosMedios.length 
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

        // ============ NOVAS MÉTRICAS ============

        // Calcular receita total gerada (soma de todas as receitas)
        const receitaGerada = receitas?.reduce((acc, r) => acc + (r.total || 0), 0) || 0;

        // Calcular valor médio dos borderôs (operações)
        const valorMedioBorderos = totalOperacoes > 0 ? valorBrutoTotal / totalOperacoes : 0;

        // Calcular valor médio dos títulos em aberto
        const valorMedioTitulos = totalTitulosAberto > 0 ? carteiraTotal / totalTitulosAberto : 0;

        // Calcular percentual de prorrogação
        const totalProrrogados = titulosProrrogados?.length || 0;
        const percentualProrrogacao = totalTitulosHistorico > 0 ? (totalProrrogados / totalTitulosHistorico) * 100 : 0;

        // Calcular média de dias de atraso nos títulos quitados em atraso
        const diasAtrasoList = titulosQuitados?.filter(t => {
          if (!t.quitacao || !t.vencimento) return false;
          return new Date(t.quitacao) > new Date(t.vencimento);
        }).map(t => {
          const quitacao = new Date(t.quitacao!);
          const vencimento = new Date(t.vencimento!);
          return Math.ceil((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
        }) || [];
        const mediaPagoEmAtraso = diasAtrasoList.length > 0 
          ? diasAtrasoList.reduce((acc, d) => acc + d, 0) / diasAtrasoList.length 
          : 0;

        // Cheques devolvidos (tipo contém 'CHQ' ou 'CHEQUE')
        const chqDevolvidosAberto = titulosAberto?.filter(t => {
          const tipo = (t.tipo || '').toUpperCase();
          const motivo = (t.motivo || '').toUpperCase();
          return (tipo.includes('CHQ') || tipo.includes('CHEQUE')) && 
                 (motivo.includes('DEV') || motivo.includes('DEVOLV'));
        }).length || 0;

        const chqDevolvidosQuitado = titulosQuitados?.filter(t => {
          const tipo = (t.tipo || '').toUpperCase();
          const motivoDev = (t.motivo_devolucao || '').toUpperCase();
          return (tipo.includes('CHQ') || tipo.includes('CHEQUE')) && motivoDev.length > 0;
        }).length || 0;

        // ============ COMPORTAMENTO 90 DIAS ============
        const hoje = new Date();
        const data90DiasAtras = new Date();
        data90DiasAtras.setDate(hoje.getDate() - 90);

        // Filtrar títulos quitados nos últimos 90 dias
        const quitados90Dias = titulosQuitados?.filter(t => {
          if (!t.quitacao) return false;
          const dataQuit = new Date(t.quitacao);
          return dataQuit >= data90DiasAtras && dataQuit <= hoje;
        }) || [];

        // Filtrar recompras nos últimos 90 dias
        const recompras90Dias = titulosRecomprados?.filter(t => {
          if (!t.recompra) return false;
          const dataRecompra = new Date(t.recompra);
          return dataRecompra >= data90DiasAtras && dataRecompra <= hoje;
        }) || [];

        // Calcular comportamento de pagamento
        const comportamento = {
          pontual: { valor: 0, qtd: 0 },
          atraso5: { valor: 0, qtd: 0 },
          atraso15: { valor: 0, qtd: 0 },
          atraso30: { valor: 0, qtd: 0 },
          atrasoMais30: { valor: 0, qtd: 0 },
          recompra: { valor: 0, qtd: 0 },
          repasse: { valor: 0, qtd: 0 },
          cartorio: { valor: 0, qtd: 0 },
        };

        quitados90Dias.forEach(t => {
          const valor = t.valor_liquidado || t.valor_face || 0;
          const tipoQuit = (t.tipo_quitacao || '').toUpperCase();
          
          // Verificar se é cartório
          if (tipoQuit.includes('CART') || tipoQuit.includes('PROTESTO')) {
            comportamento.cartorio.valor += valor;
            comportamento.cartorio.qtd++;
            return;
          }

          // Verificar se é repasse/pendência
          if (tipoQuit.includes('REPASSE') || tipoQuit.includes('PEND')) {
            comportamento.repasse.valor += valor;
            comportamento.repasse.qtd++;
            return;
          }

          // Calcular dias de atraso
          if (t.quitacao && t.vencimento) {
            const quitacao = new Date(t.quitacao);
            const vencimento = new Date(t.vencimento);
            const diasAtraso = Math.ceil((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

            if (diasAtraso <= 0) {
              comportamento.pontual.valor += valor;
              comportamento.pontual.qtd++;
            } else if (diasAtraso <= 5) {
              comportamento.atraso5.valor += valor;
              comportamento.atraso5.qtd++;
            } else if (diasAtraso <= 15) {
              comportamento.atraso15.valor += valor;
              comportamento.atraso15.qtd++;
            } else if (diasAtraso <= 30) {
              comportamento.atraso30.valor += valor;
              comportamento.atraso30.qtd++;
            } else {
              comportamento.atrasoMais30.valor += valor;
              comportamento.atrasoMais30.qtd++;
            }
          } else {
            // Se não tem data de vencimento, considerar pontual
            comportamento.pontual.valor += valor;
            comportamento.pontual.qtd++;
          }
        });

        // Adicionar recompras
        recompras90Dias.forEach(t => {
          const valor = t.valor_face || 0;
          comportamento.recompra.valor += valor;
          comportamento.recompra.qtd++;
        });

        // Calcular totais e percentuais
        const totalPago90Dias = Object.values(comportamento).reduce((acc, c) => acc + c.valor, 0);
        const totalQtd90Dias = Object.values(comportamento).reduce((acc, c) => acc + c.qtd, 0);

        // Títulos em atraso (abertos vencidos)
        const titulosEmAtraso = titulosAberto?.filter(t => {
          if (!t.vencimento) return false;
          return new Date(t.vencimento) < hoje;
        }) || [];
        const valorEmAtraso = titulosEmAtraso.reduce((acc, t) => acc + (t.valor || 0), 0);
        const qtdEmAtraso = titulosEmAtraso.length;

        const comportamento90Dias = {
          pontual: { 
            valor: comportamento.pontual.valor, 
            qtd: comportamento.pontual.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.pontual.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.pontual.qtd / totalQtd90Dias) * 100 : 0,
          },
          atraso5: { 
            valor: comportamento.atraso5.valor, 
            qtd: comportamento.atraso5.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.atraso5.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.atraso5.qtd / totalQtd90Dias) * 100 : 0,
          },
          atraso15: { 
            valor: comportamento.atraso15.valor, 
            qtd: comportamento.atraso15.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.atraso15.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.atraso15.qtd / totalQtd90Dias) * 100 : 0,
          },
          atraso30: { 
            valor: comportamento.atraso30.valor, 
            qtd: comportamento.atraso30.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.atraso30.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.atraso30.qtd / totalQtd90Dias) * 100 : 0,
          },
          atrasoMais30: { 
            valor: comportamento.atrasoMais30.valor, 
            qtd: comportamento.atrasoMais30.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.atrasoMais30.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.atrasoMais30.qtd / totalQtd90Dias) * 100 : 0,
          },
          recompra: { 
            valor: comportamento.recompra.valor, 
            qtd: comportamento.recompra.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.recompra.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.recompra.qtd / totalQtd90Dias) * 100 : 0,
          },
          repasse: { 
            valor: comportamento.repasse.valor, 
            qtd: comportamento.repasse.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.repasse.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.repasse.qtd / totalQtd90Dias) * 100 : 0,
          },
          cartorio: { 
            valor: comportamento.cartorio.valor, 
            qtd: comportamento.cartorio.qtd,
            percentualValor: totalPago90Dias > 0 ? (comportamento.cartorio.valor / totalPago90Dias) * 100 : 0,
            percentualQtd: totalQtd90Dias > 0 ? (comportamento.cartorio.qtd / totalQtd90Dias) * 100 : 0,
          },
          totalPago: { 
            valor: totalPago90Dias, 
            qtd: totalQtd90Dias 
          },
          emAtraso: { 
            valor: valorEmAtraso, 
            qtd: qtdEmAtraso,
            percentualValor: carteiraTotal > 0 ? (valorEmAtraso / carteiraTotal) * 100 : 0,
            percentualQtd: totalTitulosAberto > 0 ? (qtdEmAtraso / totalTitulosAberto) * 100 : 0,
          },
        };

        // Prazo médio dos títulos vencidos nos últimos 90 dias
        const titulosVencidos90Dias = titulosAberto?.filter(t => {
          if (!t.vencimento) return false;
          const venc = new Date(t.vencimento);
          return venc >= data90DiasAtras && venc <= hoje;
        }) || [];
        
        // Calcular prazo médio como dias até vencimento a partir da emissão
        const prazosTitulos90Dias = titulosVencidos90Dias.filter(t => t.data_emissao && t.vencimento).map(t => {
          const emissao = new Date(t.data_emissao!);
          const vencimento = new Date(t.vencimento!);
          return Math.ceil((vencimento.getTime() - emissao.getTime()) / (1000 * 60 * 60 * 24));
        });
        const prazoMedioTitulos90Dias = prazosTitulos90Dias.length > 0 
          ? prazosTitulos90Dias.reduce((acc, p) => acc + p, 0) / prazosTitulos90Dias.length 
          : 0;

        const resumoExpandido = {
          volumeOperado: valorBrutoTotal,
          prazoMedioOperacoes: prazoMedioOperacoes,
          prazoMedioTitulos90Dias: prazoMedioTitulos90Dias,
          mediaPagoEmAtraso: mediaPagoEmAtraso,
          valorMedioBorderos: valorMedioBorderos,
          valorMedioTitulos: valorMedioTitulos,
          receitaGerada: receitaGerada,
          percentualProrrogacao: percentualProrrogacao,
          chqDevolvidosAberto: chqDevolvidosAberto,
          chqDevolvidosQuitado: chqDevolvidosQuitado,
        };

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
            resumoExpandido,
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
            comportamento90Dias,
            receitaMensal,
            // Títulos em aberto (todos)
            titulosAberto: titulosAberto?.map(t => ({
              id: t.id,
              documento: t.documento,
              sacado: t.sacado,
              cpf_cnpj_sacado: t.cpf_cnpj_sacado,
              valor: t.valor,
              vencimento: t.vencimento,
              situacao: t.situacao,
              conf: t.conf,
              etapa: t.etapa,
            })) || [],
            // Títulos quitados (todos)
            titulosQuitados: titulosQuitados?.map(t => ({
              id: t.id,
              numero: t.numero,
              sacado: t.sacado,
              cpf_cnpj_sacado: t.cpf_cnpj_sacado,
              valor_face: t.valor_face,
              valor_liquidado: t.valor_liquidado,
              vencimento: t.vencimento,
              quitacao: t.quitacao,
              status: t.status,
              tipo_quitacao: t.tipo_quitacao,
            })) || [],
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
            suspeitasFraude: suspeitasFraude?.map(sf => ({
              id: sf.id,
              sacado: sf.sacado,
              cpf_cnpj_sacado: sf.cpf_cnpj_sacado,
              numero_documento: sf.numero_documento,
              valor: sf.valor,
              vencimento: sf.vencimento,
              data_quitacao: sf.data_quitacao,
              criticas: sf.criticas,
              banco_cobrador: sf.banco_cobrador,
              agencia_cobradora: sf.agencia_cobradora,
              praca_pagamento: sf.praca_pagamento,
              localidade_sacado: sf.localidade_sacado,
            })) || [],
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
