import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, dataLimite, cedentes } = await req.json();

    if (action === 'list-inativos') {
      // Buscar cedentes que não operaram desde a data limite
      console.log("Buscando cedentes inativos desde:", dataLimite);

      // Primeiro, buscar última operação de cada cedente da tabela operacoes_individualizadas
      const { data: operacoes, error: opError } = await supabase
        .from('operacoes_individualizadas')
        .select('cpf_cnpj_cedente, data')
        .order('data', { ascending: false });

      if (opError) {
        console.error("Erro ao buscar operações:", opError);
        throw opError;
      }

      // Agrupar por cedente e pegar última operação
      const ultimaOperacaoPorCedente: Record<string, string> = {};
      for (const op of operacoes || []) {
        if (!ultimaOperacaoPorCedente[op.cpf_cnpj_cedente]) {
          ultimaOperacaoPorCedente[op.cpf_cnpj_cedente] = op.data;
        }
      }

      // Filtrar cedentes cuja última operação foi antes da data limite
      const cedentesInativos = Object.entries(ultimaOperacaoPorCedente)
        .filter(([_, ultimaOp]) => ultimaOp < dataLimite)
        .map(([cpfCnpj, ultimaOp]) => ({ cpf_cnpj: cpfCnpj, ultima_operacao: ultimaOp }));

      // Buscar detalhes dos cedentes inativos
      const cpfCnpjList = cedentesInativos.map(c => c.cpf_cnpj);
      
      if (cpfCnpjList.length === 0) {
        return new Response(JSON.stringify({ success: true, cedentes: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cedentesData, error: cedError } = await supabase
        .from('cedentes_completo')
        .select('*')
        .in('cpf_cnpj', cpfCnpjList);

      if (cedError) {
        console.error("Erro ao buscar cedentes:", cedError);
        throw cedError;
      }

      // Combinar dados com cálculos
      const resultado = (cedentesData || []).map(ced => {
        const inativo = cedentesInativos.find(i => i.cpf_cnpj === ced.cpf_cnpj);
        const ultimaOp = inativo?.ultima_operacao;
        
        // Calcular dias inativo
        const diasInativo = ultimaOp 
          ? Math.floor((new Date().getTime() - new Date(ultimaOp).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        // Calcular limite disponível (saldo - risco_atual)
        const limiteDisponivel = (ced.saldo || 0) - (ced.risco_atual || 0);
        
        return {
          ...ced,
          ultima_operacao: ultimaOp,
          dias_inativo: diasInativo,
          limite_disponivel: limiteDisponivel,
        };
      });

      // Ordenar por última operação (mais antigo primeiro)
      resultado.sort((a, b) => {
        const dateA = a.ultima_operacao ? new Date(a.ultima_operacao).getTime() : 0;
        const dateB = b.ultima_operacao ? new Date(b.ultima_operacao).getTime() : 0;
        return dateA - dateB;
      });

      console.log(`Encontrados ${resultado.length} cedentes inativos`);

      return new Response(JSON.stringify({ success: true, cedentes: resultado }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'analyze-batch') {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      console.log(`Analisando ${cedentes.length} cedentes em lote`);

      // Preparar resumo de cada cedente para análise
      const cedentesResumo = cedentes.map((ced: any) => {
        const utilizacaoLimite = ced.limite_global > 0 
          ? ((ced.risco_atual || 0) / ced.limite_global) * 100 
          : 0;
        
        const diasInativo = ced.ultima_operacao 
          ? Math.floor((new Date().getTime() - new Date(ced.ultima_operacao).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        return {
          cpf_cnpj: ced.cpf_cnpj,
          nome: ced.nome || ced.razao_social,
          limite_global: ced.limite_global || 0,
          limite_disponivel: ced.limite_disponivel || 0,
          risco_atual: ced.risco_atual || 0,
          utilizacao_limite: utilizacaoLimite,
          bloqueado: ced.bloqueado === 'S',
          ultima_operacao: ced.ultima_operacao,
          dias_inativo: diasInativo,
          setor: ced.setor,
          uf: ced.uf,
        };
      });

      const systemPrompt = `Você é um analista de crédito de factoring especializado. Analise a lista de cedentes inativos e classifique cada um.

## REGRAS DE CLASSIFICAÇÃO:

### SAUDÁVEL (pode operar):
- Utilização do limite < 80%
- Limite disponível > 0
- Não está bloqueado
- Mesmo inativos, estes cedentes podem voltar a operar

### NÃO SAUDÁVEL (não deve operar):
- Utilização do limite > 100% (excede limite)
- Limite disponível <= 0
- Cedente bloqueado
- Risco muito alto para operar

Para cada cedente, retorne um JSON array com:
{
  "analises": [
    {
      "cpf_cnpj": "string",
      "saudavel": true/false,
      "motivo": "explicação curta de 1-2 linhas do porquê",
      "score": 0-100 (0=crítico, 100=excelente)
    }
  ]
}

Responda APENAS com o JSON válido, sem markdown.`;

      const userContent = `Analise estes ${cedentesResumo.length} cedentes inativos:

${JSON.stringify(cedentesResumo, null, 2)}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
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

      let analises;
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent);
        analises = parsed.analises || parsed;
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Invalid AI response format");
      }

      console.log("Análise em lote concluída com sucesso");

      return new Response(JSON.stringify({ success: true, analises }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
