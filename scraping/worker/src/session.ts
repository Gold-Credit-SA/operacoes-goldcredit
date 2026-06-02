import { promises as fs } from 'fs';
import path from 'path';
import { type Browser, type BrowserContext, chromium } from 'playwright';
import { config } from './config.js';
import { logger } from './logger.js';

// Gerencia o ciclo de vida do browser + contexto logado no portal Smart.
// Estratégia:
//  - Um único Browser headless, vários contexts isolados (não usado aqui — única session pro robô)
//  - Cookie salvo em disco (storageState). Em fast-reboot, recarrega sem relogar.
//  - Detecção de sessão expirada por redirect para /login.

export class SmartSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private loggedInAt = 0;
  private loggingIn: Promise<void> | null = null;

  async getContext(): Promise<BrowserContext> {
    await this.ensureBrowser();

    // Se já está logando, espera a operação em curso (evita login paralelo).
    if (this.loggingIn) await this.loggingIn;

    // TTL do cookie — força relogin periódico mesmo sem detectar expiração.
    if (this.context && Date.now() - this.loggedInAt < config.SESSION_TTL_MS) {
      return this.context;
    }

    // Lock pra dedup login concorrente.
    this.loggingIn = this.login();
    try {
      await this.loggingIn;
    } finally {
      this.loggingIn = null;
    }

    if (!this.context) {
      throw new Error('SmartSession: context indisponível após login');
    }
    return this.context;
  }

  // Marcar sessão como inválida — próximo getContext relogará.
  invalidate(reason: string): void {
    logger.warn({ reason }, 'session invalidated');
    this.loggedInAt = 0;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (this.browser && this.browser.isConnected()) return;

    logger.info({ headless: config.HEADLESS }, 'launching chromium');
    this.browser = await chromium.launch({
      headless: config.HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // pra VPS com pouca /dev/shm
        '--disable-blink-features=AutomationControlled',
      ],
    });

    this.browser.on('disconnected', () => {
      logger.error('chromium disconnected unexpectedly');
      this.browser = null;
      this.context = null;
      this.loggedInAt = 0;
    });
  }

  private async login(): Promise<void> {
    if (!this.browser) throw new Error('login: browser não inicializado');

    // Tenta reusar storage state (cookie) salvo no disco.
    let storageState: string | undefined;
    try {
      await fs.access(config.SESSION_STORAGE_PATH);
      storageState = config.SESSION_STORAGE_PATH;
      logger.info({ path: storageState }, 'reusing saved storage state');
    } catch {
      // arquivo não existe — login fresco
    }

    // Fecha context antigo se existir.
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }

    this.context = await this.browser.newContext({
      storageState,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    });

    // Verifica se o cookie reusado ainda é válido visitando uma rota
    // autenticada qualquer. Se redirecionar para login, relogga.
    const page = await this.context.newPage();
    try {
      const response = await page.goto(config.SMART_PORTAL_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
      const finalUrl = page.url();
      const looksLikeLogin = /\/login|\/sign-?in|\/auth/i.test(finalUrl) || !response?.ok();

      if (looksLikeLogin || !storageState) {
        await this.performLogin(page);
      }

      // Persistir storage state no disco para próximo boot.
      await this.persistStorageState();
      this.loggedInAt = Date.now();
      logger.info('session ready');
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  // ==========================================================================
  // PONTO DE MANUTENÇÃO #1 — SELETORES DO PORTAL SMART
  // Atualize os seletores abaixo de acordo com o HTML real do portal Smart.
  // Quando o portal mudar de visual, é este método que você re-grava.
  // Sugestão: rode `npx playwright codegen <SMART_PORTAL_URL>` pra capturar os
  // seletores de forma estável.
  // ==========================================================================
  private async performLogin(page: import('playwright').Page): Promise<void> {
    logger.info({ url: config.SMART_PORTAL_URL }, 'performing login');

    // Vai pra tela de login (alguns portais redirecionam sozinhos quando você
    // visita a raiz sem cookie; outros têm rota explícita).
    await page.goto(`${config.SMART_PORTAL_URL}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    }).catch(() => undefined);

    // TODO: ajustar seletores conforme HTML real do portal Smart.
    // Os abaixo são placeholders genéricos.
    try {
      await page.fill('input[name="usuario"], input[name="email"], input[type="email"]', config.SMART_PORTAL_USER, {
        timeout: 10_000,
      });
      await page.fill('input[name="senha"], input[name="password"], input[type="password"]', config.SMART_PORTAL_PASS, {
        timeout: 10_000,
      });
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 20_000 }),
        page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")'),
      ]);
    } catch (err) {
      throw Object.assign(new Error('LOGIN_FAILED: falha ao preencher/submeter formulário'), {
        cause: err,
        errorCode: 'LOGIN_FAILED',
      });
    }

    // Detecção de sucesso: URL não está mais no /login.
    const finalUrl = page.url();
    if (/\/login|\/sign-?in|\/auth/i.test(finalUrl)) {
      throw Object.assign(new Error('LOGIN_FAILED: portal continua na tela de login após submit'), {
        errorCode: 'LOGIN_FAILED',
      });
    }

    logger.info({ url: finalUrl }, 'login successful');
  }

  private async persistStorageState(): Promise<void> {
    if (!this.context) return;
    try {
      await fs.mkdir(path.dirname(config.SESSION_STORAGE_PATH), { recursive: true });
      await this.context.storageState({ path: config.SESSION_STORAGE_PATH });
    } catch (err) {
      logger.warn({ err }, 'failed to persist storage state (continuando)');
    }
  }
}

export const smartSession = new SmartSession();
