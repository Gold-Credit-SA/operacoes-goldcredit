# Patch — Login automático com 2captcha

## Objetivo

Eliminar a dependência de noVNC + intervenção manual pra renovar sessão Smart.
Quando a sessão cair, o worker faz login sozinho: resolve o reCAPTCHA via API
do 2captcha (~30s) e segue normal.

Custo estimado: **R$ 5-15/mês** dependendo de quantas vezes a sessão cair.

---

## Pré-requisitos (o time precisa fazer ANTES)

### 1. Conta 2captcha
- Acessar https://2captcha.com/?from=8030305
- Criar conta (e-mail + senha)
- Verificar e-mail
- Anotar a **API key** que aparece no dashboard (algo como `a1b2c3d4...32chars`)

### 2. Adicionar crédito
- Dashboard → "Add funds" → escolher US$ 5 ou US$ 10
- Pagar via PayPal, cartão ou crypto
- Aguardar confirmação (~1 min)

### 3. Identificar o sitekey do Smart
**Importante: o sitekey é uma string pública que identifica o reCAPTCHA do
Smart**. Precisamos descobrir uma vez só (não muda).

Como descobrir:
```
1. Abrir https://www.smartsecurities.com.br/smart/loginsec.php no browser
2. F12 → Elements
3. Buscar pela classe "g-recaptcha" ou atributo "data-sitekey"
4. Anotar o valor de data-sitekey (vai começar com 6Lc...)
```

Se Smart não usa reCAPTCHA visível (pode ser invisível v3 ou hCaptcha),
a abordagem muda — me avise antes de seguir.

---

## Mudanças no `.env` do worker

Adicionar 2 variáveis:

```bash
# .env (na VPS, em /opt/operacoes-goldcredit/scraping/worker/.env)

# API key do 2captcha
TWOCAPTCHA_API_KEY=a1b2c3d4e5f6...

# Sitekey do reCAPTCHA do Smart (descoberto no passo 3 acima)
SMART_RECAPTCHA_SITEKEY=6LcXXXXXXXXXXXXXXXX

# Opcional: URL exata onde o CAPTCHA mora (default OK)
SMART_LOGIN_URL=https://www.smartsecurities.com.br/smart/loginsec.php

# Opcional: timeout pro 2captcha resolver (default 180s)
TWOCAPTCHA_TIMEOUT_MS=180000
```

E ajustar `src/config.ts` pra incluir essas variáveis no schema zod (já temos
zod no projeto):

```typescript
// src/config.ts — adicionar ao ConfigSchema:
TWOCAPTCHA_API_KEY: z.string().optional(),
SMART_RECAPTCHA_SITEKEY: z.string().optional(),
SMART_LOGIN_URL: z.string().url().default('https://www.smartsecurities.com.br/smart/loginsec.php'),
TWOCAPTCHA_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(300_000).default(180_000),
```

Optional = se não vier, worker continua tentando login manual antigo (fallback).

---

## Novo arquivo `src/twocaptcha.ts`

Cliente minimalista pra falar com 2captcha:

```typescript
import { config } from './config.js';
import { logger } from './logger.js';

const BASE = 'https://2captcha.com';

interface SolveOpts {
  sitekey: string;
  pageurl: string;
  signal?: AbortSignal;
}

/**
 * Resolve um reCAPTCHA v2 via 2captcha.
 * Retorna o token (g-recaptcha-response) pronto pra injetar.
 * Lança erro se: sem API key, sem saldo, timeout, falha de rede.
 */
export async function solveRecaptcha({ sitekey, pageurl, signal }: SolveOpts): Promise<string> {
  if (!config.TWOCAPTCHA_API_KEY) {
    throw new Error('TWOCAPTCHA_API_KEY não configurado');
  }

  // 1) Envia o desafio
  const submitParams = new URLSearchParams({
    key: config.TWOCAPTCHA_API_KEY,
    method: 'userrecaptcha',
    googlekey: sitekey,
    pageurl,
    json: '1',
  });

  const submit = await fetch(`${BASE}/in.php`, {
    method: 'POST',
    body: submitParams,
    signal,
  }).then((r) => r.json() as Promise<{ status: number; request: string }>);

  if (submit.status !== 1) {
    throw new Error(`2captcha submit falhou: ${submit.request}`);
  }

  const captchaId = submit.request;
  logger.info({ captchaId }, '2captcha: desafio enviado, aguardando resolução');

  // 2) Poll a cada 5s até resolver ou timeout
  const deadline = Date.now() + config.TWOCAPTCHA_TIMEOUT_MS;
  // 2captcha recomenda esperar 15s antes do 1º poll (humano demora pra resolver)
  await sleep(15_000);

  while (Date.now() < deadline) {
    const res = await fetch(
      `${BASE}/res.php?key=${config.TWOCAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`,
      { signal },
    ).then((r) => r.json() as Promise<{ status: number; request: string }>);

    if (res.status === 1) {
      logger.info({ captchaId, tokenLen: res.request.length }, '2captcha: resolvido');
      return res.request;
    }

    if (res.request === 'CAPCHA_NOT_READY') {
      await sleep(5_000);
      continue;
    }

    // Erro fatal: saldo zero, key inválida, etc.
    throw new Error(`2captcha erro: ${res.request}`);
  }

  throw new Error(`2captcha timeout após ${config.TWOCAPTCHA_TIMEOUT_MS / 1000}s`);
}

/**
 * Consulta saldo atual em USD.
 */
export async function getBalance(): Promise<number> {
  if (!config.TWOCAPTCHA_API_KEY) return 0;
  const res = await fetch(
    `${BASE}/res.php?key=${config.TWOCAPTCHA_API_KEY}&action=getbalance&json=1`,
  ).then((r) => r.json() as Promise<{ status: number; request: string | number }>);
  if (res.status !== 1) throw new Error(`2captcha getbalance: ${res.request}`);
  return Number(res.request);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

---

## Mudanças em `src/session.ts`

Localizar a função `performLogin()` (seção 12.2 da documentação técnica).
Modificar pra detectar CAPTCHA e usar 2captcha quando presente:

```typescript
import { solveRecaptcha } from './twocaptcha.js';

// ... dentro da classe SmartSession:

private async performLogin(page: import('playwright').Page): Promise<void> {
  logger.info({ url: config.SMART_LOGIN_URL }, 'performing login');

  await page.goto(config.SMART_LOGIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  }).catch(() => undefined);

  try {
    // Preenche credenciais
    await page.fill('input#fEmail, input[name="fEmail"]', config.SMART_PORTAL_USER, {
      timeout: 10_000,
    });
    await page.fill('input#fPassword, input[name="fPassword"]', config.SMART_PORTAL_PASS, {
      timeout: 10_000,
    });

    // ── NOVO: detecta e resolve CAPTCHA ──
    const sitekey = await detectRecaptchaSitekey(page);
    if (sitekey) {
      logger.info({ sitekey: sitekey.slice(0, 12) + '...' }, 'CAPTCHA detectado, resolvendo via 2captcha');

      if (!config.TWOCAPTCHA_API_KEY) {
        throw Object.assign(
          new Error('CAPTCHA presente mas TWOCAPTCHA_API_KEY não configurado. Use manual-login.mjs.'),
          { errorCode: 'LOGIN_FAILED' },
        );
      }

      const token = await solveRecaptcha({
        sitekey,
        pageurl: page.url(),
      });

      // Injeta token no campo escondido criado pelo reCAPTCHA
      await page.evaluate((t) => {
        const fields = document.querySelectorAll<HTMLTextAreaElement>(
          'textarea[name="g-recaptcha-response"]',
        );
        fields.forEach((f) => {
          f.value = t;
          f.innerHTML = t;
        });
      }, token);

      logger.info('CAPTCHA resolvido, submetendo formulário');
    }

    // Submete
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined),
      page.click('button:has-text("Entrar"), input[type="submit"], input[value="Entrar"]'),
    ]);
  } catch (err) {
    throw Object.assign(new Error('LOGIN_FAILED: ' + (err instanceof Error ? err.message : String(err))), {
      cause: err,
      errorCode: 'LOGIN_FAILED',
    });
  }

  // Verifica que saiu do login
  const finalUrl = page.url();
  if (/\/login|loginsec|sign-?in|\/auth/i.test(finalUrl)) {
    throw Object.assign(new Error('LOGIN_FAILED: portal continua na tela de login após submit'), {
      errorCode: 'LOGIN_FAILED',
    });
  }

  logger.info({ url: finalUrl }, 'login successful');
}

/**
 * Detecta sitekey do reCAPTCHA na página. Retorna null se não houver.
 * Tenta 3 estratégias na ordem.
 */
async function detectRecaptchaSitekey(page: import('playwright').Page): Promise<string | null> {
  // 1. Via .env (mais confiável se Smart usa sempre o mesmo sitekey)
  if (config.SMART_RECAPTCHA_SITEKEY) return config.SMART_RECAPTCHA_SITEKEY;

  // 2. Via DOM
  const fromDom = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.g-recaptcha[data-sitekey]');
    return el?.dataset?.sitekey ?? null;
  });
  if (fromDom) return fromDom;

  // 3. Via URL do script do recaptcha (fallback)
  const fromScript = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="recaptcha"]'));
    for (const s of scripts) {
      const m = s.src.match(/[?&]render=([^&]+)/);
      if (m) return m[1];
    }
    return null;
  });
  return fromScript;
}
```

---

## Atualizar `src/index.ts` — endpoint de saúde

Adicionar info do 2captcha no `/health`:

```typescript
import { getBalance } from './twocaptcha.js';

let cachedBalance: { value: number; at: number } | null = null;

app.get('/health', async (_req, res) => {
  // Cache 5min — 2captcha cobra cada chamada (mínimo, mas evita stress)
  let balanceUsd: number | null = null;
  if (config.TWOCAPTCHA_API_KEY) {
    if (cachedBalance && Date.now() - cachedBalance.at < 5 * 60_000) {
      balanceUsd = cachedBalance.value;
    } else {
      try {
        balanceUsd = await getBalance();
        cachedBalance = { value: balanceUsd, at: Date.now() };
      } catch {
        balanceUsd = -1; // sinaliza erro
      }
    }
  }

  res.json({
    ok: true,
    service: 'smart-scraper-worker',
    uptime_s: Math.round(process.uptime()),
    queue: queueStats(),
    twocaptcha: config.TWOCAPTCHA_API_KEY
      ? {
          enabled: true,
          balance_usd: balanceUsd,
          low_balance: balanceUsd !== null && balanceUsd < 1, // alerta < US$ 1
        }
      : { enabled: false },
  });
});
```

A página `/smart-scraper-status` do app já consome o `/health` — vai mostrar o
saldo automático.

---

## Atualizar `manual-login.mjs` (modo automático)

O script atual abre Chromium e espera login manual. Pode ser substituído por
uma versão totalmente automática:

```javascript
// scraping/worker/auto-login.mjs (novo)
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { solveRecaptcha } from './dist/twocaptcha.js'; // compilado pelo tsc

const SESSION_PATH = './.playwright/session.json';
const LOGIN_URL = process.env.SMART_LOGIN_URL || 'https://www.smartsecurities.com.br/smart/loginsec.php';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

console.log('navegando para', LOGIN_URL);
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

await page.fill('input#fEmail', process.env.SMART_PORTAL_USER);
await page.fill('input#fPassword', process.env.SMART_PORTAL_PASS);

// Detecta + resolve CAPTCHA
const sitekey = process.env.SMART_RECAPTCHA_SITEKEY
  || await page.locator('.g-recaptcha').first().getAttribute('data-sitekey');

if (sitekey) {
  console.log('resolvendo CAPTCHA via 2captcha (sitekey:', sitekey.slice(0, 12) + '...)');
  const token = await solveRecaptcha({ sitekey, pageurl: LOGIN_URL });
  await page.evaluate(t => {
    document.querySelectorAll('textarea[name="g-recaptcha-response"]').forEach(f => {
      f.value = t; f.innerHTML = t;
    });
  }, token);
  console.log('CAPTCHA resolvido');
}

await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined),
  page.click('button:has-text("Entrar"), input[type="submit"]'),
]);

if (/login|loginsec/i.test(page.url())) {
  console.error('LOGIN FALHOU — ainda na tela de login. URL:', page.url());
  process.exit(1);
}

console.log('login OK. salvando storageState...');
await fs.mkdir(path.dirname(SESSION_PATH), { recursive: true });
await context.storageState({ path: SESSION_PATH });
console.log('sessão salva em', SESSION_PATH);

await browser.close();
console.log('pronto. faça pm2 restart smart-scraper-worker');
```

Uso:
```bash
cd /opt/operacoes-goldcredit/scraping/worker
node auto-login.mjs    # SEM precisar de DISPLAY, sem noVNC
pm2 restart smart-scraper-worker --update-env
```

Mantém o `manual-login.mjs` antigo como fallback caso 2captcha falhe.

---

## Cron de renovação proativa (opcional)

Renova a sessão automaticamente todo dia às 5h, antes do horário comercial:

```bash
# Em /etc/cron.d/smart-relogin
0 5 * * * root cd /opt/operacoes-goldcredit/scraping/worker && /usr/bin/node auto-login.mjs >> /var/log/smart-relogin.log 2>&1 && /usr/bin/pm2 restart smart-scraper-worker --update-env >> /var/log/smart-relogin.log 2>&1
```

Custo: 1 captcha/dia = US$ 0.003/dia = US$ 0.09/mês = R$ 0.50/mês.

---

## Como testar end-to-end

### 1. Validar 2captcha
```bash
cd /opt/operacoes-goldcredit/scraping/worker
node -e "
import('./dist/twocaptcha.js').then(async m => {
  const bal = await m.getBalance();
  console.log('Saldo:', bal, 'USD');
});
"
```

Deve imprimir algo como `Saldo: 5.00 USD`.

### 2. Rodar auto-login
```bash
node auto-login.mjs
```

Output esperado:
```
navegando para https://www.smartsecurities.com.br/smart/loginsec.php
resolvendo CAPTCHA via 2captcha (sitekey: 6LcXXXXXXX...)
CAPTCHA resolvido
login OK. salvando storageState...
sessão salva em ./.playwright/session.json
pronto. faça pm2 restart smart-scraper-worker
```

Tempo total: 25-35s.

### 3. Confirmar que sessão funcionou
```bash
pm2 restart smart-scraper-worker --update-env
pm2 logs smart-scraper-worker --lines 10
```

Deve aparecer:
```
reusing saved storage state
session ready
initial smart portal login OK
```

### 4. Fazer scrape de teste
```bash
WORKER_TOKEN=$(grep WORKER_TOKEN .env | cut -d= -f2)
curl -X POST http://localhost:4000/scrape \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo_id":"24960","tipo":"boleto"}' | head -c 200
```

Deve voltar JSON com pdf_base64.

---

## Troubleshooting

| Sintoma | Causa | Solução |
|---|---|---|
| `2captcha submit falhou: ERROR_KEY_DOES_NOT_EXIST` | API key errada | Cheque TWOCAPTCHA_API_KEY no .env |
| `2captcha erro: ERROR_ZERO_BALANCE` | Sem créditos | Adicionar funds no dashboard 2captcha |
| `2captcha erro: ERROR_GOOGLEKEY` | Sitekey errado | Re-extrair do HTML da página de login |
| `2captcha timeout após 180s` | Sobrecarga deles ou sitekey muito difícil | Tentar de novo, ou aumentar TWOCAPTCHA_TIMEOUT_MS |
| Login falha mesmo após CAPTCHA resolvido | Smart mudou form OU usa proteção adicional | Inspecionar resposta do POST de login |
| Worker `LOGIN_FAILED` direto sem chamar 2captcha | `detectRecaptchaSitekey` retornou null | Confirmar que CAPTCHA realmente aparece no login |

---

## Monitoramento de saldo (alerta)

Script simples pra avisar quando saldo ficar baixo. Cron diário:

```bash
# /etc/cron.d/smart-2captcha-balance
0 9 * * * root cd /opt/operacoes-goldcredit/scraping/worker && /usr/bin/node -e "import('./dist/twocaptcha.js').then(async m => { const b = await m.getBalance(); if (b < 1) { console.error('ALERTA: saldo 2captcha baixo: \$' + b); process.exit(1); } });" 2>&1 | logger -t smart-2captcha
```

Quando alertar, integrar com seu canal preferido (Slack/Discord/email) — pode
ser via webhook simples no mesmo script.

---

## Riscos e considerações finais

1. **Termo de uso do Smart**: provavelmente proíbe automação. Risco baixo de
   ação legal, mas existe risco de bloqueio da conta-robô. Mitigação: rate
   limit no worker (já tem concorrência 2), padrão de uso comercial.

2. **Smart muda o CAPTCHA**: se trocarem pra hCaptcha, o código `method:
   'userrecaptcha'` no twocaptcha.ts vira `method: 'hcaptcha'`. Trivial.

3. **2captcha indisponível**: raro mas possível. O `manual-login.mjs` antigo
   fica como fallback (operador entra via noVNC se 2captcha estiver fora do ar).

4. **Custo escalando**: monitorar saldo. Se cair muito além do esperado,
   investigar — pode ser sessão quebrando 10x mais que o normal.
