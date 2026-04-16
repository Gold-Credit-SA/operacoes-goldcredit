import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
- Considere conjuntamente: Cedente, Sacado, Títulos/lastro, Histórico da relação comercial, Consultas em birôs, Documentos disponíveis e Dados internos do ERP.
- Respostas profissionais, curtas, objetivas, técnicas e claras.
- Sem floreios, textos genéricos ou explicações desnecessárias.
- Não tomar decisão cega com base apenas em birô.
- Sempre justificar a conclusão com base nos dados concretos recebidos.
- A IA NÃO decide sozinha; ela gera parecer analítico para apoio à decisão.

Você está em um chat contínuo com o analista. Ele pode te fazer perguntas, fornecer informações adicionais, pedir para reavaliar pontos específicos ou aprofundar a análise.

Responda sempre em português, de forma técnica e direta. Use markdown para formatar suas respostas (negrito, listas, etc).

Quando o analista fornecer novos dados, incorpore-os à sua análise sem repetir todo o parecer — foque no que mudou ou no que foi perguntado.

Valores em R$ com separador de milhar. Percentuais com %.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context message if provided
    const contextMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (context) {
      contextMessages.push({
        role: "system",
        content: `CONTEXTO DA OPERAÇÃO EM ANÁLISE:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    // Add conversation history
    const allMessages = [
      ...contextMessages,
      ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    console.log("Calling AI for credit analysis chat...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: allMessages,
        stream: true,
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

    // Save user message to DB if sessionId provided
    if (sessionId && messages?.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg.role === "user" && !lastUserMsg.saved) {
          await sb.from("credit_analysis_messages").insert({
            session_id: sessionId,
            role: "user",
            content: lastUserMsg.content,
          });
        }
      } catch (e) {
        console.error("Error saving user message:", e);
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error in credit-analysis-chat:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
