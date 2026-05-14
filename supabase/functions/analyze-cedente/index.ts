import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cedenteData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const {
      cedente,
      resumo,
      resumoExpandido,
      limites,
      confirmacao,
      carteira,
      liquidez,
      comportamento90Dias,
      concentracaoSacados,
      ultimasOperacoes
    } = cedenteData;

    // Prepare context for AI analysis
    const context = `
## Dados do Cedente: ${cedente?.nome || 'N/A'}
- CNPJ/CPF: ${cedente?.cpf_cnpj || 'N/A'}
- Setor: ${cedente?.setor || 'N/A'}
- Cidade/UF: ${cedente?.cidade || 'N/A'}/${cedente?.uf || 'N/A'}
- Data de Cadastro: ${cedente?.data_cadastro || 'N/A'}
- Status: ${cedente?.bloqueado === 'S' ? 'BLOQUEADO' : 'Ativo'}

## Resumo Operacional
- Primeira Operação: ${resumo?.primeiraOperacao || 'N/A'}
- Última Operação: ${resumo?.ultimaOperacao || 'N/A'}
- Total de Operações: ${resumo?.totalOperacoes || 0}
- Valor Bruto Total: R$ ${(resumo?.valorBrutoTotal || 0).toLocaleString('pt-BR')}
- Receita Total: R$ ${(resumo?.receitaTotal || 0).toLocaleString('pt-BR')}
- Taxa Média: ${resumo?.taxaMedia?.toFixed(2) || 0}%

## Resumo Expandido
- Volume Operado: R$ ${(resumoExpandido?.volumeOperado || 0).toLocaleString('pt-BR')}
- Prazo Médio Operações: ${resumoExpandido?.prazoMedioOperacoes || 0} dias
- Prazo Médio Títulos (90 dias): ${resumoExpandido?.prazoMedioTitulos90Dias || 0} dias
- Média Pago em Atraso: ${resumoExpandido?.mediaPagoEmAtraso || 0} dias
- Valor Médio Borderôs: R$ ${(resumoExpandido?.valorMedioBorderos || 0).toLocaleString('pt-BR')}
- Valor Médio Títulos: R$ ${(resumoExpandido?.valorMedioTitulos || 0).toLocaleString('pt-BR')}
- Receita Gerada: R$ ${(resumoExpandido?.receitaGerada || 0).toLocaleString('pt-BR')}
- % Prorrogação: ${resumoExpandido?.percentualProrrogacao?.toFixed(1) || 0}%
- CHQ Devolvidos Aberto: ${resumoExpandido?.chqDevolvidosAberto || 0}
- CHQ Devolvidos Quitado: ${resumoExpandido?.chqDevolvidosQuitado || 0}

## Limites
- Limite Global: R$ ${(limites?.global || 0).toLocaleString('pt-BR')}
- Limite Disponível: R$ ${(limites?.disponivel || 0).toLocaleString('pt-BR')}
- Risco Atual: R$ ${(limites?.risco || 0).toLocaleString('pt-BR')}
- Utilização: ${limites?.global > 0 ? ((limites?.risco / limites?.global) * 100).toFixed(1) : 0}%

## Taxa de Confirmação
- Confirmado: ${confirmacao?.confirmado?.percentual?.toFixed(1) || 0}% (R$ ${(confirmacao?.confirmado?.valor || 0).toLocaleString('pt-BR')})
- Parcial: ${confirmacao?.parcial?.percentual?.toFixed(1) || 0}%
- Pendente: ${confirmacao?.pendente?.percentual?.toFixed(1) || 0}%
- Sem Confirmação: ${confirmacao?.semConfirmacao?.percentual?.toFixed(1) || 0}%

## Carteira
- Total: R$ ${(carteira?.total || 0).toLocaleString('pt-BR')}
- Vencidos: R$ ${(carteira?.vencidos || 0).toLocaleString('pt-BR')} (${carteira?.percentualVencido?.toFixed(1) || 0}%)

## Liquidez
- % Pontual: ${liquidez?.percentualPontual?.toFixed(1) || 0}%
- % Atraso: ${liquidez?.percentualAtraso?.toFixed(1) || 0}%
- % Recompra: ${liquidez?.percentualRecompra?.toFixed(1) || 0}%
- % Liquidado: ${liquidez?.percentualLiquidado?.toFixed(1) || 0}%

## Comportamento de Pagamentos (90 dias)
${comportamento90Dias ? `
- Pontual: R$ ${(comportamento90Dias.pontual?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.pontual?.percentualValor?.toFixed(1) || 0}%)
- Atraso até 5 dias: R$ ${(comportamento90Dias.atraso5?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.atraso5?.percentualValor?.toFixed(1) || 0}%)
- Atraso 6-15 dias: R$ ${(comportamento90Dias.atraso15?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.atraso15?.percentualValor?.toFixed(1) || 0}%)
- Atraso 16-30 dias: R$ ${(comportamento90Dias.atraso30?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.atraso30?.percentualValor?.toFixed(1) || 0}%)
- Atraso +30 dias: R$ ${(comportamento90Dias.atrasoMais30?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.atrasoMais30?.percentualValor?.toFixed(1) || 0}%)
- Recompra: R$ ${(comportamento90Dias.recompra?.valor || 0).toLocaleString('pt-BR')} (${comportamento90Dias.recompra?.percentualValor?.toFixed(1) || 0}%)
- Em Atraso Aberto: R$ ${(comportamento90Dias.emAtraso?.valor || 0).toLocaleString('pt-BR')}
` : 'Dados não disponíveis'}

## Concentração de Sacados (Top 5)
${concentracaoSacados?.slice(0, 5).map((s: any, i: number) => 
  `${i + 1}. ${s.nome}: ${s.concentracao?.toFixed(1)}% (R$ ${(s.risco || 0).toLocaleString('pt-BR')})`
).join('\n') || 'Sem dados'}

## Últimas Operações
${ultimasOperacoes?.slice(0, 5).map((op: any) => 
  `- ${op.data}: R$ ${(op.valor_bruto || 0).toLocaleString('pt-BR')} (${op.etapa || 'N/A'})`
).join('\n') || 'Sem operações recentes'}
`;

    const systemPrompt = `Você é um analista de crédito especializado em factoring e FIDC. Analise os dados do cedente fornecidos e gere um relatório de análise em JSON com a seguinte estrutura:

{
  "saudeGeral": "EXCELENTE" | "BOA" | "REGULAR" | "ATENÇÃO" | "CRÍTICA",
  "scoreRisco": 0-100 (0 = alto risco, 100 = baixo risco),
  "resumoExecutivo": "texto de 2-3 linhas resumindo a situação geral",
  "indicadores": [
    {"nome": "string", "status": "positivo" | "neutro" | "negativo", "descricao": "string curta"}
  ],
  "recomendacaoLimite": {
    "acao": "AUMENTAR" | "MANTER" | "REDUZIR" | "SUSPENDER",
    "percentual": número (ex: 20 para +20% ou -20%),
    "justificativa": "string"
  },
  "giroCarteira": {
    "recomendado": true | false,
    "motivo": "string explicando se vale a pena fazer giro de carteira",
    "diasDesdeUltimaOperacao": número
  },
  "alertas": ["lista de alertas importantes"],
  "oportunidades": ["lista de oportunidades identificadas"],
  "acoesSugeridas": ["lista de ações prioritárias recomendadas"]
}

Considere:
1. Calcule os dias desde a última operação para avaliar se o cedente está ativo
2. Analise a taxa de recompra e atrasos para avaliar risco
3. Verifique a concentração de sacados
4. Avalie a utilização do limite
5. Considere o histórico de comportamento de pagamentos
6. Se a última operação foi há mais de 30 dias, questione o giro
7. Taxa de confirmação baixa indica risco
8. Percentual de vencidos alto é sinal de alerta

Responda APENAS com o JSON válido, sem markdown.`;

    console.log("Calling Lovable AI Gateway for cedente analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente em alguns instantes." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos insuficientes para análise de IA." 
        }), {
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

    // Parse JSON response
    let analysis;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    console.log("AI analysis completed successfully");

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-cedente:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
