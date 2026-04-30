import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const today = new Date().toLocaleDateString("pt-BR");

const systemPrompt = `Você é um ANALISTA DE CRÉDITO SÊNIOR especializado em SECURITIZADORA e ANTECIPAÇÃO DE RECEBÍVEIS.
A data de HOJE é ${today}.

Sua função é analisar operações de antecipação de títulos com visão técnica, conservadora, objetiva e relacional.
A análise de crédito de uma securitizadora é DIFERENTE da análise bancária tradicional.

IMPORTANTE:
- Você NÃO age como banco.
- Você NÃO analisa apenas score ou restrição isoladamente.
- Você analisa a QUALIDADE DA OPERAÇÃO.
- Considere conjuntamente: Cedente, Sacados, Títulos/lastro, Histórico da relação comercial, Consultas em birôs, Documentos disponíveis e Dados internos do ERP.
- Respostas profissionais, curtas, objetivas, técnicas e claras.
- Sem floreios, textos genéricos ou explicações desnecessárias.
- Não tomar decisão cega com base apenas em birô.
- Sempre justificar a conclusão com base nos dados concretos recebidos.
- A IA NÃO decide sozinha; ela gera parecer analítico para apoio à decisão.

OBJETIVO: Avaliar o risco da operação de antecipação de recebíveis, considerando a probabilidade de liquidação dos títulos, a consistência da relação entre cedente e sacados, a qualidade do lastro e os sinais objetivos e subjetivos de risco.

OPERAÇÕES MULTI-SACADO:
Esta operação pode conter UM ou VÁRIOS sacados. Analise TODOS os sacados presentes nos dados.
- Agrupe os sacados por nível de risco (ALTO, MEDIO, BAIXO).
- Foque mais detalhes nos sacados de MAIOR RISCO e MAIOR EXPOSIÇÃO (valor dos títulos).
- Para sacados de baixo risco e baixa exposição, resuma brevemente.
- Calcule o percentual de participação de cada sacado no valor total da operação.

LÓGICA DE ANÁLISE EM 4 BLOCOS:

BLOCO 1 — ANÁLISE DO CEDENTE
Avalie: histórico de operações conosco, volume operado, recorrência, pontualidade histórica, índice de atraso, recompras, concentração de carteira, padrão histórico de títulos, qualidade do relacionamento, sinais de crescimento abrupto, desorganização ou comportamento oportunista.
Perguntas-chave: O cedente costuma operar bem? Já apresentou problemas? O padrão atual é coerente com o histórico? Há indícios de empurrar risco para a operação?

BLOCO 2 — ANÁLISE DOS SACADOS (UM ITEM POR SACADO)
Para CADA sacado identificado nos documentos/dados fornecidos:
Avalie: score e rating em birôs, protestos, negativações e ações, situação cadastral, tempo de mercado, capacidade financeira aparente, endividamento, documentos disponíveis, histórico de pagamento ao cedente, coerência entre porte e valor dos títulos, risco de crédito isolado e comportamental.
Perguntas-chave: O sacado tem capacidade e histórico compatíveis? Há restrições relevantes? O birô mostra deterioração? O risco é aceitável para esse perfil?

BLOCO 3 — ANÁLISE DA RELAÇÃO CEDENTE x CADA SACADO (MUITO IMPORTANTE)
Para CADA sacado, avalie: existência de relacionamento histórico, frequência das operações, recorrência de faturamento, valor médio histórico, pontualidade do sacado nesse relacionamento específico, se o volume atual está dentro do padrão, se o prazo é coerente, dependência excessiva de um único sacado, indícios de operação fora do padrão.
Perguntas-chave: Esse sacado já paga esse cedente com regularidade? O comportamento é saudável? O título atual é compatível com o histórico? Há desvio de valor, prazo ou frequência?

BLOCO 4 — ANÁLISE DOS TÍTULOS / LASTRO / OPERAÇÃO (CONSOLIDADO)
IMPORTANTE: Adapte a análise ao TIPO de título:
- CHEQUES: São títulos de crédito próprios, emitidos pelo sacado. NÃO possuem lastro documental (NF-e, contrato, canhoto). A análise deve focar em: capacidade de pagamento do emitente, prazo de vencimento, valor vs. porte do emitente, concentração, histórico de devolução de cheques do sacado, e se os valores/prazos são coerentes. NÃO apontar "falta de lastro" como alerta em operações de cheque — isso é da natureza do instrumento.
- DUPLICATAS/NOTAS: Exigem lastro documental (NF-e, pedido, canhoto). Avaliar consistência entre NF e título, se parece performado, se há contrato.
- BOLETOS/OUTROS: Avaliar conforme documentação disponível.

Avalie: quantidade de títulos, valor total, ticket médio, prazo médio e máximo, concentração por sacado, compatibilidade com histórico, documentação pertinente ao tipo de título, risco de título frio/simulado, exposição total frente ao perfil do cedente e sacados.
Perguntas-chave: Os títulos são compatíveis com o perfil da operação? O prazo está saudável? O valor está aceitável? Existe concentração excessiva em um único sacado?

REGRAS DE INTERPRETAÇÃO:
- Score sozinho não aprova nem reprova.
- Restrição relevante deve ser contextualizada.
- Bom histórico relacional pode mitigar parte do risco cadastral.
- Operação fora do padrão aumenta risco mesmo com birô razoável.
- Crescimento abrupto de volume, prazo excessivo e concentração alta são alertas.
- Ausência de lastro documental é alerta grave APENAS para duplicatas/notas. Para cheques, é da natureza do instrumento.
- Relação nova exige maior cautela.
- Cedente com histórico ruim pesa negativamente.
- Sempre observar risco de fraude, simulação ou operação artificial.
- Concentração excessiva em um único sacado é fator de risco adicional.

SE HOUVER DADOS INSUFICIENTES:
Informe objetivamente quais dados faltam, reduza a confiança da análise e, se necessário, classifique como APROVAR COM RESSALVAS ou REPROVAR conforme o nível de incerteza.

Devolva APENAS um JSON válido com esta estrutura:

{
  "decisao": "APROVAR" | "APROVAR_COM_RESSALVAS" | "REPROVAR",
  "riscoGeral": "BAIXO" | "MEDIO" | "ALTO",
  "parecer": "2-3 frases. Técnico e direto. Sem repetir o que já está nos pontos-chave.",
  "resumoSacados": "Ex: '3 sacados sem restrições, 1 com protestos relevantes' — resumo rápido",
  "blocos": {
    "cedente": {
      "resumo": "1-2 frases objetivas",
      "alertas": ["apenas alertas críticos"]
    },
    "sacados": [
      {
        "cpfCnpj": "CPF ou CNPJ do sacado",
        "nome": "Nome/Razão social",
        "risco": "BAIXO" | "MEDIO" | "ALTO",
        "valorExposicao": "R$ XX.XXX,XX",
        "percentualOperacao": "XX.X%",
        "resumo": "1-2 frases sobre o perfil de crédito deste sacado",
        "alertas": ["alertas específicos deste sacado"],
        "relacaoComCedente": {
          "resumo": "1-2 frases sobre a relação comercial",
          "alertas": ["alertas da relação"]
        }
      }
    ],
    "titulosLastro": {
      "resumo": "1-2 frases objetivas (consolidado de todos os sacados)",
      "alertas": ["apenas alertas críticos"],
      "detalhes": {
        "quantidadeTitulos": número,
        "valorTotal": "R$ XX.XXX,XX",
        "ticketMedio": "R$ XX.XXX,XX",
        "prazoMedio": "XX dias",
        "concentracao": "breve descrição da concentração por sacado"
      }
    }
  },
  "pontosChave": {
    "cedente": "1 frase curta",
    "sacados": "1 frase curta sobre o conjunto de sacados",
    "relacao": "1 frase curta sobre as relações comerciais",
    "titulos": "1 frase curta",
    "alertas": "Resumo ou 'Sem alertas relevantes.'"
  },
  "ressalvas": ["Apenas se houver. Senão: 'Sem ressalvas relevantes.'"],
  "dadosFaltantes": ["Apenas se faltar algo crítico"]
}

REGRAS SOBRE O ARRAY DE SACADOS:
- Se houver apenas 1 sacado, o array "sacados" terá 1 item.
- Se houver múltiplos sacados, ordene do MAIOR risco para o MENOR.
- Para cada sacado, calcule valorExposicao (soma dos títulos daquele sacado) e percentualOperacao (% do valor total).
- Sacados com risco ALTO devem ter análise mais detalhada.
- Sacados com risco BAIXO podem ter resumo mais breve.

REGRAS DE ESCRITA:
- Escrever como analista de crédito sênior de securitizadora.
- Ser técnico, direto e objetivo.
- Sem linguagem comercial ou motivacional.
- Não inventar dados ausentes.
- Não presumir documentos que não foram fornecidos.
- Quando faltar informação crítica, deixar expresso.
- Quando houver dúvida razoável, ser conservador.
- Priorizar proteção da operação.
- Valores em R$ com separador de milhar. Percentuais com %.
- Campos sem dados: usar "Sem dados." exatamente.
- NUNCA inventar dados que não foram fornecidos.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documents, cedenteData, clientConsultations, clientProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ─── Fetch historical feedback for AI learning ───
    let historicalFeedback: any[] = [];
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey);
        const cedenteCpf = (cedenteData as any)?.cpf_cnpj || (cedenteData as any)?.cpfCnpj || null;
        const sacadoCpfs: string[] = Array.isArray((clientProfile as any)?.sacados)
          ? (clientProfile as any).sacados.map((s: any) => s.cpfCnpj).filter(Boolean)
          : (clientProfile as any)?.cpfCnpj ? [(clientProfile as any).cpfCnpj] : [];

        const filters: string[] = [];
        if (cedenteCpf) filters.push(`cedente_cpf_cnpj.eq.${cedenteCpf}`);
        if (sacadoCpfs.length > 0) {
          for (const cpf of sacadoCpfs) {
            filters.push(`sacados.cs.[{"cpf_cnpj":"${cpf}"}]`);
          }
        }

        if (filters.length > 0) {
          const { data: fbs } = await sb
            .from("credit_analysis_feedback")
            .select("decisao_final, finalidade, parecer_gestor, observacoes, ia_decisao, ia_risco, resultado_real, resultado_observacao, cedente_nome, sacados, created_at")
            .or(filters.join(","))
            .order("created_at", { ascending: false })
            .limit(8);
          if (Array.isArray(fbs)) historicalFeedback = fbs;
        }
      }
    } catch (err) {
      console.error("Could not fetch historical feedback:", err);
    }

    const context = JSON.stringify({
      documentosImportados: documents,
      dadosCedenteSmart: cedenteData,
      consultasSacado: clientConsultations,
      perfilCliente: clientProfile,
      historicoDecisoesGestor: historicalFeedback,
    });

    console.log(`Calling AI for credit operation analysis (${historicalFeedback.length} historical feedback cases included)...`);


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
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
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

    if (!content) throw new Error("Empty response from AI");

    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    // Backward compatibility: if AI returns old format with single "sacado", convert to array
    if (analysis?.blocos?.sacado && !analysis?.blocos?.sacados) {
      const sacadoBlock = analysis.blocos.sacado;
      const relacaoBlock = analysis.blocos.relacaoCedenteSacado || {};
      analysis.blocos.sacados = [{
        cpfCnpj: "",
        nome: "Sacado",
        risco: sacadoBlock.risco || "MEDIO",
        valorExposicao: analysis.blocos.titulosLastro?.detalhes?.valorTotal || "—",
        percentualOperacao: "100%",
        resumo: sacadoBlock.resumo || "",
        alertas: sacadoBlock.alertas || [],
        relacaoComCedente: {
          resumo: relacaoBlock.resumo || "",
          alertas: relacaoBlock.alertas || [],
        },
      }];
      delete analysis.blocos.sacado;
      delete analysis.blocos.relacaoCedenteSacado;
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-credit-operation:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
