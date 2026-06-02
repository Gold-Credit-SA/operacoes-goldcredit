# Patch sugerido — endurecer a sessão Smart contra expiração frequente

## Contexto

O worker já tem keep-alive (seção 19 da documentação técnica), mas a sessão
Smart continua expirando frequentemente em produção, forçando renovação
manual via noVNC + CAPTCHA. Isso quebra a régua de cobrança e fluxos
automatizados.

Esse documento apresenta 4 melhorias **progressivas e independentes** —
podem ser aplicadas isoladamente. Recomendado aplicar na ordem (1 → 2 → 3
→ 4) e observar o ganho antes de seguir.

---

## Antes de mexer no código — diagnosticar

Antes de aplicar qualquer patch, capture **quanto tempo a sessão dura na
prática**. Sem isso, vai ficar atirando no escuro.

Crie esse script em `/opt/operacoes-goldcredit/scraping/worker/session-monitor.sh`:

```bash
#!/usr/bin/env bash
# Loga a cada minuto se a sessão tá viva ou expirada
LOG=/var/log/smart-session-monitor.log
WORKER_TOKEN="<copie do .env>"

while true; do
  # Pinga um título conhecido (ajuste 24960 pra um título real seu)
  RESP=$(curl -s -X POST http://localhost:4000/scrape \
    -H "Authorization: Bearer $WORKER_TOKEN" \
    -H "Content-Type: application/json" \
    --max-time 25 \
    -d '{"titulo_id":"24960","tipo":"boleto"}')

  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if echo "$RESP" | grep -q '"success":true'; then
    echo "[$TS] OK" >> $LOG
  elif echo "$RESP" | grep -q 'LOGIN_FAILED\|Sessao Smart expirada\|session'; then
    echo "[$TS] SESSION_DEAD" >> $LOG
  else
    echo "[$TS] OTHER: $(echo $RESP | cut -c1-80)" >> $LOG
  fi

  sleep 60
done
```

Rode em background com nohup ou screen, deixe correr por 24h:
```bash
chmod +x session-monitor.sh
nohup ./session-monitor.sh > /dev/null 2>&1 &
```

Depois analise o log. Padrão típico:
```
[00:00:00Z] OK
[00:01:00Z] OK
...
[02:34:00Z] OK
[02:35:00Z] SESSION_DEAD     ← morreu aqui
[02:36:00Z] SESSION_DEAD
```

Isso te dá:
- **Lifetime médio**: 2-4h → suspeitar timeout absoluto do Smart
- **Lifetime curto e errático**: 5-30 min → keep-alive falhando, problema #1 ou #2
- **Lifetime longo até evento específico**: → algo dispara invalidação, investigar logs do worker

---

## Melhoria #1 — Keep-alive em dois subdomínios

O portal Smart usa `www` e `wvw` como subdomínios separados. Cookies de
sessão podem ser scopeados a só um deles. Keep-alive precisa pingar os dois.

### Patch em `src/session.ts`

Adicionar mais URLs ao keep-alive:

```typescript
// Antes (1 só URL):
const KEEPALIVE_URLS = [config.SMART_PORTAL_URL];

// Depois (cobre ambos subdomínios + uma página interna real):
const KEEPALIVE_URLS = [
  // Raiz do operador (www)
  'https://www.smartsecurities.com.br/smartsecurities/',
  // Página interna real — Smart conta como atividade legítima
  'https://www.smartsecurities.com.br/smart/financeiro/cobranca/listartitulosaberto.php',
  // Subdomínio wvw — onde mora o boleto
  'https://wvw.smartsecurities.com.br/smart/sacado/popupidentificacao2.php',
];
```

E no `runKeepAliveOnce()`, fazer rotação:

```typescript
private kaIndex = 0;

private async runKeepAliveOnce(): Promise<void> {
  if (this.keepAliveRunning) return;
  if (!this.context) return;
  this.keepAliveRunning = true;

  try {
    if (!this.keepAlivePage || this.keepAlivePage.isClosed()) {
      this.keepAlivePage = await this.context.newPage();
      this.keepAlivePage.setDefaultTimeout(15_000);
    }
    const page = this.keepAlivePage;
    const url = KEEPALIVE_URLS[this.kaIndex % KEEPALIVE_URLS.length];
    this.kaIndex += 1;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      .catch((err) => logger.warn({ err, url }, 'keep-alive navigation failed'));

    const finalUrl = page.url();
    // Detecção mais ampla (#3 abaixo)
    if (/\/login|loginsec|sign-?in|\/auth|expira|expirou/i.test(finalUrl)) {
      logger.warn({ url: finalUrl }, 'keep-alive detected login/expira page');
      this.invalidate('keep-alive detected expired session');
      return;
    }

    // Conteúdo da página também pode revelar — checa título HTML
    const title = await page.title().catch(() => '');
    if (/expira|expirou|sess.o/i.test(title)) {
      logger.warn({ title }, 'keep-alive detected session page in title');
      this.invalidate('keep-alive: title indicates expired');
      return;
    }

    await page.mouse.move(200 + Math.random() * 300, 200 + Math.random() * 200);
    await page.mouse.click(20, 20).catch(() => undefined);
    await this.persistStorageState();
    logger.debug({ url: finalUrl }, 'keep-alive OK');
  } catch (err) {
    logger.warn({ err }, 'keep-alive failed');
  } finally {
    this.keepAliveRunning = false;
  }
}
```

### Ajustar intervalo se necessário

Se mesmo com 1min cair, baixar pra 30s:

```typescript
const intervalMs = 30_000; // de 60s pra 30s
```

---

## Melhoria #2 — Visitar página de feature (não só raiz)

Em vez de só pingar a raiz, pingue páginas de feature reais (que o operador
realmente usaria). Isso reduz suspeita do anti-bot e gera atividade
"normal" pra os logs do Smart.

A URL `listartitulosaberto.php` (Títulos em aberto, seção 14 da doc) é
ideal porque:
- É autenticada (renova sessão)
- É inofensiva (não faz POST)
- É a tela que o operador real fica aberta

Já incluída na lista de URLs do Melhoria #1.

---

## Melhoria #3 — Detecção mais robusta de sessão morta

A regex atual (`/login|loginsec|sign-?in|\/auth/`) pode não pegar todos os
casos. O Smart mostra "Sua sessão do SmartSecurities expirou!" e tem URL
`/smart/php/expira.php` quando expira.

### Lista expandida de sinais

```typescript
function looksLikeSessionDead(finalUrl: string, title: string, bodyText?: string): boolean {
  const urlSignals = /\/login|loginsec|sign-?in|\/auth|\/expira\.php|expirou/i;
  const titleSignals = /sess.o\s+expirou|sess.o\s+expirada|login|entrar|expirou/i;
  const bodySignals = /sua\s+sess.o.*expirou|fa.a\s+login.*acessar/i;

  if (urlSignals.test(finalUrl)) return true;
  if (titleSignals.test(title)) return true;
  if (bodyText && bodySignals.test(bodyText.slice(0, 2000))) return true;
  return false;
}
```

Usar essa função tanto no keep-alive quanto antes de cada scrape (`scraper.ts`)
pra detectar early e abortar com `LOGIN_FAILED` em vez de tentar baixar lixo.

---

## Melhoria #4 — Endpoint público de status + alerta proativo

Adiciona endpoint `/session-status` que devolve quando a sessão foi
verificada OK por última vez. Permite monitoramento externo (Supabase pode
pingar isso a cada 5 min e alertar se ficou inválida).

### Novo arquivo `src/session-status.ts`

```typescript
import { smartSession } from './session.js';

export interface SessionStatus {
  ok: boolean;
  loggedInAt: number;
  lastKeepAliveAt: number;
  lastKeepAliveOk: boolean;
  ageMs: number;
  warnAt: number;       // quando começar a alertar (ex: 1h antes de timeout)
}

export function getSessionStatus(): SessionStatus {
  const now = Date.now();
  return {
    ok: smartSession.isLoggedIn(),  // adicionar este método em session.ts
    loggedInAt: smartSession.getLoggedInAt(),
    lastKeepAliveAt: smartSession.getLastKeepAliveAt(),
    lastKeepAliveOk: smartSession.getLastKeepAliveOk(),
    ageMs: now - smartSession.getLoggedInAt(),
    warnAt: 3 * 60 * 60 * 1000, // alertar se sessão tem mais de 3h
  };
}
```

### Em `src/index.ts`

```typescript
app.get('/session-status', (_req, res) => {
  res.json(getSessionStatus());
});
```

### Métodos novos em `session.ts`

```typescript
export class SmartSession {
  private lastKeepAliveAt = 0;
  private lastKeepAliveOk = false;

  isLoggedIn(): boolean {
    return this.loggedInAt > 0 && Date.now() - this.loggedInAt < config.SESSION_TTL_MS;
  }
  getLoggedInAt(): number { return this.loggedInAt; }
  getLastKeepAliveAt(): number { return this.lastKeepAliveAt; }
  getLastKeepAliveOk(): boolean { return this.lastKeepAliveOk; }

  // No final de runKeepAliveOnce, antes do finally:
  // this.lastKeepAliveAt = Date.now();
  // this.lastKeepAliveOk = true; // ou false em erro
}
```

---

## Alternativas estruturais (mais agressivas)

Se as melhorias acima não resolverem (caso #3 — timeout absoluto do Smart),
considere:

### A. Resolver CAPTCHA programaticamente

Usar serviço como **2captcha** ou **Anti-Captcha** (~US$ 1-3 / 1000 captchas).
No login, o worker submete o CAPTCHA ao serviço, recebe a solução em 10-30s
e usa pra logar. Permite re-login automático sem noVNC.

Custo: ~US$ 30/mês pra uma média de 10 re-logins/dia.

### B. Manter 2 contexts paralelos

Em vez de 1 context com keep-alive, manter 2 browser contexts:
- Context A: usado pra scrape (vai morrer eventualmente)
- Context B: hot standby, fica idle pingando keep-alive

Quando A morre, promove B pra "scraper" e cria novo B. Zero downtime.

### C. Pool de N robôs

Múltiplas contas-robô (5-10) revezando. Quando uma sessão morre, scrape vai
pra próxima do pool. Reduz prob. de downtime pra praticamente zero, mas
exige criar/manter múltiplas contas no Smart.

---

## Checklist de aplicação

- [ ] Rodar `session-monitor.sh` por 24h pra medir lifetime atual
- [ ] Aplicar Melhoria #1 (2 subdomínios + rotação)
- [ ] Aplicar Melhoria #2 (página de feature)
- [ ] Aplicar Melhoria #3 (detecção mais robusta)
- [ ] Re-rodar `session-monitor.sh` por 24h — comparar lifetime
- [ ] Se ainda problemático: Melhoria #4 + alertas
- [ ] Documentar lifetime médio observado em PRODUCTION.md
