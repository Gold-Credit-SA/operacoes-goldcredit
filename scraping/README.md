# Smart Scraper — sistema completo

Solução tática para baixar PDF de boleto e nota fiscal do portal Smart
Securities, já que a API v2 oficial não expõe esses arquivos por título.

> Quando a Smart liberar `/titulo/:id/boleto` na API v2 oficial, basta
> alternar a flag `cobranca_settings.smart_pdf_source` de `'scraper'` para
> `'official'` e desligar o worker. Nada precisa ser refatorado no frontend.

---

## Visão geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│  App Lovable (React)                                                     │
│  supabase.functions.invoke("smart-scraper", { titulo_id, tipo })         │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge Function "smart-scraper" (Supabase / Deno)                         │
│                                                                          │
│  1. valida JWT do usuário                                                │
│  2. lê feature flag cobranca_settings.smart_pdf_source                   │
│  3. resolve título no Postgres externo (nosso_numero, documento, ...)    │
│  4. checa cache em smart_anexos_cache                                    │
│     ├─ HIT  → retorna signed URL                                         │
│     └─ MISS → segue                                                       │
│  5. POST https://<vps>/scrape  com Bearer SMART_SCRAPER_TOKEN            │
│  6. valida bytes do PDF (magic %PDF-)                                     │
│  7. upload no bucket smart-anexos (private)                              │
│  8. upsert smart_anexos_cache + cria signed URL (7d)                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Worker VPS (Node + Express + Playwright + PM2)                          │
│  – mantém sessão chromium logada no portal Smart                         │
│  – fila com concorrência 2-3 + dedup in-flight                           │
│  – navega na rota do título, baixa PDF, devolve base64                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  pg_cron → Edge Function "smart-scraper-prefetch"                        │
│  – roda 1x/dia, identifica títulos que a régua vai cobrar em até 24h     │
│  – pré-popula o cache, registra em smart_scraper_prefetch_jobs           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  pg_cron diário → DELETE de smart_anexos_cache expirado                  │
│  (limpeza física do bucket: TODO via edge function manual)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Decisões arquiteturais

Discutidas e fechadas em 01/06/2026:

| # | Tópico | Decisão |
|---|---|---|
| 1 | Sync vs async | **Pre-fetch via cron + síncrono com fila/lock como fallback** |
| 2 | Mapeamento `titulo_id` | **Edge resolve** via `smartsecurities_titulos_*`; worker é burro |
| 3 | Upload do PDF | **Worker devolve base64 → edge sobe** com service_role |
| 4 | Cache TTL | **Boleto 6h ou invalida por evento** (source_updated_at); **NF 30d** |

Outros (heads-up que ficaram pra depois):

- Feature flag `cobranca_settings.smart_pdf_source` permite alternar entre
  scraper/official/disabled sem deploy de código.
- Dedup in-flight no nível do worker (queue.ts). Para dedup distribuído
  edge-side, futuramente usar `pg_advisory_lock`.
- 2FA no portal Smart vai quebrar login — `LOGIN_FAILED` é retornado, basta
  monitorar.
- VPS recomendada: 4 GB RAM mínimo (chromium pesa).

---

## Componentes neste repositório

### 1. Worker VPS — `scraping/worker/`

Stack: Node 20 + Express + Playwright + pino + p-queue + PM2.

- `src/index.ts` — bootstrap Express, rotas `/health` e `/scrape`
- `src/scraper.ts` — Playwright navega e baixa PDF (4 pontos de manutenção
  marcados pra ajustar quando o portal mudar)
- `src/session.ts` — gestão da sessão Smart, relogin automático, storage
  state persistido em disco
- `src/queue.ts` — fila p-queue com dedup in-flight
- `src/validator.ts` — checagem de magic bytes do PDF
- `src/auth.ts` — middleware Bearer com comparação constant-time
- `nginx.conf.example` + `ecosystem.config.cjs` — deploy
- `README.md` — guia completo de setup e manutenção

### 2. Lado Supabase — `supabase/functions/` e `supabase/migrations/`

- **Migration** `supabase/migrations/20260602112628_3a5442c2-a202-4da3-a744-7756ee810890.sql`
  - cria tabela `smart_anexos_cache`
  - cria tabela de auditoria `smart_scraper_prefetch_jobs`
  - cria bucket privado `smart-anexos` (10 MB, `application/pdf` apenas)
  - adiciona coluna `smart_pdf_source` em `cobranca_settings`
  - agenda pg_cron para purge diário de registros expirados
  - cria função `smart_anexos_invalidate(titulo_id, tipo)`
  - cria view `smart_anexos_stats`

- **Edge function** `supabase/functions/smart-scraper/index.ts`
  - endpoint principal — recebe `{titulo_id, tipo, force_refresh?}`,
    devolve `{signed_url, expires_at, from_cache}`
  - usa CORS + JWT auth + feature flag
  - chama worker com timeout 90s

- **Edge function** `supabase/functions/smart-scraper-prefetch/index.ts`
  - chamada por pg_cron / serviço externo de scheduling
  - identifica títulos a serem cobrados em 24h
  - invoca `smart-scraper` em série respeitando rate limit
  - grava resultado em `smart_scraper_prefetch_jobs`

---

## Como rodar tudo

### A) Subir o worker (VPS)

Ver `scraping/worker/README.md` — passo a passo de Ubuntu 22.04 com PM2,
Nginx e Let's Encrypt.

### B) Aplicar a migration

```bash
# Local (dev):
supabase db reset           # se ambiente limpo
# OU
supabase migration up

# Remote:
supabase db push
```

### C) Configurar secrets das edge functions

```bash
supabase secrets set SMART_SCRAPER_URL=https://scraper.goldcreditcapital.com.br
supabase secrets set SMART_SCRAPER_TOKEN=<mesmo WORKER_TOKEN do .env da VPS>
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
# EXTERNAL_DB_* já devem estar configurados (usados pela external-db).
```

### D) Deploy das edge functions

```bash
supabase functions deploy smart-scraper
supabase functions deploy smart-scraper-prefetch
```

### E) Agendar pre-fetch no pg_cron

Execute uma única vez no SQL editor do Supabase:

```sql
select cron.schedule(
  'smart-scraper-prefetch-daily',
  '0 9 * * *',     -- 09:00 UTC = 06:00 BRT
  $$
  select net.http_post(
    url     := 'https://<seu-projeto>.supabase.co/functions/v1/smart-scraper-prefetch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

> Lembre de `set app.cron_secret = '<o mesmo CRON_SECRET>'` no banco.

---

## Como o frontend usa

```ts
import { supabase } from "@/integrations/supabase/client";

async function getBoletoUrl(tituloId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("smart-scraper", {
    body: { titulo_id: tituloId, tipo: "boleto" },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.message ?? "Erro ao obter boleto");
  return data.signed_url;
}
```

Para a régua, ela continua usando `{{link_boleto}}` no template, mas a
implementação que resolve o template chama essa função (ou pega do cache
já populado pelo pre-fetch).

---

## Monitoramento sugerido

- Edge logs do `smart-scraper` (Supabase dashboard) — error_code agregado
- `/health` do worker (Uptime Robot ou similar)
- `select * from smart_anexos_stats` — hit rate por tipo
- `select status, count(*) from smart_scraper_prefetch_jobs where scheduled_for >= current_date group by status`

---

## Próximas melhorias (não cobertas no MVP)

- [ ] Cleanup físico do bucket via edge function disparada pelo mesmo cron
- [ ] Dedup distribuído edge-side com `pg_advisory_lock`
- [ ] Hash do PDF pra detectar mudança sem re-upload
- [ ] Métricas em tabela `integration_logs` (já existe no repo)
- [ ] Implementar branch `'official'` quando Smart liberar a API v2
- [ ] Suporte TOTP no worker pra resistir a 2FA do portal
