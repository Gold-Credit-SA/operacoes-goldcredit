// deno-lint-ignore-file no-explicit-any
// ============================================================================
// smart-scraper — edge function que proxia para o worker VPS, cacheia o PDF
// no bucket smart-anexos e devolve signed URL pro consumidor (régua de
// cobrança, abertura manual, etc).
//
// Arquitetura (decisões consolidadas):
//   1. Edge resolve campos do título (nosso_numero, documento, etc) e manda
//      payload completo pro worker — worker é burro.
//   2. Worker devolve base64. Edge faz upload no Storage com service_role
//      (service_role nunca sai do Supabase).
//   3. Cache: boleto TTL 6h ou invalidado quando source_updated_at muda; NF
//      TTL 30 dias.
//   4. Feature flag `cobranca_settings.smart_pdf_source` decide entre
//      scraper / official (futura API v2) / disabled.
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, resolveUserId } from "../_shared/supabase-admin.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// ----------------------------------------------------------------------------
// Constantes de TTL (em ms)
// ----------------------------------------------------------------------------
const TTL_BOLETO_MS  = 6 * 60 * 60 * 1000;        // 6 horas
const TTL_NF_MS      = 30 * 24 * 60 * 60 * 1000;  // 30 dias
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;  // 7 dias

const BUCKET = "smart-anexos";

const PDF_MAGIC = "%PDF-";

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------
type Tipo = "boleto" | "nf";

interface ScrapeRequest {
  titulo_id: string;
  tipo: Tipo;
  force_refresh?: boolean;
  // extra: campos específicos do portal Smart.
  // Pra tipo='boleto', exige `extra.checks` (ex: '21467,').
  extra?: Record<string, unknown> | null;
}

interface TituloLookup {
  titulo_id: string;
  nosso_numero: string | null;
  documento: string | null;        // doc do sacado (CPF/CNPJ)
  cedente_id: string | null;
  cedente_documento: string | null;
  status: string | null;
  updated_at: string | null;       // pra invalidação por evento
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function badRequest(message: string, extra?: Record<string, unknown>): Response {
  return jsonResponse({ success: false, error_code: "BAD_REQUEST", message, ...extra }, 400);
}

function unauthorized(): Response {
  return jsonResponse({ success: false, error_code: "UNAUTHORIZED", message: "JWT inválido ou ausente" }, 401);
}

function ttlForTipo(tipo: Tipo): number {
  return tipo === "boleto" ? TTL_BOLETO_MS : TTL_NF_MS;
}

function storagePath(tipo: Tipo, tituloId: string): string {
  // Overwrite simples: 1 título + 1 tipo = 1 arquivo. Re-scrape sobrescreve.
  // Pra boleto, dois `checks` diferentes do mesmo título compartilham o mesmo
  // arquivo (o cache sabe diferenciar por extra_key e invalida quando muda).
  return `${tipo}/${tituloId}.pdf`;
}

// Hash determinístico curto do `extra` pra diferenciar cache entre variações
// do mesmo título (ex: dois `checks` diferentes pro mesmo titulo_id).
async function computeExtraKey(extra: Record<string, unknown> | null | undefined): Promise<string | null> {
  if (!extra || Object.keys(extra).length === 0) return null;
  // Ordena chaves pra hash ser determinístico.
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(extra).sort()) sorted[k] = extra[k];
  const text = JSON.stringify(sorted);
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function isValidPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  const head = new TextDecoder("ascii").decode(bytes.subarray(0, PDF_MAGIC.length));
  return head === PDF_MAGIC;
}

// ----------------------------------------------------------------------------
// Detecta "PDFs de erro" — situação em que o worker fez page.pdf() numa
// página HTML de "sessão expirada"/"login" do portal Smart em vez de baixar
// o PDF real. Tecnicamente o resultado É um PDF válido (Chromium gerou) mas
// o conteúdo é a tela de erro renderizada.
//
// Estratégias:
//   1. Lê /Title do PDF (pode estar em hex UTF-16 BE ou ASCII literal)
//      e checa keywords típicas de página de erro
//   2. Se Creator/Producer é Chromium/Skia E tamanho < 100KB → suspeito
//      (PDFs reais do Smart vêm gerados por TCPDF/server-side, não Chromium)
// ----------------------------------------------------------------------------
const ERROR_KEYWORDS = /(expir|sess[aã]o|fa[çc]a\s*login|entrar|acessar\s*o\s*sistema|sign[\s-]?in)/i;

function looksLikeErrorPdf(bytes: Uint8Array): { ok: false; reason: string } | { ok: true } {
  // Inspeciona só os primeiros 8KB — metadata fica no início do PDF.
  const head = new TextDecoder("latin1").decode(
    bytes.subarray(0, Math.min(bytes.length, 8192)),
  );

  // /Title <FEFF....> — hex UTF-16 BE com BOM
  const hexTitle = head.match(/\/Title\s*<([0-9A-Fa-f\s]+)>/);
  if (hexTitle) {
    const hex = hexTitle[1].replace(/\s/g, "");
    let title = "";
    // Pula BOM (FEFF) se presente
    const start = hex.toUpperCase().startsWith("FEFF") ? 4 : 0;
    for (let i = start; i + 3 < hex.length; i += 4) {
      title += String.fromCodePoint(parseInt(hex.substring(i, i + 4), 16));
    }
    if (ERROR_KEYWORDS.test(title)) {
      return { ok: false, reason: `PDF título="${title}" parece página de erro` };
    }
  }

  // /Title (...) — ASCII literal entre parênteses
  const litTitle = head.match(/\/Title\s*\(([^)]+)\)/);
  if (litTitle && ERROR_KEYWORDS.test(litTitle[1])) {
    return { ok: false, reason: `PDF título="${litTitle[1]}" parece página de erro` };
  }

  // Heurística: Chromium/Skia gerando PDF pequeno é suspeito.
  // Smart gera boleto via TCPDF (sem "Chromium" no metadata) e NF DANFE
  // também vem de gerador server-side. Se vier Chromium + <100KB, alerta.
  const isChromiumGenerated =
    /\/Creator\s*\(Chromium\)/i.test(head) || /\/Producer\s*\(Skia\/PDF/i.test(head);

  if (isChromiumGenerated && bytes.length < 100_000) {
    return {
      ok: false,
      reason: `PDF gerado por Chromium com ${bytes.length} bytes — provavelmente print da página de erro do Smart`,
    };
  }

  return { ok: true };
}

// ----------------------------------------------------------------------------
// Feature flag — lê cobranca_settings.smart_pdf_source.
// Retorna 'scraper' se a tabela/coluna não existir (fail-safe).
// ----------------------------------------------------------------------------
async function getPdfSource(): Promise<"scraper" | "official" | "disabled"> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("cobranca_settings")
      .select("smart_pdf_source")
      .limit(1)
      .maybeSingle();
    if (error || !data) return "scraper";
    const v = (data as any).smart_pdf_source;
    if (v === "scraper" || v === "official" || v === "disabled") return v;
    return "scraper";
  } catch {
    return "scraper";
  }
}

// ----------------------------------------------------------------------------
// Resolução do título no Postgres externo (smartsecurities_*)
// Procura primeiro em em_aberto, depois quitados.
// AJUSTAR conforme nomes reais de coluna na sua base — placeholders abaixo.
// ----------------------------------------------------------------------------
async function lookupTitulo(tituloId: string): Promise<TituloLookup | null> {
  const host = Deno.env.get("EXTERNAL_DB_HOST");
  const user = Deno.env.get("EXTERNAL_DB_USER");
  const pass = Deno.env.get("EXTERNAL_DB_PASS");
  const name = Deno.env.get("EXTERNAL_DB_NAME");
  const port = Deno.env.get("EXTERNAL_DB_PORT") || "5432";
  if (!host || !user || !pass || !name) {
    throw new Error("EXTERNAL_DB_* não configurado nos secrets da edge");
  }

  const sql = postgres(`postgres://${user}:${pass}@${host}:${port}/${name}`, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    // PONTO DE AJUSTE: nomes de coluna abaixo são placeholders. Ajuste pros
    // nomes reais das tabelas smartsecurities_titulos_em_aberto/quitados.
    // Procuramos por id_titulo OU nosso_numero — o cliente pode passar
    // qualquer um dos dois.
    const rowsAberto = await sql/* sql */`
      SELECT
        id_titulo::text                                  AS titulo_id,
        nosso_numero::text                               AS nosso_numero,
        cpf_cnpj_sacado::text                            AS documento,
        cedente::text                                    AS cedente_id,
        cpf_cnpj_cedente::text                           AS cedente_documento,
        'emaberto'::text                                 AS status,
        coalesce(updated_at, vencimento::timestamptz)    AS updated_at
      FROM smartsecurities_titulos_em_aberto
      WHERE id_titulo::text = ${tituloId}
         OR nosso_numero::text = ${tituloId}
      LIMIT 1
    `;
    if (rowsAberto.length > 0) return rowsAberto[0] as TituloLookup;

    const rowsQuit = await sql/* sql */`
      SELECT
        id_titulo::text                                  AS titulo_id,
        nosso_numero::text                               AS nosso_numero,
        cpf_cnpj_sacado::text                            AS documento,
        cedente::text                                    AS cedente_id,
        cpf_cnpj_cedente::text                           AS cedente_documento,
        'quitado'::text                                  AS status,
        coalesce(updated_at, data_pagamento::timestamptz) AS updated_at
      FROM smartsecurities_titulos_quitados
      WHERE id_titulo::text = ${tituloId}
         OR nosso_numero::text = ${tituloId}
      LIMIT 1
    `;
    if (rowsQuit.length > 0) return rowsQuit[0] as TituloLookup;

    return null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

// ----------------------------------------------------------------------------
// Cache check
// Retorna cache se: existe + não expirado + source_updated_at não mudou.
// ----------------------------------------------------------------------------
async function getCachedSignedUrl(
  tituloId: string,
  tipo: Tipo,
  sourceUpdatedAt: string | null,
  extraKey: string | null,
): Promise<{ signed_url: string; expires_at: string; from_cache: true } | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("smart_anexos_cache")
    .select("storage_path, expires_at, source_updated_at, hit_count, extra_key")
    .eq("titulo_id", tituloId)
    .eq("tipo", tipo)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  // Invalidação por mudança em `extra` (ex: `checks` do boleto trocou).
  // Se o cliente mandou extra_key diferente do cacheado, invalidar.
  if (extraKey !== ((data as any).extra_key ?? null)) {
    return null;
  }

  // Invalidação por evento: se o título no Smart foi atualizado depois do
  // último scrape, invalidar (boleto vencido somou juros, NF foi reemitida).
  if (sourceUpdatedAt && data.source_updated_at) {
    if (new Date(sourceUpdatedAt).getTime() > new Date(data.source_updated_at).getTime()) {
      return null;
    }
  }

  // Incrementa hit_count (best-effort, não bloqueia em erro)
  await supabase
    .from("smart_anexos_cache")
    .update({ hit_count: ((data as any).hit_count ?? 0) + 1 })
    .eq("titulo_id", tituloId)
    .eq("tipo", tipo)
    .then(() => undefined, () => undefined);

  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) return null;

  return {
    signed_url: signed.signedUrl,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    from_cache: true,
  };
}

// ----------------------------------------------------------------------------
// Chamada ao worker VPS
// ----------------------------------------------------------------------------
async function callWorker(
  titulo: TituloLookup,
  tipo: Tipo,
  extra: Record<string, unknown> | null,
): Promise<{ pdf_bytes: Uint8Array; fetched_at: string } | { error: { code: string; message: string; http_status: number } }> {
  const url = Deno.env.get("SMART_SCRAPER_URL");
  const token = Deno.env.get("SMART_SCRAPER_TOKEN");
  if (!url || !token) {
    return { error: { code: "WORKER_NOT_CONFIGURED", message: "SMART_SCRAPER_URL/TOKEN ausentes", http_status: 503 } };
  }

  const ctrl = new AbortController();
  // Edge timeout: 45s. Bem abaixo do limite de 100s da Cloudflare em frente
  // da Supabase pra não cair em 504 genérico. Worker normalmente baixa em
  // 10-20s — se chegar perto de 45s é sinal de sessão morta ou portal lento.
  const EDGE_TIMEOUT_MS = 45_000;
  const timeoutId = setTimeout(() => ctrl.abort(), EDGE_TIMEOUT_MS);

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        titulo_id: titulo.titulo_id,
        tipo,
        nosso_numero: titulo.nosso_numero,
        documento: titulo.documento,
        cedente_id: titulo.cedente_id,
        cedente_documento: titulo.cedente_documento,
        extra: extra ?? undefined,
      }),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* keep null */ }

    if (!res.ok || !json?.success) {
      return {
        error: {
          code: json?.error_code ?? `HTTP_${res.status}`,
          message: json?.message ?? text.slice(0, 200),
          http_status: res.status === 0 ? 502 : res.status,
        },
      };
    }

    if (typeof json.pdf_base64 !== "string" || json.pdf_base64.length === 0) {
      return { error: { code: "PDF_INVALID", message: "Worker retornou sem pdf_base64", http_status: 502 } };
    }

    const bytes = base64ToBytes(json.pdf_base64);
    if (!isValidPdfBytes(bytes)) {
      return { error: { code: "PDF_INVALID", message: "Bytes recebidos não são PDF", http_status: 502 } };
    }

    // Defesa contra "PDFs de erro" — worker pode ter feito page.pdf() numa
    // página HTML de sessão expirada. Tecnicamente é PDF válido mas o
    // conteúdo é a tela de erro renderizada. Tratamos como LOGIN_FAILED
    // pra disparar renovação manual da sessão Smart.
    const errCheck = looksLikeErrorPdf(bytes);
    if (!errCheck.ok) {
      return {
        error: {
          code: "LOGIN_FAILED",
          message: `Sessão Smart expirada (${errCheck.reason}). Renove via noVNC na VPS.`,
          http_status: 502,
        },
      };
    }

    return { pdf_bytes: bytes, fetched_at: json.fetched_at ?? new Date().toISOString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = (err as any)?.name === "AbortError";
    return {
      error: {
        code: isAbort ? "TIMEOUT" : "WORKER_UNREACHABLE",
        message: isAbort
          ? `Worker não respondeu em ${EDGE_TIMEOUT_MS / 1000}s. Provavelmente sessão Smart morreu — renove via noVNC. (PM2: pm2 logs smart-scraper-worker --lines 30)`
          : msg,
        http_status: isAbort ? 504 : 502,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ----------------------------------------------------------------------------
// Upload + cache upsert + signed URL
// ----------------------------------------------------------------------------
async function persistAndSign(
  titulo: TituloLookup,
  tipo: Tipo,
  pdfBytes: Uint8Array,
  fetchedAt: string,
  userId: string | null,
  extraKey: string | null,
): Promise<{ signed_url: string; expires_at: string }> {
  const supabase = getAdminClient();
  const path = storagePath(tipo, titulo.titulo_id);

  // Upsert no Storage (overwrite simples).
  const { error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "private, max-age=0",
    });

  if (upErr) {
    throw new Error(`Falha ao salvar no Storage: ${upErr.message}`);
  }

  // Upsert na tabela de cache.
  const expiresAt = new Date(Date.now() + ttlForTipo(tipo)).toISOString();
  const { error: cacheErr } = await supabase
    .from("smart_anexos_cache")
    .upsert({
      titulo_id: titulo.titulo_id,
      tipo,
      storage_path: path,
      bytes: pdfBytes.length,
      fetched_at: fetchedAt,
      expires_at: expiresAt,
      source_updated_at: titulo.updated_at,
      source_status: titulo.status,
      last_requested_by: userId,
      hit_count: 0,
      extra_key: extraKey,
    }, { onConflict: "titulo_id,tipo" });

  if (cacheErr) {
    // Não falha o request: storage upload funcionou. Só loga.
    console.warn("[smart-scraper] cache upsert falhou:", cacheErr.message);
  }

  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    throw new Error(`Falha ao gerar signed URL: ${signErr?.message ?? "unknown"}`);
  }

  return {
    signed_url: signed.signedUrl,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const traceId = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return badRequest("Use POST");
    }

    // Auth (apenas usuários autenticados podem pedir PDF).
    const userId = await resolveUserId(req);
    if (!userId) return unauthorized();

    // Parse + validate body.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Body inválido");

    const tituloId = body.titulo_id != null ? String(body.titulo_id).trim() : "";
    const tipo = body.tipo as Tipo;
    const forceRefresh = Boolean(body.force_refresh);
    const extra: Record<string, unknown> | null =
      body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)
        ? (body.extra as Record<string, unknown>)
        : null;

    if (!tituloId) return badRequest("titulo_id é obrigatório");
    if (tipo !== "boleto" && tipo !== "nf") return badRequest("tipo deve ser 'boleto' ou 'nf'");

    // Pra boleto: `extra.checks` é OPCIONAL.
    // DESCOBERTA importante: o `Checks` da URL do boleto no Smart é
    // literalmente o próprio `id_titulo` (validado em teste real:
    // título com id_titulo=24960 gera URL ?Checks=24960,).
    // Por isso, se o cliente não mandou extra.checks, calculamos
    // automaticamente como `${titulo_id},`. Cliente pode sobrescrever
    // passando extra.checks explícito (útil pra re-emissões com Checks
    // diferente, se isso existir).

    // Auto-derivação do `checks` quando boleto e cliente não passou.
    // Checks no Smart = `${id_titulo},` (validado em teste real).
    let effectiveExtra = extra;
    if (tipo === "boleto" && !extra?.checks) {
      effectiveExtra = { ...(extra ?? {}), checks: `${tituloId},` };
    }

    const extraKey = await computeExtraKey(effectiveExtra);

    // Feature flag.
    const source = await getPdfSource();
    if (source === "disabled") {
      return jsonResponse({ success: false, error_code: "DISABLED", message: "Origem de PDF desabilitada nas settings" }, 503);
    }
    if (source === "official") {
      // Stub: quando a Smart liberar oficial, chamar smart-api aqui.
      return jsonResponse({
        success: false,
        error_code: "OFFICIAL_NOT_IMPLEMENTED",
        message: "Origem 'official' ainda não implementada. Alterne para 'scraper'.",
      }, 503);
    }

    // Lookup título (opcional — se falhar, segue com synthetic).
    // O lookup serve só pra enriquecer payload do worker e habilitar
    // invalidação fina de cache via source_updated_at. O worker não depende
    // dele — pra boleto usa extra.checks, pra NF usa o titulo_id direto.
    // Schema do banco externo pode variar; sem lookup, cache invalida só
    // por TTL (que ainda funciona corretamente).
    let titulo: TituloLookup;
    try {
      const found = await lookupTitulo(tituloId);
      if (found) {
        titulo = found;
      } else {
        console.warn(`[smart-scraper][${traceId}] titulo ${tituloId} não achado no banco externo — usando synthetic, cache só por TTL`);
        titulo = {
          titulo_id: tituloId,
          nosso_numero: null,
          documento: null,
          cedente_id: null,
          cedente_documento: null,
          status: null,
          updated_at: null,
        };
      }
    } catch (err) {
      console.warn(`[smart-scraper][${traceId}] lookupTitulo error (seguindo com synthetic):`, err);
      titulo = {
        titulo_id: tituloId,
        nosso_numero: null,
        documento: null,
        cedente_id: null,
        cedente_documento: null,
        status: null,
        updated_at: null,
      };
    }

    // Cache check (a menos que force_refresh).
    if (!forceRefresh) {
      const cached = await getCachedSignedUrl(titulo.titulo_id, tipo, titulo.updated_at, extraKey);
      // (`extraKey` agora reflete `effectiveExtra` — derivado se necessário)
      if (cached) {
        return jsonResponse({
          success: true,
          from_cache: true,
          signed_url: cached.signed_url,
          expires_at: cached.expires_at,
          trace_id: traceId,
          latency_ms: Date.now() - startedAt,
        });
      }
    }

    // Cache miss → worker. Usa effectiveExtra (com checks auto-derivado se for o caso).
    const result = await callWorker(titulo, tipo, effectiveExtra);
    if ("error" in result) {
      return jsonResponse({
        success: false,
        error_code: result.error.code,
        message: result.error.message,
        trace_id: traceId,
        latency_ms: Date.now() - startedAt,
      }, result.error.http_status);
    }

    // Persist + sign.
    const signed = await persistAndSign(titulo, tipo, result.pdf_bytes, result.fetched_at, userId, extraKey);

    return jsonResponse({
      success: true,
      from_cache: false,
      signed_url: signed.signed_url,
      expires_at: signed.expires_at,
      trace_id: traceId,
      latency_ms: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[smart-scraper][${traceId}] unhandled:`, msg);
    return jsonResponse({
      success: false,
      error_code: "INTERNAL_ERROR",
      message: msg,
      trace_id: traceId,
    }, 500);
  }
});
