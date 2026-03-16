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

    const systemPrompt = `Voce e um analista senior de credito.
Analise dados de fontes internas e externas e devolva APENAS um JSON valido com a estrutura:
{
  "visaoGeral": "texto curto com panorama consolidado",
  "resumoExecutivo": "texto de 2 a 4 frases",
  "confiancaAnalise": "ALTA" | "MEDIA" | "BAIXA",
  "fontesConsideradas": [
    { "fonte": "Smart|AgRisk|Serasa|SCR", "tipo": "interna|externa", "status": "presente|ausente", "observacao": "string curta" }
  ],
  "pontosFortes": ["string"],
  "pontosAtencao": ["string"],
  "inconsistenciasOuLacunas": ["string"],
  "recomendacaoCredito": {
    "parecer": "FAVORAVEL" | "FAVORAVEL_COM_RESTRICOES" | "ATENCAO" | "DESFAVORAVEL",
    "justificativa": "string"
  },
  "proximosPassos": ["string"]
}

Regras:
- Smart deve ser tratado como fonte interna do ERP.
- AgRisk, Serasa e SCR devem ser tratados como fontes externas/complementares.
- Se uma fonte nao estiver presente, cite isso em fontesConsideradas e em inconsistenciasOuLacunas somente se relevante.
- Nao invente numeros.
- Foque em risco, coerencia cadastral, endividamento, restritivos, patrimonio e comportamento interno quando existirem.
- Seja objetivo e profissional.`;

    const context = JSON.stringify({
      clientProfile,
      sourceData,
    });

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
