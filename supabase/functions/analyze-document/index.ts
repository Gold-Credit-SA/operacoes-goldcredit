import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um especialista em análise de documentos de crédito brasileiro. Sua tarefa é extrair e estruturar informações de documentos como VADU/CreditBox, SCR (Banco Central) e Serasa.

Analise o documento PDF fornecido e extraia TODAS as informações disponíveis no seguinte formato JSON:

{
  "tipoDocumento": "VADU" | "SCR" | "SERASA" | "OUTRO",
  "dataConsulta": "YYYY-MM-DD",
  "identificacao": {
    "cpfCnpj": "string formatado (ex: 32.128.982/0001-98 ou 123.456.789-00)",
    "nome": "string com nome completo ou razão social",
    "situacaoReceita": "ATIVA" | "BAIXADA" | "SUSPENSA" | "INAPTA" | null,
    "dataAbertura": "YYYY-MM-DD" | null,
    "dataNascimento": "YYYY-MM-DD" | null,
    "nomeMae": "string" | null,
    "endereco": "string" | null,
    "capitalSocial": number | null
  },
  "score": {
    "valor": number (0-1000),
    "faixa": "string descrevendo faixa" | null,
    "descricao": "Excelente" | "Bom" | "Regular" | "Baixo" | "Muito Baixo",
    "probabilidadePagamento": number (0-100) | null,
    "fonte": "SERASA" | "CREDITBOX" | "SPC" | null
  } | null,
  "restricoes": {
    "protestos": [{"tipo": "PROTESTO", "valor": number, "data": "YYYY-MM-DD", "credor": "string", "cidade": "string"}],
    "chequesSemFundo": [{"tipo": "CCF", "valor": number, "data": "YYYY-MM-DD", "credor": "string"}],
    "anotacoesNegativas": [{"tipo": "PEFIN" | "REFIN" | "CONVEM" | "OUTRO", "valor": number, "data": "YYYY-MM-DD", "credor": "string"}],
    "acoesCiveisFalencia": [{"tipo": "string", "valor": number, "data": "YYYY-MM-DD"}],
    "totalDividas": number,
    "possuiRestricao": boolean
  },
  "comportamentoFinanceiro": {
    "carteira": {
      "aVencer": number,
      "vencido": number,
      "prejuizo": number,
      "total": number
    } | null,
    "modalidades": [{"nome": "string", "aVencer": number, "vencido": number, "prejuizo": number}],
    "classificacaoRisco": "AA" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | null,
    "ilm": number | null
  } | null,
  "participacoesSocietarias": [{"cnpj": "string", "razaoSocial": "string", "participacao": number, "situacao": "string", "dataEntrada": "YYYY-MM-DD"}],
  "consultas": [{"data": "YYYY-MM-DD", "origem": "string", "quantidade": number}],
  "sancoes": {
    "nacionais": boolean,
    "internacionais": boolean,
    "detalhes": "string" | null
  } | null
}

REGRAS IMPORTANTES:
1. Extraia TODOS os dados disponíveis no documento PDF
2. Para valores monetários, use números sem formatação (ex: 1500.50)
3. Para datas, use formato YYYY-MM-DD
4. Se "NADA CONSTA" para restrições, retorne array vazio
5. possuiRestricao deve ser true se houver QUALQUER restrição (protesto, CCF, anotação negativa, etc)
6. Calcule totalDividas como soma de todos os valores de restrições
7. Identifique o tipo de documento pela estrutura (VADU tem CredMap, SCR tem modalidades, Serasa tem Score Serasa)
8. Para scores, normalize para escala 0-1000 se necessário
9. SEMPRE extraia cpfCnpj e nome - são campos obrigatórios

Responda APENAS com o JSON válido, sem markdown ou explicações.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, mimeType } = await req.json();
    
    if (!pdfBase64) {
      throw new Error("Conteúdo do PDF não fornecido");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Analyzing document: ${fileName}`);
    console.log(`PDF base64 length: ${pdfBase64.length} characters`);

    // Use Gemini with multimodal support for PDF analysis
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
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: "Analise este documento de consulta de crédito brasileiro e extraia todos os dados estruturados conforme o formato JSON especificado."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'application/pdf'};base64,${pdfBase64}`
                }
              }
            ]
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente em alguns instantes.",
          code: "RATE_LIMIT"
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos de IA insuficientes.",
          code: "CREDITS_EXHAUSTED"
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log("AI response received, content length:", content?.length || 0);

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Parse JSON response
    let extractedData;
    try {
      // Remove any markdown code blocks if present
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      throw new Error("Formato de resposta inválido da IA. Tente novamente.");
    }

    // Validate and provide defaults for required fields
    if (!extractedData.identificacao) {
      extractedData.identificacao = {};
    }
    
    // If cpfCnpj is missing, try to extract from filename or set placeholder
    if (!extractedData.identificacao.cpfCnpj) {
      extractedData.identificacao.cpfCnpj = "Não identificado";
    }
    
    // If nome is missing, use filename
    if (!extractedData.identificacao.nome) {
      extractedData.identificacao.nome = fileName.replace('.pdf', '').replace(/_/g, ' ');
    }

    // Ensure restricoes has proper structure
    if (!extractedData.restricoes) {
      extractedData.restricoes = {
        protestos: [],
        chequesSemFundo: [],
        anotacoesNegativas: [],
        totalDividas: 0,
        possuiRestricao: false
      };
    }

    // Ensure tipoDocumento is set
    if (!extractedData.tipoDocumento) {
      extractedData.tipoDocumento = "OUTRO";
    }

    // Ensure dataConsulta is set
    if (!extractedData.dataConsulta) {
      extractedData.dataConsulta = new Date().toISOString().split('T')[0];
    }

    console.log(`Successfully extracted data for: ${extractedData.identificacao.nome}`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: extractedData 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-document:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido",
      code: "PROCESSING_ERROR"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
