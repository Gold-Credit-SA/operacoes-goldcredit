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
      // Buscar cedentes que pararam de operar DEPOIS da data limite
      // (última operação >= dataLimite, mas antes de hoje)
      console.log("Buscando cedentes inativos desde:", dataLimite);

      const hoje = new Date().toISOString().split('T')[0];

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

      // Filtrar cedentes cuja última operação foi DEPOIS da data limite (inclusive)
      // e ANTES de hoje (para garantir que estão inativos agora)
      const cedentesInativos = Object.entries(ultimaOperacaoPorCedente)
        .filter(([_, ultimaOp]) => ultimaOp >= dataLimite && ultimaOp < hoje)
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

      // Ordenar por última operação (mais recente primeiro)
      resultado.sort((a, b) => {
        const dateA = a.ultima_operacao ? new Date(a.ultima_operacao).getTime() : 0;
        const dateB = b.ultima_operacao ? new Date(b.ultima_operacao).getTime() : 0;
        return dateB - dateA;
      });

      console.log(`Encontrados ${resultado.length} cedentes inativos desde ${dataLimite}`);

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

      // Buscar dados completos de cada cedente para análise mais rica
      const cedentesCompletos = [];
      
      for (const ced of cedentes) {
        // Buscar títulos em aberto
        const { data: titulosAbertos } = await supabase
          .from('titulos_aberto')
          .select('*')
          .eq('cpf_cnpj_cedente', ced.cpf_cnpj);

        // Buscar títulos quitados (últimos 90 dias)
        const data90diasAtras = new Date();
        data90diasAtras.setDate(data90diasAtras.getDate() - 90);
        
        const { data: titulosQuitados } = await supabase
          .from('titulos_quitado')
          .select('*')
          .eq('cpf_cnpj_cedente', ced.cpf_cnpj)
          .gte('data_quitacao', data90diasAtras.toISOString().split('T')[0]);

        // Buscar recompras
        const { data: recompras } = await supabase
          .from('titulos_recomprado')
          .select('*')
          .eq('cpf_cnpj_cedente', ced.cpf_cnpj);

        // Calcular métricas
        const totalAberto = titulosAbertos?.reduce((sum, t) => sum + (t.valor_face || 0), 0) || 0;
        const totalVencido = titulosAbertos?.filter(t => new Date(t.vencimento) < new Date())
          .reduce((sum, t) => sum + (t.valor_face || 0), 0) || 0;
        const percentualVencido = totalAberto > 0 ? (totalVencido / totalAberto) * 100 : 0;

        // Calcular concentração de sacados
        const sacadosMap: Record<string, number> = {};
        titulosAbertos?.forEach(t => {
          const sacado = t.cpf_cnpj_sacado || 'Desconhecido';
          sacadosMap[sacado] = (sacadosMap[sacado] || 0) + (t.valor_face || 0);
        });
        
        const concentracaoTop3 = Object.entries(sacadosMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([_, valor]) => totalAberto > 0 ? (valor / totalAberto) * 100 : 0);

        // Calcular taxa de recompra
        const totalRecomprado = recompras?.reduce((sum, t) => sum + (t.valor_face || 0), 0) || 0;
        const totalOperado = (ced.valor_bruto_operado || 0);
        const taxaRecompra = totalOperado > 0 ? (totalRecomprado / totalOperado) * 100 : 0;

        // Calcular liquidez (pagamentos nos últimos 90 dias)
        const pagamentosPontuais = titulosQuitados?.filter(t => {
          const venc = new Date(t.vencimento);
          const quit = new Date(t.data_quitacao);
          return quit <= venc;
        }).reduce((sum, t) => sum + (t.valor_face || 0), 0) || 0;

        const totalQuitado = titulosQuitados?.reduce((sum, t) => sum + (t.valor_face || 0), 0) || 0;
        const taxaPontualidade = totalQuitado > 0 ? (pagamentosPontuais / totalQuitado) * 100 : 0;

        // Calcular dias de atraso médio
        const titulosAtrasados = titulosQuitados?.filter(t => {
          const venc = new Date(t.vencimento);
          const quit = new Date(t.data_quitacao);
          return quit > venc;
        }) || [];
        
        const diasAtrasoTotal = titulosAtrasados.reduce((sum, t) => {
          const venc = new Date(t.vencimento);
          const quit = new Date(t.data_quitacao);
          return sum + Math.floor((quit.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        const mediaAtraso = titulosAtrasados.length > 0 ? diasAtrasoTotal / titulosAtrasados.length : 0;

        const utilizacaoLimite = ced.limite_global > 0 
          ? ((ced.risco_atual || 0) / ced.limite_global) * 100 
          : 0;
        
        const diasInativo = ced.ultima_operacao 
          ? Math.floor((new Date().getTime() - new Date(ced.ultima_operacao).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        cedentesCompletos.push({
          cpf_cnpj: ced.cpf_cnpj,
          nome: ced.nome || ced.razao_social,
          setor: ced.setor,
          uf: ced.uf,
          bloqueado: ced.bloqueado === 'S',
          ultima_operacao: ced.ultima_operacao,
          dias_inativo: diasInativo,
          // Limites
          limite_global: ced.limite_global || 0,
          limite_disponivel: ced.limite_disponivel || 0,
          risco_atual: ced.risco_atual || 0,
          utilizacao_limite: utilizacaoLimite,
          // Inadimplência
          total_aberto: totalAberto,
          total_vencido: totalVencido,
          percentual_vencido: percentualVencido,
          // Concentração de sacados
          concentracao_top1: concentracaoTop3[0] || 0,
          concentracao_top3_soma: concentracaoTop3.reduce((a, b) => a + b, 0),
          qtd_sacados: Object.keys(sacadosMap).length,
          // Recompras
          total_recomprado: totalRecomprado,
          taxa_recompra: taxaRecompra,
          // Liquidez e pontualidade
          taxa_pontualidade: taxaPontualidade,
          media_dias_atraso: mediaAtraso,
          total_quitado_90dias: totalQuitado,
        });
      }

      const systemPrompt = `Você é um analista de crédito especializado em factoring e FIDC. Analise a lista de cedentes inativos considerando TODOS os indicadores fornecidos.

## CRITÉRIOS DE ANÁLISE (por ordem de importância):

### 1. INADIMPLÊNCIA (peso alto)
- percentual_vencido > 30%: CRÍTICO
- percentual_vencido > 15%: ALERTA
- percentual_vencido < 5%: BOM

### 2. CONCENTRAÇÃO DE SACADOS (peso alto)
- concentracao_top1 > 50%: CRÍTICO (muito dependente de um sacado)
- concentracao_top3_soma > 80%: ALERTA
- qtd_sacados < 3: RISCO (pouca diversificação)

### 3. TAXA DE RECOMPRA (peso alto)
- taxa_recompra > 20%: CRÍTICO
- taxa_recompra > 10%: ALERTA
- taxa_recompra < 5%: BOM

### 4. LIQUIDEZ/PONTUALIDADE (peso médio)
- taxa_pontualidade < 50%: CRÍTICO
- taxa_pontualidade < 70%: ALERTA
- media_dias_atraso > 15: ALERTA
- media_dias_atraso > 30: CRÍTICO

### 5. UTILIZAÇÃO DE LIMITE (peso médio)
- utilizacao_limite > 100%: CRÍTICO
- utilizacao_limite > 90%: ALERTA
- limite_disponivel <= 0: NÃO PODE OPERAR

### 6. STATUS
- bloqueado = true: NÃO SAUDÁVEL automaticamente

## CLASSIFICAÇÃO FINAL:

### SAUDÁVEL (recomendado para giro):
- Não bloqueado
- Limite disponível > 0
- Sem indicadores CRÍTICOS
- Máximo 1 indicador em ALERTA

### NÃO SAUDÁVEL (não recomendado):
- Qualquer indicador CRÍTICO
- 2+ indicadores em ALERTA
- Bloqueado
- Sem limite disponível

Retorne um JSON array:
{
  "analises": [
    {
      "cpf_cnpj": "string",
      "saudavel": true/false,
      "motivo": "explicação de 2-3 linhas citando os principais indicadores que levaram à decisão",
      "score": 0-100,
      "alertas": ["lista de problemas identificados"],
      "indicadores_positivos": ["lista de pontos positivos"]
    }
  ]
}

Responda APENAS com o JSON válido, sem markdown.`;

      const userContent = `Analise estes ${cedentesCompletos.length} cedentes inativos com base em todos os indicadores:

${JSON.stringify(cedentesCompletos, null, 2)}`;

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
