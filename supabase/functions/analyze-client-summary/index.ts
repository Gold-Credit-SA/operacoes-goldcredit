import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Você é um analista sênior de crédito em uma securitizadora de alto nível.
Sua missão é compilar um PARECER DE CRÉDITO COMPLETO, consolidando TODAS as fontes disponíveis em um único documento estruturado.

Devolva APENAS um JSON válido seguindo EXATAMENTE a estrutura abaixo. NÃO invente dados — se uma fonte não estiver disponível, informe claramente.

{
  "alertaCritico": "string ou null — se houver LIMINAR JUDICIAL, FALÊNCIA, RECUPERAÇÃO JUDICIAL ou qualquer impedimento grave detectado, descreva aqui. Se não houver, null.",

  "smart": {
    "disponivel": true/false,
    "ultimasOperacoes": "Detalhe as últimas operações: quantidade de operações, volume total operado (R$), datas das operações mais recentes, evolução do volume (crescente/decrescente/estável). Se não disponível: 'Não houve consulta Smart.'",
    "resumoFinanceiro": "Receita total gerada, volume operado acumulado, prazo médio das operações (em dias), ticket médio por operação. Se não disponível: 'Não houve consulta Smart.'",
    "limite": "Limite aprovado (R$), limite utilizado (R$), limite disponível (R$), percentual de utilização. Indique se o limite está próximo do teto. Se não disponível: 'Não houve consulta Smart.'",
    "concentracao": "Análise de concentração de sacados: quantos sacados distintos, % do maior sacado no volume total, se há dependência excessiva (acima de 30% em um único sacado). Liste os 3 maiores sacados se disponível. Se não disponível: 'Não houve consulta Smart.'",
    "liquidez": "Taxa de liquidez geral, títulos pagos vs em aberto, percentual de inadimplência, títulos vencidos há mais de 30/60/90 dias, taxa de recompra. Se não disponível: 'Não houve consulta Smart.'",
    "taxaConfirmacao": "Taxa de confirmação dos títulos (% confirmados vs total). Se não disponível: 'Não houve consulta Smart.'",
    "comportamentoPagamento": "Padrão de pagamento dos últimos 90 dias: pagos no prazo, pagos com atraso, em aberto. Tendência de melhora ou piora. Se não disponível: 'Não houve consulta Smart.'"
  },

  "serasa": {
    "disponivel": true/false,
    "mensagem": "Se não houver consulta Serasa, informe: 'Não houve consulta Serasa para este cliente.' e NÃO preencha os demais campos com dados inventados.",
    "tipoRelatorio": "Indique qual relatório foi consultado: Básico PF, Avançado PF, Básico PJ ou Avançado PJ.",
    "liminarJudicial": true/false,
    "alertaLiminar": "Descreva a liminar/impedimento judicial se existir. Se não houver: null.",

    "identificacao": "Razão social/Nome, CNPJ/CPF, situação na Receita Federal, data de fundação/nascimento, endereço, capital social (se PJ). Se não disponível: 'Sem dados.'",
    "score": "Score numérico, faixa (ex: A-E), probabilidade de pagamento (%), modelo utilizado (ex: HPJM). Interprete: score acima de 700 é bom, abaixo de 300 é crítico. Se não disponível: 'Sem dados.'",
    "limiteCreditoSugerido": "Valor do limite de crédito sugerido pela Serasa (modelo HLC1 ou HLC3), se disponível. Se não disponível: 'Sem dados.'",

    "anotacoesNegativas": "Resumo consolidado: total de PEFIN (pendências financeiras), REFIN (restrições financeiras), Dívidas Vencidas, Protestos e Cheques sem fundo. Para cada tipo: quantidade, valor total (R$), data mais recente. Se não disponível: 'Sem dados.'",
    "acoesFalencias": "Ações judiciais, falências e recuperação judicial: quantidade, valores, datas. Se não disponível: 'Sem dados.'",
    "chequesSustados": "Cheques sustados/devolvidos: quantidade e período. Se não disponível: 'Sem dados.'",

    "ultimasConsultas": "Total de consultas nos últimos 13 meses. Diferencie: consultas de empresas do ramo PRODUTIVO (comércio, indústria, serviços) vs FINANCEIRAS (bancos, factoring, securitizadoras). Muitas consultas financeiras pode indicar busca excessiva por crédito. Se não disponível: 'Sem dados.'",

    "qsa": "Quadro societário: lista de sócios/administradores, CPFs, participação (%), se possuem restrições em seus nomes. Se não disponível: 'Sem dados.'",
    "historicoPagamento": "Resumo do comportamento de pagamento (se relatório avançado): pontualidade, atrasos, evolução mensal. Se não disponível: 'Sem dados.'",
    "relacionamentoMercado": "Dados de relacionamento com mercado/factoring (se relatório avançado PJ): número de fornecedores, tempo de relacionamento, volume. Se não disponível: 'Sem dados.'",
    "evolucaoCompromissos": "Evolução dos compromissos ao longo do tempo (se relatório avançado PJ): tendência de crescimento ou redução de dívidas. Se não disponível: 'Sem dados.'"
  },

  "scr": {
    "disponivel": true/false,
    "mensagem": "Se não houver consulta SCR, informe: 'Não houve consulta SCR para este cliente.' e NÃO preencha os demais campos.",

    "resumoGeral": "Visão geral: total de operações, total de instituições financeiras, carteira ativa total (R$), início do relacionamento bancário, documentos/volume processado (%). Se não disponível: 'Sem dados.'",
    "creditosAVencer": "Total de créditos a vencer (R$), distribuição por prazos (30d, 60d, 90d, 180d, 360d, acima). Se não disponível: 'Sem dados.'",
    "creditosVencidos": "Total de créditos vencidos (R$), distribuição por tempo de atraso (até 15d, 30d, 60d, 90d, 180d, acima). ALERTE se houver volume relevante vencido. Se não disponível: 'Sem dados.'",
    "modalidades": "Principais modalidades de crédito utilizadas: empréstimos (capital de giro, cheque especial), títulos descontados (duplicatas), financiamentos, outros. Valores por modalidade. Se não disponível: 'Sem dados.'",
    "limitesCredito": "Limites de crédito concedidos: cheque especial, cartão, capital de giro rotativo, outros. Valores individuais e total. Se não disponível: 'Sem dados.'",
    "classificacaoRisco": "Classificação de risco predominante (AA a HH). Se houver operações com classificação E-HH, ALERTE. Se não disponível: 'Sem dados.'",
    "discordanciaSubJudice": "Operações em discordância e sub judice: quantidade. Se houver, isso indica disputas com credores. Se não disponível: 'Sem dados.'"
  },

  "analiseCruzada": {
    "consistenciaEndividamento": "Compare o endividamento bancário do SCR com as anotações negativas do Serasa. Se o SCR mostra endividamento alto E o Serasa mostra anotações, o risco é agravado. Se não há dados suficientes: 'Dados insuficientes para análise cruzada.'",
    "capacidadePagamento": "Cruze a liquidez/comportamento do Smart com o score Serasa e classificação SCR. O cedente tem capacidade de honrar seus compromissos? Se não há dados suficientes: 'Dados insuficientes para análise cruzada.'",
    "sinaisAlerta": "Liste todos os sinais de alerta identificados: score baixo + inadimplência SCR, concentração excessiva de sacados, muitas consultas financeiras, operações em discordância, etc. Se não houver: 'Nenhum sinal de alerta identificado.'"
  },

  "parecerFinal": {
    "parecer": "FAVORAVEL | FAVORAVEL_COM_RESTRICOES | ATENCAO | DESFAVORAVEL",
    "justificativa": "Justificativa detalhada e objetiva consolidando TODAS as fontes. Explique os fatores positivos e negativos. Recomende ações (ex: solicitar garantias adicionais, reduzir limite, monitorar mensalmente).",
    "recomendacoes": ["lista de recomendações práticas para a operação (ex: 'Solicitar garantia real', 'Reduzir concentração em sacado X', 'Monitorar SCR mensalmente')"]
  }
}

REGRAS CRÍTICAS:
1. Se uma fonte NÃO estiver presente (null), marque "disponivel": false. NUNCA invente números ou dados.
2. LIMINAR JUDICIAL, FALÊNCIA ou RECUPERAÇÃO JUDICIAL = NEGATIVA IMEDIATA. O "alertaCritico" deve conter um alerta grave e o parecer DESFAVORÁVEL.
3. No campo "ultimasConsultas" do Serasa, SEMPRE diferencie consultas produtivas de financeiras.
4. Na "analiseCruzada", cruze ativamente os dados entre fontes para identificar inconsistências ou agravamentos de risco.
5. As "recomendacoes" devem ser práticas e acionáveis para o analista.
6. Seja DETALHADO em cada tópico — extraia o máximo de informação dos dados fornecidos.
7. NÃO inclua dados da AgRisk.
8. Valores monetários devem ser formatados em R$ com separador de milhar.
9. Percentuais devem incluir o símbolo %.
10. FORMATO DOS CAMPOS SEM DADOS: Quando um campo específico não tiver dados disponíveis, use EXATAMENTE "Sem dados." — sem explicações adicionais, sem parênteses, sem justificativas técnicas. Apenas "Sem dados." A explicação da ausência deve ir na justificativa do parecer final se relevante.
11. CONCISÃO: Cada tópico deve ter no máximo 3-4 frases objetivas. Não repita informações entre tópicos. Use bullet points com • para listar itens quando houver mais de 2 elementos.
12. O campo "resumoGeral" do SCR deve consolidar: período consultado, total de instituições, total de operações, carteira ativa total (somando resVenc de todas as operações não-limite). Use os códigos de modalidade (mod) para classificar: 02xx=Empréstimos, 03xx=Títulos Descontados, 04xx=Financiamentos, 13xx/19xx=Outros. Os buckets v110-v200 são créditos a vencer, v10-v100 são vencidos.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientProfile, sourceData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const context = JSON.stringify({ clientProfile, sourceData });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from AI");
    }

    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-client-summary:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
