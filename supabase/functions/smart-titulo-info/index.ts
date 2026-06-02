// deno-lint-ignore-file no-explicit-any
// ============================================================================
// smart-titulo-info
// Retorna em UMA chamada todos os dados de um título do Smart:
//   - dados do título (em_aberto OU quitados, busca automática)
//   - dados do sacado (com email, telefone, sms, endereço)
//   - dados do cedente (com responsável cobrança, gerente, etc)
//
// Frontend só precisa do titulo_id pra montar uma tela completa de cobrança.
// Não baixa PDFs — pra isso usa smart-scraper. Pensado pra ser RÁPIDO (~200ms).
//
// Auth: usuário autenticado (JWT obrigatório).
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveUserId } from "../_shared/supabase-admin.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

interface RequestBody {
  titulo_id: string | number;
  /**
   * Onde buscar o título. 'auto' tenta em_aberto e depois quitados.
   * Use valor específico só se souber.
   */
  status?: "auto" | "aberto" | "quitado";
}

function badRequest(message: string): Response {
  return jsonResponse({ success: false, error_code: "BAD_REQUEST", message }, 400);
}

function unauthorized(): Response {
  return jsonResponse({ success: false, error_code: "UNAUTHORIZED", message: "JWT inválido ou ausente" }, 401);
}

function cleanCpfCnpj(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function getSqlClient() {
  const host = Deno.env.get("EXTERNAL_DB_HOST");
  const user = Deno.env.get("EXTERNAL_DB_USER");
  const pass = Deno.env.get("EXTERNAL_DB_PASS");
  const name = Deno.env.get("EXTERNAL_DB_NAME");
  const port = Deno.env.get("EXTERNAL_DB_PORT") || "5432";
  if (!host || !user || !pass || !name) {
    throw new Error("EXTERNAL_DB_* não configurado nos secrets da edge");
  }
  return postgres(`postgres://${user}:${pass}@${host}:${port}/${name}`, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();

  try {
    if (req.method !== "POST") return badRequest("Use POST");

    const userId = await resolveUserId(req);
    if (!userId) return unauthorized();

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body) return badRequest("Body JSON obrigatório");
    const tituloId = body.titulo_id != null ? String(body.titulo_id).trim() : "";
    const status = body.status ?? "auto";
    if (!tituloId) return badRequest("titulo_id é obrigatório");

    const sql = getSqlClient();

    try {
      // ----------------------------------------------------------------------
      // 1. Lookup do título — em_aberto primeiro, depois quitados
      // ----------------------------------------------------------------------
      let tituloRow: any = null;
      let tituloFonte: "em_aberto" | "quitado" | null = null;

      if (status === "auto" || status === "aberto") {
        const r = await sql/* sql */`
          SELECT
            id_titulo::text                                    AS id_titulo,
            documento::text                                    AS documento,
            nosso_numero::text                                 AS nosso_numero,
            tipo::text                                         AS tipo,
            cpf_cnpj_sacado::text                              AS cpf_cnpj_sacado,
            sacado::text                                       AS sacado_nome,
            cpf_cnpj_cedente::text                             AS cpf_cnpj_cedente,
            cedente::text                                      AS cedente_nome,
            data_emissao,
            vencimento,
            situacao::text                                     AS situacao,
            valor::text                                        AS valor,
            valor_juros::text                                  AS valor_juros,
            valor_multa::text                                  AS valor_multa,
            valor_tarifas::text                                AS valor_tarifas,
            valor_total::text                                  AS valor_total,
            op::text                                           AS op,
            conta::text                                        AS conta,
            historico::text                                    AS historico,
            motivo::text                                       AS motivo,
            dev_updated_at                                     AS updated_at
          FROM smartsecurities_titulos_em_aberto
          WHERE id_titulo::text = ${tituloId}
          LIMIT 1
        `;
        if (r.length > 0) {
          tituloRow = r[0];
          tituloFonte = "em_aberto";
        }
      }

      if (!tituloRow && (status === "auto" || status === "quitado")) {
        const r = await sql/* sql */`
          SELECT
            id_titulo::text                                    AS id_titulo,
            numero::text                                       AS documento,
            nosso_numero::text                                 AS nosso_numero,
            tipo::text                                         AS tipo,
            cpf_cnpj_sacado::text                              AS cpf_cnpj_sacado,
            sacado::text                                       AS sacado_nome,
            cpf_cnpj_cedente::text                             AS cpf_cnpj_cedente,
            cedente::text                                      AS cedente_nome,
            emissao                                            AS data_emissao,
            vencimento,
            quitacao,
            tipo_quitacao::text                                AS tipo_quitacao,
            status::text                                       AS situacao,
            valor_face::text                                   AS valor,
            valor_juros::text                                  AS valor_juros,
            valor_multa::text                                  AS valor_multa,
            valor_tarifas::text                                AS valor_tarifas,
            valor_total::text                                  AS valor_total,
            valor_liquidado::text                              AS valor_liquidado,
            op::text                                           AS op,
            conta::text                                        AS conta,
            dev_updated_at                                     AS updated_at
          FROM smartsecurities_titulos_quitados
          WHERE id_titulo = ${Number(tituloId) || 0}
          LIMIT 1
        `;
        if (r.length > 0) {
          tituloRow = r[0];
          tituloFonte = "quitado";
        }
      }

      if (!tituloRow) {
        return jsonResponse({
          success: false,
          error_code: "TITULO_NAO_ENCONTRADO",
          message: `Título ${tituloId} não encontrado em em_aberto nem quitados`,
        }, 404);
      }

      // ----------------------------------------------------------------------
      // 2. Lookup sacado + cedente em paralelo
      // ----------------------------------------------------------------------
      const sacadoCpf = cleanCpfCnpj(tituloRow.cpf_cnpj_sacado);
      const cedenteCpf = cleanCpfCnpj(tituloRow.cpf_cnpj_cedente);

      const [sacadoRows, cedenteRows] = await Promise.all([
        sacadoCpf
          ? sql/* sql */`
              SELECT
                id_sacado,
                nome,
                cpf_cnpj,
                email,
                telefone,
                sms,
                endereco,
                cep,
                cidade,
                uf,
                grupo_econômico AS grupo_economico,
                data_de_cadastro
              FROM smartsecurities_sacados
              WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ${sacadoCpf}
              LIMIT 1
            `
          : Promise.resolve([] as any[]),
        cedenteCpf
          ? sql/* sql */`
              SELECT
                id_cedente,
                nome,
                cpf_cnpj,
                email,
                telefone,
                endereco,
                cep,
                cidade,
                uf,
                gerente,
                operador,
                responsavel_cobranca,
                grupo_economico,
                bloqueado,
                fator,
                advalorem,
                limite_global,
                risco_atual,
                saldo
              FROM smartsecurities_cedentes
              WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ${cedenteCpf}
              LIMIT 1
            `
          : Promise.resolve([] as any[]),
      ]);

      const sacado = sacadoRows[0] ?? null;
      const cedente = cedenteRows[0] ?? null;

      // ----------------------------------------------------------------------
      // 3. Calcula dias de vencimento (defensivo, frontend pode reusar)
      // ----------------------------------------------------------------------
      let diasVencimento: number | null = null;
      if (tituloRow.vencimento) {
        const v = new Date(tituloRow.vencimento);
        diasVencimento = Math.floor((Date.now() - v.getTime()) / (1000 * 60 * 60 * 24));
      }

      return jsonResponse({
        success: true,
        titulo: {
          ...tituloRow,
          fonte: tituloFonte,            // 'em_aberto' ou 'quitado'
          dias_vencimento: diasVencimento, // >0 = vencido, <0 = a vencer
        },
        sacado,
        cedente,
        latency_ms: Date.now() - startedAt,
      });
    } finally {
      await sql.end({ timeout: 2 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[smart-titulo-info] erro:", msg);
    return jsonResponse({
      success: false,
      error_code: "INTERNAL_ERROR",
      message: msg,
    }, 500);
  }
});
