import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, cedentes } = await req.json();

    // Conectar ao banco externo
    const pool = new Pool({
      hostname: Deno.env.get("EXTERNAL_DB_HOST")!,
      port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "5432"),
      database: Deno.env.get("EXTERNAL_DB_NAME")!,
      user: Deno.env.get("EXTERNAL_DB_USER")!,
      password: Deno.env.get("EXTERNAL_DB_PASS")!,
    }, 3);

    const connection = await pool.connect();

    try {
      if (action === 'list-all') {
        console.log("Buscando todos os cedentes com última operação...");

        // Buscar todos os cedentes
        const cedentesResult = await connection.queryObject<{
          cpf_cnpj: string;
          nome: string;
          limite_global: number;
          risco_atual: number;
          bloqueado: string;
          setor: string;
          uf: string;
          cidade: string;
        }>(`
          SELECT 
            cpf_cnpj,
            nome,
            limite_global,
            risco_atual,
            bloqueado,
            setor,
            uf,
            cidade
          FROM smartsecurities_cedentes
          ORDER BY nome ASC
        `);

        // Buscar última operação de cada cedente
        const operacoesResult = await connection.queryObject<{
          cpf_cnpj_cedente: string;
          ultima_operacao: Date;
        }>(`
          SELECT 
            cpf_cnpj_cedente,
            MAX(data) as ultima_operacao
          FROM smartsecurities_operacoes_individualizadas
          GROUP BY cpf_cnpj_cedente
        `);

        // Criar mapa de última operação
        const ultimaOperacaoMap: Record<string, Date> = {};
        for (const op of operacoesResult.rows) {
          ultimaOperacaoMap[op.cpf_cnpj_cedente] = op.ultima_operacao;
        }

        // Combinar dados
        const hoje = new Date();
        const resultado = cedentesResult.rows.map(ced => {
          const ultimaOp = ultimaOperacaoMap[ced.cpf_cnpj];
          const diasInativo = ultimaOp 
            ? Math.floor((hoje.getTime() - new Date(ultimaOp).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const limiteDisponivel = (ced.limite_global || 0) - (ced.risco_atual || 0);

          return {
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome,
            limite_global: ced.limite_global,
            limite_disponivel: limiteDisponivel,
            risco_atual: ced.risco_atual,
            bloqueado: ced.bloqueado,
            setor: ced.setor,
            uf: ced.uf,
            cidade: ced.cidade,
            ultima_operacao: ultimaOp ? new Date(ultimaOp).toISOString().split('T')[0] : null,
            dias_inativo: diasInativo,
          };
        });

        console.log(`Encontrados ${resultado.length} cedentes`);

        return new Response(JSON.stringify({ success: true, cedentes: resultado }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === 'analyze-batch') {
        console.log(`Analisando ${cedentes.length} cedentes em lote (análise determinística)`);

        // Buscar dados completos de cada cedente para análise
        const analises = [];
        
        for (const ced of cedentes) {
          // Buscar títulos em aberto (usa coluna 'valor', não 'valor_face')
          const titulosAbertosResult = await connection.queryObject<{
            valor: number;
            vencimento: Date;
            cpf_cnpj_sacado: string;
          }>(`
            SELECT valor, vencimento, cpf_cnpj_sacado
            FROM smartsecurities_titulos_em_aberto
            WHERE cpf_cnpj_cedente = $1
          `, [ced.cpf_cnpj]);

          // Buscar títulos quitados (últimos 90 dias)
          const data90diasAtras = new Date();
          data90diasAtras.setDate(data90diasAtras.getDate() - 90);
          
          const titulosQuitadosResult = await connection.queryObject<{
            valor_face: number;
            vencimento: Date;
            quitacao: Date;
          }>(`
            SELECT valor_face, vencimento, quitacao
            FROM smartsecurities_titulos_quitados
            WHERE cpf_cnpj_cedente = $1
            AND quitacao >= $2
          `, [ced.cpf_cnpj, data90diasAtras.toISOString().split('T')[0]]);

          // Buscar recompras
          const recomprasResult = await connection.queryObject<{
            valor_face: number;
          }>(`
            SELECT valor_face
            FROM smartsecurities_titulos_recomprados
            WHERE cpf_cnpj_cedente = $1
          `, [ced.cpf_cnpj]);

          const titulosAbertos = titulosAbertosResult.rows;
          const titulosQuitados = titulosQuitadosResult.rows;
          const recompras = recomprasResult.rows;

          // Calcular métricas
          const totalAberto = titulosAbertos.reduce((sum, t) => sum + (t.valor || 0), 0);
          const totalVencido = titulosAbertos
            .filter(t => new Date(t.vencimento) < new Date())
            .reduce((sum, t) => sum + (t.valor || 0), 0);
          const percentualVencido = totalAberto > 0 ? (totalVencido / totalAberto) * 100 : 0;

          // Calcular concentração de sacados
          const sacadosMap: Record<string, number> = {};
          titulosAbertos.forEach(t => {
            const sacado = t.cpf_cnpj_sacado || 'Desconhecido';
            sacadosMap[sacado] = (sacadosMap[sacado] || 0) + (t.valor || 0);
          });
          
          const sacadosOrdenados = Object.entries(sacadosMap)
            .sort((a, b) => b[1] - a[1]);
          const concentracaoTop1 = sacadosOrdenados.length > 0 && totalAberto > 0
            ? (sacadosOrdenados[0][1] / totalAberto) * 100 : 0;
          const concentracaoTop3Soma = sacadosOrdenados.slice(0, 3)
            .reduce((sum, [_, valor]) => sum + (totalAberto > 0 ? (valor / totalAberto) * 100 : 0), 0);
          const qtdSacados = Object.keys(sacadosMap).length;

          // Calcular taxa de recompra
          const totalRecomprado = recompras.reduce((sum, t) => sum + (t.valor_face || 0), 0);
          const totalOperado = (ced.limite_global || 0);
          const taxaRecompra = totalOperado > 0 ? (totalRecomprado / totalOperado) * 100 : 0;

          // Calcular liquidez (pagamentos nos últimos 90 dias)
          const pagamentosPontuais = titulosQuitados
            .filter(t => new Date(t.quitacao) <= new Date(t.vencimento))
            .reduce((sum, t) => sum + (t.valor_face || 0), 0);

          const totalQuitado = titulosQuitados.reduce((sum, t) => sum + (t.valor_face || 0), 0);
          const taxaPontualidade = totalQuitado > 0 ? (pagamentosPontuais / totalQuitado) * 100 : 0;

          // Calcular dias de atraso médio
          const titulosAtrasados = titulosQuitados.filter(t => 
            new Date(t.quitacao) > new Date(t.vencimento)
          );
          
          const diasAtrasoTotal = titulosAtrasados.reduce((sum, t) => {
            const venc = new Date(t.vencimento);
            const quit = new Date(t.quitacao);
            return sum + Math.floor((quit.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
          }, 0);
          const mediaAtraso = titulosAtrasados.length > 0 ? diasAtrasoTotal / titulosAtrasados.length : 0;

          const utilizacaoLimite = ced.limite_global > 0 
            ? ((ced.risco_atual || 0) / ced.limite_global) * 100 
            : 0;
          const limiteDisponivel = (ced.limite_global || 0) - (ced.risco_atual || 0);
          const bloqueado = ced.bloqueado === 'S';

          // ANÁLISE DETERMINÍSTICA
          const alertas: string[] = [];
          const indicadoresPositivos: string[] = [];
          let indicadoresCriticos = 0;
          let indicadoresAlerta = 0;
          let score = 100;

          // 1. INADIMPLÊNCIA (peso alto)
          if (percentualVencido > 30) {
            alertas.push(`Inadimplência crítica: ${percentualVencido.toFixed(1)}% dos títulos vencidos`);
            indicadoresCriticos++;
            score -= 25;
          } else if (percentualVencido > 15) {
            alertas.push(`Inadimplência elevada: ${percentualVencido.toFixed(1)}% dos títulos vencidos`);
            indicadoresAlerta++;
            score -= 15;
          } else if (percentualVencido < 5) {
            indicadoresPositivos.push(`Baixa inadimplência (${percentualVencido.toFixed(1)}%)`);
          }

          // 2. CONCENTRAÇÃO DE SACADOS (peso alto)
          if (concentracaoTop1 > 50) {
            alertas.push(`Concentração crítica: ${concentracaoTop1.toFixed(1)}% em um único sacado`);
            indicadoresCriticos++;
            score -= 20;
          } else if (concentracaoTop3Soma > 80) {
            alertas.push(`Alta concentração: ${concentracaoTop3Soma.toFixed(1)}% nos 3 maiores sacados`);
            indicadoresAlerta++;
            score -= 10;
          }
          if (qtdSacados < 3 && qtdSacados > 0) {
            alertas.push(`Baixa diversificação: apenas ${qtdSacados} sacado(s)`);
            indicadoresAlerta++;
            score -= 10;
          } else if (qtdSacados >= 5) {
            indicadoresPositivos.push(`Boa diversificação (${qtdSacados} sacados)`);
          }

          // 3. TAXA DE RECOMPRA (peso alto)
          if (taxaRecompra > 20) {
            alertas.push(`Taxa de recompra crítica: ${taxaRecompra.toFixed(1)}%`);
            indicadoresCriticos++;
            score -= 20;
          } else if (taxaRecompra > 10) {
            alertas.push(`Taxa de recompra elevada: ${taxaRecompra.toFixed(1)}%`);
            indicadoresAlerta++;
            score -= 10;
          } else if (taxaRecompra < 5) {
            indicadoresPositivos.push(`Baixa taxa de recompra (${taxaRecompra.toFixed(1)}%)`);
          }

          // 4. LIQUIDEZ/PONTUALIDADE (peso médio)
          if (taxaPontualidade < 50) {
            alertas.push(`Pontualidade crítica: apenas ${taxaPontualidade.toFixed(1)}% pagos em dia`);
            indicadoresCriticos++;
            score -= 15;
          } else if (taxaPontualidade < 70) {
            alertas.push(`Pontualidade baixa: ${taxaPontualidade.toFixed(1)}% pagos em dia`);
            indicadoresAlerta++;
            score -= 8;
          } else if (taxaPontualidade >= 90) {
            indicadoresPositivos.push(`Excelente pontualidade (${taxaPontualidade.toFixed(1)}%)`);
          }

          if (mediaAtraso > 30) {
            alertas.push(`Atraso médio crítico: ${mediaAtraso.toFixed(0)} dias`);
            indicadoresCriticos++;
            score -= 15;
          } else if (mediaAtraso > 15) {
            alertas.push(`Atraso médio elevado: ${mediaAtraso.toFixed(0)} dias`);
            indicadoresAlerta++;
            score -= 8;
          }

          // 5. UTILIZAÇÃO DE LIMITE (peso médio)
          if (utilizacaoLimite > 100) {
            alertas.push(`Limite excedido: ${utilizacaoLimite.toFixed(1)}% utilizado`);
            indicadoresCriticos++;
            score -= 20;
          } else if (utilizacaoLimite > 90) {
            alertas.push(`Limite quase esgotado: ${utilizacaoLimite.toFixed(1)}% utilizado`);
            indicadoresAlerta++;
            score -= 10;
          } else if (utilizacaoLimite < 50) {
            indicadoresPositivos.push(`Boa margem de limite (${(100 - utilizacaoLimite).toFixed(1)}% disponível)`);
          }

          if (limiteDisponivel <= 0) {
            alertas.push('Sem limite disponível para novas operações');
            indicadoresCriticos++;
            score -= 15;
          }

          // 6. STATUS
          if (bloqueado) {
            alertas.push('Cedente bloqueado no sistema');
            indicadoresCriticos++;
            score -= 30;
          }

          // Garantir score entre 0 e 100
          score = Math.max(0, Math.min(100, score));

          // CLASSIFICAÇÃO FINAL
          // SAUDÁVEL: Não bloqueado, limite disponível > 0, sem indicadores CRÍTICOS, máx 1 ALERTA
          // NÃO SAUDÁVEL: Qualquer CRÍTICO, 2+ ALERTAS, bloqueado, sem limite disponível
          const saudavel = !bloqueado && 
                          limiteDisponivel > 0 && 
                          indicadoresCriticos === 0 && 
                          indicadoresAlerta <= 1;

          // Gerar motivo
          let motivo: string;
          if (saudavel) {
            if (indicadoresPositivos.length > 0) {
              motivo = `Cedente apresenta bons indicadores: ${indicadoresPositivos.slice(0, 2).join(', ')}. ` +
                      (indicadoresAlerta === 1 ? `Atenção: ${alertas[0]}.` : 'Sem alertas significativos.');
            } else {
              motivo = 'Cedente dentro dos parâmetros aceitáveis para operação, sem indicadores críticos identificados.';
            }
          } else {
            if (bloqueado) {
              motivo = 'Cedente está bloqueado no sistema e não pode operar. ';
            } else if (limiteDisponivel <= 0) {
              motivo = 'Cedente sem limite disponível para novas operações. ';
            } else if (indicadoresCriticos > 0) {
              motivo = `Cedente apresenta ${indicadoresCriticos} indicador(es) crítico(s): ${alertas.slice(0, 2).join('; ')}. `;
            } else {
              motivo = `Cedente apresenta ${indicadoresAlerta} indicadores em alerta: ${alertas.slice(0, 2).join('; ')}. `;
            }
            motivo += 'Não recomendado para giro de carteira no momento.';
          }

          analises.push({
            cpf_cnpj: ced.cpf_cnpj,
            saudavel,
            motivo,
            score,
            alertas,
            indicadores_positivos: indicadoresPositivos,
          });
        }

        console.log(`Análise determinística concluída: ${analises.length} cedentes processados`);

        return new Response(JSON.stringify({ success: true, analises }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } finally {
      connection.release();
      await pool.end();
    }

  } catch (error) {
    console.error("Error in giro-carteira:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
