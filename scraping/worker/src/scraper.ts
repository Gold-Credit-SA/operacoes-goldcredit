import type { Page } from 'playwright';
import { config } from './config.js';
import { logger } from './logger.js';
import { smartSession } from './session.js';
import { isPdfSizeReasonable, isValidPdf } from './validator.js';

export type ScrapeTipo = 'boleto' | 'nf';

// Payload completo enviado pela edge (decisão arquitetural ponto 2:
// edge resolve os IDs, worker é burro).
export interface ScrapePayload {
  titulo_id: string | number;
  tipo: ScrapeTipo;
  nosso_numero?: string | null;
  documento?: string | null; // doc sacado
  cedente_id?: string | null;
  cedente_documento?: string | null;
  // Campos abertos pro futuro — o worker só usa os que precisar.
  extra?: Record<string, unknown>;
}

export type ScrapeErrorCode =
  | 'TITULO_NAO_ENCONTRADO'
  | 'LOGIN_FAILED'
  | 'TIMEOUT'
  | 'PORTAL_OFFLINE'
  | 'PDF_INVALID'
  | 'INTERNAL_ERROR';

export interface ScrapeResultOk {
  success: true;
  pdf_base64: string;
  mime: 'application/pdf';
  bytes: number;
  fetched_at: string;
}

export interface ScrapeResultErr {
  success: false;
  error_code: ScrapeErrorCode;
  message: string;
  http_status: number;
}

export type ScrapeResult = ScrapeResultOk | ScrapeResultErr;

function err(code: ScrapeErrorCode, message: string, httpStatus: number): ScrapeResultErr {
  return { success: false, error_code: code, message, http_status: httpStatus };
}

// ============================================================================
// Função pública de scraping. Chamada pela fila (queue.ts).
// ============================================================================
export async function scrape(payload: ScrapePayload): Promise<ScrapeResult> {
  const log = logger.child({ titulo_id: payload.titulo_id, tipo: payload.tipo });
  const start = Date.now();
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  let lastErr: ScrapeResultErr | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const context = await smartSession.getContext();
      const page = await context.newPage();
      page.setDefaultTimeout(config.SCRAPE_TIMEOUT_MS);

      try {
        const pdfBuffer =
          payload.tipo === 'boleto'
            ? await downloadBoleto(page, payload)
            : await downloadNf(page, payload);

        if (!isValidPdf(pdfBuffer)) {
          log.warn({ bytes: pdfBuffer.length }, 'response is not a valid PDF');
          return err('PDF_INVALID', 'Resposta do portal não é PDF válido', 502);
        }
        if (!isPdfSizeReasonable(pdfBuffer)) {
          log.warn({ bytes: pdfBuffer.length }, 'PDF size out of expected range');
          return err('PDF_INVALID', 'Tamanho de PDF fora do esperado', 502);
        }

        log.info(
          { attempts, ms: Date.now() - start, bytes: pdfBuffer.length },
          'scrape success',
        );
        return {
          success: true,
          pdf_base64: pdfBuffer.toString('base64'),
          mime: 'application/pdf',
          bytes: pdfBuffer.length,
          fetched_at: new Date().toISOString(),
        };
      } finally {
        await page.close().catch(() => undefined);
      }
    } catch (e) {
      const code: ScrapeErrorCode = (e as { errorCode?: ScrapeErrorCode })?.errorCode ?? 'INTERNAL_ERROR';
      const msg = e instanceof Error ? e.message : String(e);
      log.warn({ attempts, errorCode: code, msg }, 'scrape attempt failed');

      // Login falhou ou portal mudou — invalida sessão pra próxima tentativa
      // recomeçar fresca.
      if (code === 'LOGIN_FAILED' || /not logged|sign-?in|login/i.test(msg)) {
        smartSession.invalidate('login error during scrape');
      }

      lastErr =
        code === 'TITULO_NAO_ENCONTRADO'
          ? err(code, msg, 404)
          : code === 'LOGIN_FAILED'
          ? err(code, msg, 502)
          : code === 'TIMEOUT' || /timeout/i.test(msg)
          ? err('TIMEOUT', msg, 504)
          : err(code, msg, 502);

      // TITULO_NAO_ENCONTRADO e LOGIN_FAILED não devem retry de imediato.
      if (code === 'TITULO_NAO_ENCONTRADO') return lastErr;

      // Backoff exponencial: 1s, 2s, 4s.
      const wait = Math.min(4_000, 500 * 2 ** attempts);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  return lastErr ?? err('INTERNAL_ERROR', 'unknown error', 500);
}

// ============================================================================
// PONTO DE MANUTENÇÃO #2 — NAVEGAÇÃO PARA BAIXAR BOLETO
// Implementação depende do HTML real do portal Smart. Os passos abaixo são um
// esqueleto. Rode `npx playwright codegen` no portal pra capturar os seletores
// e cole aqui.
//
// Padrão esperado:
//   1. Navegar pra rota do título (URL pattern: /titulo/<id> ou similar)
//   2. Clicar no botão "Baixar boleto" / "2ª via"
//   3. Interceptar o response do PDF (page.waitForEvent('download') OU
//      page.waitForResponse(r => r.headers()['content-type'] === 'application/pdf'))
//   4. Retornar o buffer
// ============================================================================
async function downloadBoleto(page: Page, payload: ScrapePayload): Promise<Buffer> {
  const url = buildTituloUrl(payload);
  logger.debug({ url }, 'navigating to titulo page (boleto)');

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

  if (response && [401, 403].includes(response.status())) {
    throw Object.assign(new Error('Sessão expirada / acesso negado'), { errorCode: 'LOGIN_FAILED' });
  }

  // Heurística: se redirecionou pra /login, sessão morreu.
  if (/\/login|\/sign-?in|\/auth/i.test(page.url())) {
    throw Object.assign(new Error('Redirecionado para login durante scrape de boleto'), {
      errorCode: 'LOGIN_FAILED',
    });
  }

  // Heurística: portal retorna 404 ou mostra "Título não encontrado"
  const notFoundText = await page
    .locator(':text-matches("(não|nao) encontrado|inexistente|not found", "i")')
    .first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (notFoundText || response?.status() === 404) {
    throw Object.assign(new Error(`Título ${payload.titulo_id} não encontrado no portal`), {
      errorCode: 'TITULO_NAO_ENCONTRADO',
    });
  }

  // TODO: substituir o seletor abaixo pelo botão real do portal.
  const downloadPromise = page.waitForEvent('download', { timeout: config.SCRAPE_TIMEOUT_MS });
  await page.click('a:has-text("2ª via"), button:has-text("Boleto"), [data-testid="download-boleto"]');
  const download = await downloadPromise;

  const stream = await download.createReadStream();
  if (!stream) {
    // Fallback: alguns portais devolvem o PDF como response inline.
    const saved = await download.path();
    if (!saved) throw new Error('PDF não recebido do portal');
    const fs = await import('fs/promises');
    return fs.readFile(saved);
  }
  return streamToBuffer(stream);
}

// ============================================================================
// PONTO DE MANUTENÇÃO #3 — NAVEGAÇÃO PARA BAIXAR NF
// Mesma lógica do boleto, mudando seletor/URL.
// ============================================================================
async function downloadNf(page: Page, payload: ScrapePayload): Promise<Buffer> {
  const url = buildTituloUrl(payload);
  logger.debug({ url }, 'navigating to titulo page (nf)');

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (response && [401, 403].includes(response.status())) {
    throw Object.assign(new Error('Sessão expirada'), { errorCode: 'LOGIN_FAILED' });
  }
  if (/\/login/i.test(page.url())) {
    throw Object.assign(new Error('Redirecionado para login'), { errorCode: 'LOGIN_FAILED' });
  }
  if (response?.status() === 404) {
    throw Object.assign(new Error(`Título ${payload.titulo_id} não encontrado`), {
      errorCode: 'TITULO_NAO_ENCONTRADO',
    });
  }

  // TODO: ajustar seletor da NF.
  const downloadPromise = page.waitForEvent('download', { timeout: config.SCRAPE_TIMEOUT_MS });
  await page.click('a:has-text("Nota Fiscal"), button:has-text("NF"), [data-testid="download-nf"]');
  const download = await downloadPromise;

  const stream = await download.createReadStream();
  if (!stream) {
    const saved = await download.path();
    if (!saved) throw new Error('PDF não recebido do portal');
    const fs = await import('fs/promises');
    return fs.readFile(saved);
  }
  return streamToBuffer(stream);
}

// ============================================================================
// PONTO DE MANUTENÇÃO #4 — URL DO TÍTULO NO PORTAL
// Ajustar pattern conforme rota real do portal Smart.
// Exemplos comuns vistos em outros portais:
//   {BASE}/titulo/{id}
//   {BASE}/cobranca/titulos/{id}
//   {BASE}/sacado/titulos?id={id}
// ============================================================================
function buildTituloUrl(payload: ScrapePayload): string {
  return `${config.SMART_PORTAL_URL}/smart/titulo/${encodeURIComponent(String(payload.titulo_id))}`;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
