import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const systemPrompt = `Voce e um analista senior de credito em uma securitizadora/factoring.
Analise os dados fornecidos e devolva APENAS um JSON valido seguindo EXATAMENTE a estrutura abaixo.
Voce DEVE preencher todos os topicos padronizados. NAO invente dados — se a fonte nao estiver disponivel, informe isso claramente.

{
  "alertaCritico": "string ou null — se houver LIMINAR JUDICIAL detectada no Serasa, escreva um alerta grave aqui. Se nao houver, null.",
  "smart": {
    "disponivel": true/false,
    "ultimasOperacoes": "Resumo das ultimas operacoes do cedente no sistema Smart (volume, quantidade, datas recentes). Se nao disponivel: 'Dados Smart nao disponíveis.'",
    "resumoFinanceiro": "Visao geral financeira: receita gerada, volume operado, prazos medios. Se nao disponivel: 'Dados Smart nao disponíveis.'",
    "limite": "Limite aprovado, utilizado e disponivel. Se nao disponivel: 'Dados Smart nao disponíveis.'",
    "concentracao": "Analise de concentracao de sacados — se ha dependencia excessiva de poucos sacados. Se nao disponivel: 'Dados Smart nao disponíveis.'",
    "liquidez": "Indicadores de liquidez: titulos pagos vs em aberto, inadimplencia. Se nao disponivel: 'Dados Smart nao disponíveis.'"
  },
  "serasa": {
    "disponivel": true/false,
    "mensagem": "Se nao houver consulta Serasa disponivel, informe: 'Nao houve consulta Serasa para este cliente.' e PARE — nao preencha os demais campos com dados inventados.",
    "liminarJudicial": true/false,
    "alertaLiminar": "Se houver NADA CONSTA ou indicacao de liminar judicial, descreva aqui como alerta critico. Se nao houver: null.",
    "score": "Valor do score, faixa e interpretacao (chance de pagamento). Se nao disponivel: 'Sem dados.'",
    "ultimasConsultas": "Resumo das ultimas consultas ao CNPJ/CPF — quantas, de qual ramo (produtivo/comercial vs financeiras/bancos). Se nao disponivel: 'Sem dados.'",
    "historicoPagamento": "Resumo geral do comportamento de pagamento. Se nao disponivel: 'Sem dados.'",
    "resumoDividas": "Total de dividas, protestos, anotacoes negativas (PEFIN, REFIN, etc). Se nao disponivel: 'Sem dados.'"
  },
  "scr": {
    "disponivel": true/false,
    "mensagem": "Se nao houver consulta SCR disponivel, informe: 'Nao houve consulta SCR para este cliente.' e PARE.",
    "resumoGeral": "Resumo consolidado do endividamento bancario: creditos a vencer, vencidos, prejuizo, modalidades principais, classificacao de risco. Se nao disponivel: 'Sem dados.'"
  },
  "parecerFinal": {
    "parecer": "FAVORAVEL | FAVORAVEL_COM_RESTRICOES | ATENCAO | DESFAVORAVEL",
    "justificativa": "Justificativa objetiva do parecer consolidando todas as fontes analisadas."
  }
}

REGRAS CRITICAS:
1. Se uma fonte NAO estiver presente (null), marque como "disponivel": false e preencha campos com a mensagem padrao. NUNCA invente numeros ou dados.
2. LIMINAR JUDICIAL / NADA CONSTA no Serasa e fator de NEGATIVA IMEDIATA. Se detectado, "alertaCritico" deve conter um alerta grave e o parecer deve ser DESFAVORAVEL.
3. No campo "ultimasConsultas" do Serasa, diferencie entre consultas de empresas do ramo produtivo (comercio, industria) e de financeiras (bancos, factoring, securitizadoras).
4. Seja objetivo, profissional e conciso em cada topico.
5. NAO inclua dados da AgRisk.`;

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
