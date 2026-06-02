# ⚠️ NÃO MAIS NECESSÁRIO — referência histórica

## Atualização (validado em 02/06/2026)

Descoberta importante feita após teste manual no portal Smart:

> **`Checks` na URL do boleto é literalmente o `id_titulo` + vírgula.**

Validação concreta:
- Título com `id_titulo=24960`, `documento=63-2`, sacado ODILA ALVES
- URL real do botão Boleto no portal: `?Checks=24960,&BoletoEmNome=r&...`

Por isso, **a edge function já calcula o `checks` sozinha** (`${id_titulo},`)
quando o cliente não passa explicitamente. Não há mais necessidade de o worker
navegar no portal pra descobrir.

A função `discoverChecks` descrita neste documento permanece como **referência
futura** caso descubramos casos onde `Checks != id_titulo` (ex: re-emissão de
boleto com novo ID interno, parcelas extras, etc).

---

## Conteúdo original (mantido pra referência)

## Contexto (histórico)

Pensávamos que o worker precisava descobrir `Checks` navegando no portal porque
não tínhamos ele no banco/API. Mas afinal, é só o próprio `id_titulo`.

Esse documento é um **rascunho pronto pra plugar SE for necessário no futuro**.
Ajustar os seletores do DOM real conforme o HTML do portal Smart (use
`playwright codegen` se precisar).

---

## Mudanças no payload da edge

A edge agora pode chamar o worker de 2 formas:

```json
// Forma 1 — quando já tem o checks (rápida)
{ "titulo_id": "83280", "tipo": "boleto", "extra": { "checks": "21467," } }

// Forma 2 — sem checks (worker descobre)
{ "titulo_id": "83280", "tipo": "boleto" }
```

Worker deve aceitar as duas. Se `extra.checks` vier, usa direto. Se não vier,
executa a função `discoverChecks` abaixo.

---

## Nova função sugerida: `src/discover.ts`

```typescript
import type { BrowserContext, Page } from 'playwright';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Descobre o `Checks` (ID interno do boleto no Smart) a partir do `titulo_id`.
 *
 * Estratégia:
 *   1. Abre uma página nova no context já logado
 *   2. Navega para a listagem de "Títulos em aberto"
 *   3. Filtra/pesquisa pelo titulo_id
 *   4. Localiza a linha resultante
 *   5. Extrai o parâmetro `Checks=...` da URL do botão "Boleto" daquela linha
 *
 * Retorna a string completa do Checks (ex: "21467,") ou null se não encontrar.
 */
export async function discoverChecks(
  context: BrowserContext,
  tituloId: string,
): Promise<string | null> {
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  try {
    // ----------------------------------------------------------------------
    // PONTO DE MANUTENÇÃO #1 — URL da listagem de títulos em aberto
    // ----------------------------------------------------------------------
    // Conforme seção 14 da documentação técnica:
    //   Financeiro > Contas a receber > Consultas e Relatórios > Títulos em aberto
    // Tente acessar direto pela URL deeplink, se o portal expuser. Caso
    // contrário, navegue via cliques.
    const LISTA_URL = `${config.SMART_PORTAL_URL}/smart/financeiro/cobranca/listartitulosaberto.php`;
    // (URL acima é placeholder — ajustar pra URL real)

    logger.debug({ tituloId, url: LISTA_URL }, 'discoverChecks: navegando para lista');
    const response = await page.goto(LISTA_URL, { waitUntil: 'domcontentloaded' });

    if (response && [401, 403].includes(response.status())) {
      throw Object.assign(new Error('Sessão expirada ao navegar pra lista'), {
        errorCode: 'LOGIN_FAILED',
      });
    }
    if (/\/login|loginsec/i.test(page.url())) {
      throw Object.assign(new Error('Redirecionado para login ao buscar checks'), {
        errorCode: 'LOGIN_FAILED',
      });
    }

    // ----------------------------------------------------------------------
    // PONTO DE MANUTENÇÃO #2 — Pesquisar pelo titulo_id
    // ----------------------------------------------------------------------
    // O portal tem campo "Pesquisar" (seção 14 da doc). Ajustar seletor.
    // Alternativa: scrollar até achar (lento) ou filtrar via querystring.
    try {
      await page.fill('input[name="pesquisar"], input[placeholder*="esquisa"]', tituloId);
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    } catch (err) {
      logger.warn({ err }, 'discoverChecks: falha ao filtrar — tentando localizar direto');
    }

    // ----------------------------------------------------------------------
    // PONTO DE MANUTENÇÃO #3 — Extrair o Checks do botão Boleto
    // ----------------------------------------------------------------------
    // O botão pode ser um <a href="...?Checks=NNNN,..."> OU um <span onclick="...">
    // ou similar. Estratégias em ordem de preferência:

    // 3a) Localiza a linha do título via data-attribute ou texto
    //     Exemplo: <tr data-id-titulo="83280">...</tr>
    const checks = await page.evaluate((targetId: string) => {
      // Tenta 3 padrões comuns:
      //   a) <tr data-id-titulo="...">
      //   b) <tr> cuja primeira célula = id
      //   c) qualquer botão/link cujo href contenha Checks= e o título no DOM próximo

      const rows = Array.from(document.querySelectorAll('tr'));
      const findRow = (): Element | null => {
        for (const tr of rows) {
          const dataId = (tr as HTMLElement).dataset?.idTitulo;
          if (dataId === targetId) return tr;
          // Heurística: alguma célula contém exatamente o ID
          for (const td of Array.from(tr.querySelectorAll('td'))) {
            if (td.textContent?.trim() === targetId) return tr;
          }
        }
        return null;
      };

      const row = findRow();
      if (!row) return null;

      // Procura href com Checks=
      const anchors = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href*="Checks="]'));
      for (const a of anchors) {
        const m = a.href.match(/[?&]Checks=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
      }

      // Procura onclick com Checks=
      const clickables = Array.from(row.querySelectorAll<HTMLElement>('[onclick]'));
      for (const el of clickables) {
        const onclick = el.getAttribute('onclick') || '';
        const m = onclick.match(/Checks=([^&'"\\s]+)/);
        if (m) return m[1];
      }

      return null;
    }, tituloId);

    if (!checks) {
      logger.warn({ tituloId }, 'discoverChecks: Checks não encontrado no DOM');
      return null;
    }

    logger.info({ tituloId, checks }, 'discoverChecks: Checks descoberto');
    return checks;
  } catch (err) {
    const code = (err as { errorCode?: string })?.errorCode;
    if (code === 'LOGIN_FAILED') throw err;
    logger.warn({ err, tituloId }, 'discoverChecks: erro durante descoberta');
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}
```

---

## Integração no `downloadBoleto`

No `src/scraper.ts`, ajuste a função `downloadBoleto` pra usar `discoverChecks`
quando `extra.checks` não vier:

```typescript
import { discoverChecks } from './discover.js';
import { smartSession } from './session.js';

async function downloadBoleto(page: Page, payload: ScrapePayload): Promise<Buffer> {
  let checks =
    typeof payload.extra?.checks === 'string' ? payload.extra.checks : null;

  // NOVO: descobre on-demand se não veio
  if (!checks) {
    const context = await smartSession.getContext();
    const discovered = await discoverChecks(context, String(payload.titulo_id));
    if (!discovered) {
      throw Object.assign(
        new Error(
          'extra.checks ausente e descoberta falhou. Verifique se o titulo existe no portal.',
        ),
        { errorCode: 'EXTRA_CHECKS_REQUIRED' },
      );
    }
    checks = discovered;
  }

  // Daqui pra baixo é o código atual de download usando `checks`.
  const boletoUrl =
    `https://wvw.smartsecurities.com.br/smart/financeiro/cobranca/printcobrancapdf.php` +
    `?Checks=${encodeURIComponent(checks)}` +
    `&BoletoEmNome=r&boleto=1&hckJuros=1&ckEncargosProrrogacao=1`;

  // ... resto igual ao patch atual
}
```

E adicione `EXTRA_CHECKS_REQUIRED` ao type union de `ScrapeErrorCode`:

```typescript
export type ScrapeErrorCode =
  | 'TITULO_NAO_ENCONTRADO'
  | 'LOGIN_FAILED'
  | 'TIMEOUT'
  | 'PORTAL_OFFLINE'
  | 'PDF_INVALID'
  | 'EXTRA_CHECKS_REQUIRED'   // ← novo
  | 'INTERNAL_ERROR';
```

E ajuste `scrape()` (no mesmo `scraper.ts`) pra tratar esse código também:

```typescript
const code: ScrapeErrorCode = (e as { errorCode?: ScrapeErrorCode })?.errorCode ?? 'INTERNAL_ERROR';
// ... no mapeamento de erros, adicionar:
if (code === 'EXTRA_CHECKS_REQUIRED') return err(code, msg, 400);
```

---

## Cache de Checks descobertos (opcional, melhoria futura)

Pra evitar redescobrir toda vez, o worker pode manter um Map em memória:

```typescript
const checksCache = new Map<string, { value: string; at: number }>();
const CHECKS_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// dentro de downloadBoleto, antes de chamar discoverChecks:
const cached = checksCache.get(String(payload.titulo_id));
if (cached && Date.now() - cached.at < CHECKS_TTL_MS) {
  checks = cached.value;
}
// depois de descobrir:
checksCache.set(String(payload.titulo_id), { value: discovered, at: Date.now() });
```

Não persiste entre restarts mas economiza muito durante a vida do processo.

---

## Como testar

### Localmente

```bash
# Antes:
curl -X POST http://localhost:4000/scrape \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo_id":"83280","tipo":"boleto","extra":{"checks":"21467,"}}'

# Depois (deve funcionar sem checks):
curl -X POST http://localhost:4000/scrape \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo_id":"83280","tipo":"boleto"}'
```

Resposta esperada: mesma de antes (success + pdf_base64).

### Em produção

Quando o patch tiver no ar:
1. Abrir `/test-smart-scraper` no app
2. Clicar "Disparar boleto (raw)" SEM precisar digitar checks no diálogo
3. Deve devolver `success: true` em ~10-15s (descoberta + download)

Se algo der errado, o worker devolve `EXTRA_CHECKS_REQUIRED` e a UI cai
automaticamente no fallback de digitação manual.

---

## Riscos / coisas a ficar de olho

1. **Performance**: descoberta adiciona ~3-5s por scrape (extra navegação).
   Cache em memória mitiga.

2. **Múltiplos boletos por título**: se o título tem mais de um boleto
   (re-emissão), a função retorna o primeiro do DOM. Pode não ser o "atual".
   Solução: filtrar pelo "Boleto em aberto" se a UI distinguir.

3. **Mudança de UI do Smart**: 3 pontos de manutenção marcados, todos
   precisam ser atualizados se o portal mudar.

4. **Sessão expirada durante descoberta**: já está tratado — throw LOGIN_FAILED
   propaga normalmente.
