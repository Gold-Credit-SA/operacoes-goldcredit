# Overview — GoldCredit Operações

Documento de referência para reconstruir todo o backend desta plataforma em um servidor isolado (Node, Go, Python etc.), **sem depender das Edge Functions do Supabase / Lovable Cloud**.

> Leia em ordem: `00-overview.md` → `01-integracoes.md` → `02-endpoints.md` → `03-database.md`.

---

## 1. Arquitetura atual

```
┌──────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│  Frontend    │ ──────► │ Supabase Edge Funcs  │ ──────► │ APIs externas        │
│  React/Vite  │         │ (Deno + TS)          │         │ Serasa, HBI, AgRisk, │
│              │         │ + Postgres interno   │         │ SERPRO, GoldSign,    │
│              │         │ + Postgres externo   │         │ Lovable AI Gateway   │
└──────────────┘         └──────────────────────┘         └──────────────────────┘
```

Dois bancos PostgreSQL distintos:

| Banco                  | Função                                                              |
|------------------------|---------------------------------------------------------------------|
| **Interno (Supabase)** | Auth, perfis, roles, jobs, cache, logs, histórico de consultas, anotações, carteiras de gestores, fila de e-mails. |
| **Externo (`smartsecurities_*`)** | Espelho do ERP de securitização. Cedentes, operações, títulos em aberto/quitados, devolvidos, receitas, sacados, sócios. **Apenas leitura.** |

Para recriar o backend, o servidor precisa ter:

1. Conexão ao Postgres do Supabase (ou a um equivalente — basta migrar o schema, ver `03-database.md`).
2. Conexão ao Postgres externo do ERP (`smartsecurities_*`).
3. Credenciais das APIs externas (ver `01-integracoes.md`).
4. Implementação dos endpoints HTTP descritos em `02-endpoints.md` (mesmo contrato JSON).

---

## 2. Stack atual (a substituir)

- **Runtime**: Deno 1.x (Edge Functions)
- **Drivers**:
  - `postgresjs@3.4.4` e `deno-postgres@0.17` → equivalentes Node: `postgres`, `pg`.
  - `@supabase/supabase-js@2` → no backend isolado vira chamadas SQL diretas + JWT/Auth próprio.
- **Helpers compartilhados em `supabase/functions/_shared/`** — todos precisam ser reescritos:
  - `cors.ts` — cabeçalhos CORS (`Access-Control-Allow-Origin: *`).
  - `http-client.ts` — `fetch` com timeout, retry exponencial (só em 5xx) e telemetria.
  - `error-classifier.ts` — classifica erros (network_error, provider_error, validation_error).
  - `validators.ts` — CPF, CNPJ, data-base SCR `YYYY-MM`.
  - `idempotency.ts` — SHA-256 das partes da requisição para dedupe em janela curta.
  - `cache.ts` — leitura/escrita em `integration_cache` (TTL).
  - `logger.ts` — grava em `integration_logs` com `trace_id`.
  - `hbi-client.ts` — cliente HBI/SCR completo (auth, polling, formato Bacen).
  - `formatters/scr-bacen-to-lsdtb.ts` — converte payload Bacen cru → `lsDtb` consumido pelo front.

---

## 3. Princípios obrigatórios

1. **Idempotência em consultas pagas** (SCR, Serasa, AgRisk): hash da entrada + janela de 30 s para evitar cobrança dupla por duplo clique.
2. **Cache TTL** por consulta paga (SCR: 6 h; Serasa Avançado: 24 h; AgRisk: reutiliza `queryId` existente).
3. **Logging em `integration_logs`** com `trace_id` correlacionando autenticação → consulta → polling → resultado.
4. **HTTP 200 mesmo em erro de negócio** (frontend trata pelo campo `ok`/`error` do JSON). Só usar 4xx/5xx para falhas técnicas.
5. **Validação antes da chamada paga** (CPF/CNPJ válido, data-base aceita).
6. **Sem retry em chamadas pagas** (`POST /query/scr/v2/new`, criação de query AgRisk, etc.). Retry apenas em GETs e auth.
7. **Datas no payload Bacen vêm em centavos / sem divisão**: NÃO dividir por 100 (`smartsecurities_*` e SCR retornam BRL inteiro).
8. **Roles** (`admin`, `master`, `gestor`, `analista`) ficam em **tabela própria** `user_roles` + função `has_role()` Security Definer. Nunca em `profiles`.

---

## 4. Variáveis de ambiente (todas)

| Variável                          | Onde usada                              | Descrição                                            |
|-----------------------------------|-----------------------------------------|------------------------------------------------------|
| `SUPABASE_URL`                    | Quase todas                              | Base do projeto Supabase atual.                      |
| `SUPABASE_ANON_KEY`               | Funções que validam JWT do usuário       | Chave pública.                                       |
| `SUPABASE_SERVICE_ROLE_KEY`       | Quase todas as funções admin             | Bypassa RLS. Tratar como senha.                      |
| `SUPABASE_DB_URL`                 | `cedente-info`, `process-sql`            | Connection string Postgres do Supabase.              |
| `EXTERNAL_DB_HOST/PORT/USER/PASS/NAME` | `external-db`, `portfolio-data`, `giro-carteira`, `dashboard-data`, `cedente-info` | Postgres do ERP (`smartsecurities_*`). |
| `LOVABLE_API_KEY`                 | `analyze-*`, `credit-analysis-chat`, e-mails | AI Gateway Lovable (rota OpenAI/Gemini).            |
| `LOVABLE_SEND_URL`                | `send-transactional-email`               | Endpoint de envio Lovable Email.                     |
| `SERASA_CLIENT_ID/SECRET`         | `serasa-report`                          | OAuth2 client credentials Serasa Experian.           |
| `SERASA_API_URL`                  | `serasa-report`                          | Default: `https://uat-api.serasaexperian.com.br`.    |
| `SERASA_COST_CENTER`              | `serasa-report`                          | Centro de custo da conta.                            |
| `SERASA_RETAILER_DOCUMENT`        | `serasa-report`                          | CNPJ do varejista (parâmetro obrigatório Serasa).    |
| `HBI_API_URL`                     | `_shared/hbi-client.ts`                  | Base HBI (SCR).                                      |
| `HBI_CLIENT_ID/SECRET/GRANT_TYPE/SCOPE` | idem                              | OAuth HBI.                                           |
| `HBI_UUID_TYPE_SCR_AVULSA/COMPARATIVO/DETALHADA` | `hbi-scr`                | Fallback se `/form/type/scr` falhar.                 |
| `AGRISK_CREDENTIAL/PASSWORD`      | `agrisk-query`                           | Login API AgRisk.                                    |
| `SERPRO_CONSUMER_KEY/SECRET`      | `serpro-nfe`                             | OAuth SERPRO NF-e.                                   |
| `GOLDSIGN_BACKEND_URL`            | `goldsign-proxy`                         | Default: `https://goldsign.onrender.com`.            |
| `AUDIT_API_KEY`                   | `audit-consultas`                        | Bearer fixo para clientes externos da auditoria.     |
| `DOCS_API_KEY`                    | (registry interno)                       | Auth do `endpoints-registry`.                        |

---

## 5. Como migrar (resumo)

1. **Provisionar 2 Postgres**: um para auth/app (substitui Supabase), um para o ERP (mantém o externo atual em modo readonly).
2. **Migrar schema interno** a partir do dump do Supabase (RLS pode ser descartada se sua app fizer authz no servidor).
3. **Implementar autenticação JWT** própria (ou OIDC). O front espera `Authorization: Bearer <jwt>` e um claim `sub` com `user_id`.
4. **Reescrever cada Edge Function como rota HTTP** no novo backend — todas seguem o padrão `POST /<func> { action, ...params }` exceto as REST descritas em `02-endpoints.md`.
5. **Provisionar todas as variáveis de ambiente** acima.
6. **Reapontar o frontend** trocando `supabase.functions.invoke('xxx', { body })` por `fetch('/api/xxx', { method: 'POST', body })` — o contrato JSON é idêntico.
