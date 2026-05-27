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
          bloqueado: string;
          setor: string;
          uf: string;
          cidade: string;
        }>(`
          SELECT 
            cpf_cnpj,
            nome,
            limite_global,
            bloqueado,
            setor,
            uf,
            cidade
          FROM smartsecurities_cedentes
          ORDER BY nome ASC
        `);

        // Calcular risco real a partir dos títulos em aberto
        const riscoResult = await connection.queryObject<{
          cpf_cnpj_cedente: string;
          risco_calculado: number;
        }>(`
          SELECT cpf_cnpj_cedente, COALESCE(SUM(valor), 0) as risco_calculado
          FROM smartsecurities_titulos_em_aberto
          GROUP BY cpf_cnpj_cedente
        `);

        const riscoMap: Record<string, number> = {};
        for (const r of riscoResult.rows) {
          riscoMap[r.cpf_cnpj_cedente] = parseFloat(String(r.risco_calculado)) || 0;
        }

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
          const limiteGlobal = parseFloat(String(ced.limite_global)) || 0;
          const riscoAtual = riscoMap[ced.cpf_cnpj] || 0;
          const limiteDisponivel = limiteGlobal - riscoAtual;

          return {
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome,
            limite_global: limiteGlobal,
            limite_disponivel: limiteDisponivel,
            risco_atual: riscoAtual,
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

      if (action === 'behavior-all') {
        console.log("Analisando comportamento de giro de todos os cedentes...");

        const hoje = new Date();
        const d180 = new Date(); d180.setDate(d180.getDate() - 180);
        const d60 = new Date(); d60.setDate(d60.getDate() - 60);
        const d30 = new Date(); d30.setDate(d30.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        const cedentesResult = await connection.queryObject<{
          cpf_cnpj: string; nome: string; setor: string; uf: string; cidade: string;
          bloqueado: string; limite_global: number;
        }>(`
          SELECT cpf_cnpj, nome, setor, uf, cidade, bloqueado, limite_global
          FROM smartsecurities_cedentes
        `);

        const opsResult = await connection.queryObject<{
          cpf_cnpj_cedente: string; data: Date;
        }>(`
          SELECT cpf_cnpj_cedente, data
          FROM smartsecurities_operacoes_individualizadas
          WHERE data >= $1
        `, [fmt(d180)]);

        const ultimaOpResult = await connection.queryObject<{
          cpf_cnpj_cedente: string; ultima: Date;
        }>(`
          SELECT cpf_cnpj_cedente, MAX(data) as ultima
          FROM smartsecurities_operacoes_individualizadas
          GROUP BY cpf_cnpj_cedente
        `);

        const quit60Result = await connection.queryObject<{
          cpf_cnpj_cedente: string; quitacao: Date; valor_face: number;
        }>(`
          SELECT cpf_cnpj_cedente, quitacao, valor_face
          FROM smartsecurities_titulos_quitados
          WHERE quitacao >= $1
        `, [fmt(d60)]);

        // Risco atual = soma de títulos em aberto por cedente
        const riscoResult = await connection.queryObject<{
          cpf_cnpj_cedente: string; risco: number;
        }>(`
          SELECT cpf_cnpj_cedente, COALESCE(SUM(valor), 0) as risco
          FROM smartsecurities_titulos_em_aberto
          GROUP BY cpf_cnpj_cedente
        `);
        const riscoMap: Record<string, number> = {};
        for (const r of riscoResult.rows) {
          riscoMap[r.cpf_cnpj_cedente] = parseFloat(String(r.risco)) || 0;
        }

        const opsByCed: Record<string, Date[]> = {};
        for (const r of opsResult.rows) {
          (opsByCed[r.cpf_cnpj_cedente] ||= []).push(new Date(r.data));
        }
        const ultimaMap: Record<string, Date> = {};
        for (const r of ultimaOpResult.rows) ultimaMap[r.cpf_cnpj_cedente] = new Date(r.ultima);

        const quit30: Record<string, { qtd: number; valor: number }> = {};
        const quit60: Record<string, { qtd: number; valor: number }> = {};
        for (const r of quit60Result.rows) {
          const v = parseFloat(String(r.valor_face)) || 0;
          const q = new Date(r.quitacao);
          quit60[r.cpf_cnpj_cedente] ||= { qtd: 0, valor: 0 };
          quit60[r.cpf_cnpj_cedente].qtd++;
          quit60[r.cpf_cnpj_cedente].valor += v;
          if (q >= d30) {
            quit30[r.cpf_cnpj_cedente] ||= { qtd: 0, valor: 0 };
            quit30[r.cpf_cnpj_cedente].qtd++;
            quit30[r.cpf_cnpj_cedente].valor += v;
          }
        }


        const resultado = cedentesResult.rows.map(ced => {
          const ops = (opsByCed[ced.cpf_cnpj] || []).sort((a, b) => a.getTime() - b.getTime());
          const ultima = ultimaMap[ced.cpf_cnpj];
          const diasInativo = ultima ? Math.floor((hoje.getTime() - ultima.getTime()) / 86400000) : null;

          let diaMedioMes = 0;
          const semanaCount = [0, 0, 0, 0];
          for (const d of ops) {
            const dia = d.getDate();
            diaMedioMes += dia;
            const sem = Math.min(3, Math.floor((dia - 1) / 7));
            semanaCount[sem]++;
          }
          diaMedioMes = ops.length > 0 ? Math.round(diaMedioMes / ops.length) : 0;
          const semanaTop = semanaCount.indexOf(Math.max(...semanaCount)) + 1;

          let intervaloMedio = 0;
          if (ops.length >= 2) {
            let soma = 0;
            for (let i = 1; i < ops.length; i++) {
              soma += (ops[i].getTime() - ops[i - 1].getTime()) / 86400000;
            }
            intervaloMedio = Math.round(soma / (ops.length - 1));
          }

          const q30 = quit30[ced.cpf_cnpj] || { qtd: 0, valor: 0 };
          const q60 = quit60[ced.cpf_cnpj] || { qtd: 0, valor: 0 };
          const bloqueado = ced.bloqueado === 'S';
          const limiteGlobal = parseFloat(String(ced.limite_global)) || 0;
          const riscoAtual = riscoMap[ced.cpf_cnpj] || 0;
          const limiteDisponivel = limiteGlobal - riscoAtual;
          const excedente = riscoAtual - limiteGlobal; // >0 quando passou do limite
          const pctDisponivel = limiteGlobal > 0 ? (limiteDisponivel / limiteGlobal) * 100 : 0;

          let score = 30;
          const sinais: string[] = [];

          if (bloqueado) {
            score = 0;
          } else {
            // PRIORIDADE 1: Limite disponível (peso máximo 50 pts)
            if (limiteGlobal <= 0) {
              score -= 20;
              sinais.push('Sem limite global cadastrado');
            } else if (limiteDisponivel <= 0) {
              score -= 30;
              sinais.push(`Limite excedido em R$ ${excedente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — sem espaço para giro`);
            } else if (pctDisponivel >= 70) {
              score += 50;
              sinais.push(`Amplo limite disponível: R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pctDisponivel.toFixed(0)}% livre)`);
            } else if (pctDisponivel >= 40) {
              score += 35;
              sinais.push(`Bom limite disponível: R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pctDisponivel.toFixed(0)}% livre)`);
            } else if (pctDisponivel >= 15) {
              score += 18;
              sinais.push(`Limite disponível moderado: R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pctDisponivel.toFixed(0)}% livre)`);
            } else {
              score += 5;
              sinais.push(`Pouco limite disponível: R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pctDisponivel.toFixed(0)}% livre)`);
            }

            // PRIORIDADE 2: Liquidações recentes (até 20 pts)
            if (q30.qtd > 0) {
              score += 20;
              sinais.push(`${q30.qtd} título(s) liquidado(s) nos últimos 30 dias (R$ ${q30.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
            } else if (q60.qtd > 0) {
              score += 10;
              sinais.push(`${q60.qtd} título(s) liquidado(s) nos últimos 60 dias`);
            }

            // PRIORIDADE 3: Padrão de inatividade (até 15 pts)
            if (intervaloMedio > 0 && diasInativo !== null) {
              if (diasInativo > intervaloMedio * 1.5) {
                score += 15;
                sinais.push(`Inativo há ${diasInativo}d, acima do ritmo habitual (${intervaloMedio}d entre operações)`);
              } else if (diasInativo > intervaloMedio) {
                score += 8;
                sinais.push(`Inativo há ${diasInativo}d, levemente acima do ritmo (${intervaloMedio}d)`);
              } else if (diasInativo < intervaloMedio * 0.5) {
                score -= 10;
                sinais.push(`Operou recentemente (${diasInativo}d), abaixo do intervalo médio`);
              }
            } else if (diasInativo === null) {
              score -= 20;
              sinais.push('Sem operações nos últimos 180 dias');
            }

            // PRIORIDADE 4: Janela típica (até 10 pts)
            if (ops.length >= 6) {
              const semanaNome = ['1ª', '2ª', '3ª', '4ª'][semanaTop - 1];
              sinais.push(`Padrão: opera mais na ${semanaNome} semana do mês (dia médio ${diaMedioMes})`);
              const semanaAtual = Math.min(3, Math.floor((hoje.getDate() - 1) / 7)) + 1;
              if (semanaAtual === semanaTop || semanaAtual === semanaTop - 1) {
                score += 10;
                sinais.push('Entrando na janela típica de operação');
              }
            }
          }

          score = Math.max(0, Math.min(100, score));
          let recomendacao: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO' = 'BAIXA';
          if (bloqueado) recomendacao = 'NAO';
          else if (limiteDisponivel <= 0 && limiteGlobal > 0) recomendacao = 'NAO'; // sem espaço = não recomendado
          else if (score >= 75) recomendacao = 'ALTA';
          else if (score >= 55) recomendacao = 'MEDIA';

          let motivo: string;
          if (bloqueado) motivo = 'Cedente bloqueado — não recomendado.';
          else if (recomendacao === 'NAO') motivo = `Limite excedido em R$ ${excedente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — não há espaço para novas operações.`;
          else if (recomendacao === 'ALTA') motivo = `Forte oportunidade de giro. ${sinais.slice(0, 3).join('. ')}.`;
          else if (recomendacao === 'MEDIA') motivo = `Oportunidade moderada. ${sinais.slice(0, 2).join('. ')}.`;
          else motivo = sinais.length > 0 ? `Pouco potencial de giro agora. ${sinais.slice(0, 2).join('. ')}.` : 'Pouco potencial de giro agora.';

          return {
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome,
            setor: ced.setor,
            cidade: ced.cidade,
            uf: ced.uf,
            bloqueado: ced.bloqueado,
            limite_global: limiteGlobal,
            limite_disponivel: limiteDisponivel,
            risco_atual: riscoAtual,
            excedente: excedente > 0 ? excedente : 0,
            ultima_operacao: ultima ? fmt(ultima) : null,
            dias_inativo: diasInativo,
            total_ops_180d: ops.length,
            intervalo_medio_dias: intervaloMedio,
            dia_medio_mes: diaMedioMes,
            semana_mes_top: semanaTop,
            quitados_30d_qtd: q30.qtd,
            quitados_30d_valor: q30.valor,
            quitados_60d_qtd: q60.qtd,
            quitados_60d_valor: q60.valor,
            score_giro: score,
            recomendacao,
            motivo,
            sinais,
          };
        });

        // Ordenar: primeiro por recomendação (ALTA > MEDIA > BAIXA > NAO), depois por limite disponível desc, depois por score
        const recOrder = { ALTA: 0, MEDIA: 1, BAIXA: 2, NAO: 3 };
        resultado.sort((a, b) => {
          const r = recOrder[a.recomendacao] - recOrder[b.recomendacao];
          if (r !== 0) return r;
          if (b.limite_disponivel !== a.limite_disponivel) return b.limite_disponivel - a.limite_disponivel;
          return b.score_giro - a.score_giro;
        });

        console.log(`Análise comportamental concluída: ${resultado.length} cedentes`);
        return new Response(JSON.stringify({ success: true, cedentes: resultado }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === 'ai-narrative') {
        const ctx = cedentes && cedentes[0];
        if (!ctx) {
          return new Response(JSON.stringify({ error: 'cedente required' }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) {
          return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const prompt = `Você é um analista de crédito de FIDC/factoring. Com base nos dados comportamentais abaixo, escreva uma análise curta (máx 4 frases) em português recomendando ou não fazer giro de carteira com este cedente AGORA. Seja direto, mencione liquidações recentes e padrão de operação.\n\nDados:\n${JSON.stringify(ctx, null, 2)}`;
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!aiResp.ok) {
          const t = await aiResp.text();
          return new Response(JSON.stringify({ error: `AI ${aiResp.status}: ${t}` }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const aiJson = await aiResp.json();
        const narrativa = aiJson.choices?.[0]?.message?.content || '';
        return new Response(JSON.stringify({ success: true, narrativa }), {
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
