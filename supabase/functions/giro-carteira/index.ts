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
          risco_atual: number;
          bloqueado: string;
          setor: string;
          uf: string;
          cidade: string;
        }>(`
          SELECT 
            cpf_cnpj,
            nome,
            limite_global,
            risco_atual,
            bloqueado,
            setor,
            uf,
            cidade
          FROM smartsecurities_cedentes
          ORDER BY nome ASC
        `);

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
          const limiteDisponivel = (ced.limite_global || 0) - (ced.risco_atual || 0);

          return {
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome,
            limite_global: ced.limite_global,
            limite_disponivel: limiteDisponivel,
            risco_atual: ced.risco_atual,
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
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        
        if (!LOVABLE_API_KEY) {
          throw new Error("LOVABLE_API_KEY is not configured");
        }

        console.log(`Analisando ${cedentes.length} cedentes em lote`);

        // Buscar dados completos de cada cedente para análise
        const cedentesCompletos = [];
        
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

          // Calcular métricas (titulos_em_aberto usa 'valor', não 'valor_face')
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
          
          const concentracaoTop3 = Object.entries(sacadosMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([_, valor]) => totalAberto > 0 ? (valor / totalAberto) * 100 : 0);

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

          cedentesCompletos.push({
            cpf_cnpj: ced.cpf_cnpj,
            nome: ced.nome || ced.razao_social,
            setor: ced.setor,
            uf: ced.uf,
            bloqueado: ced.bloqueado === 'S',
            ultima_operacao: ced.ultima_operacao,
            dias_inativo: ced.dias_inativo || 999,
            limite_global: ced.limite_global || 0,
            limite_disponivel: ced.limite_disponivel || 0,
            risco_atual: ced.risco_atual || 0,
            utilizacao_limite: utilizacaoLimite,
            total_aberto: totalAberto,
            total_vencido: totalVencido,
            percentual_vencido: percentualVencido,
            concentracao_top1: concentracaoTop3[0] || 0,
            concentracao_top3_soma: concentracaoTop3.reduce((a, b) => a + b, 0),
            qtd_sacados: Object.keys(sacadosMap).length,
            total_recomprado: totalRecomprado,
            taxa_recompra: taxaRecompra,
            taxa_pontualidade: taxaPontualidade,
            media_dias_atraso: mediaAtraso,
            total_quitado_90dias: totalQuitado,
          });
        }

        const systemPrompt = `Você é um analista de crédito especializado em factoring e FIDC. Analise a lista de cedentes considerando TODOS os indicadores fornecidos.

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

### SAUDÁVEL (recomendado para operar):
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

        const userContent = `Analise estes ${cedentesCompletos.length} cedentes com base em todos os indicadores:

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
