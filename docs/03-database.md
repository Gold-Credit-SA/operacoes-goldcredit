# Banco de dados

## Schema interno (Supabase atual → seu Postgres)

### Auth
- `auth.users` (gerenciado pelo Supabase; replicar com `id uuid`, `email`, `encrypted_password`, `email_confirmed_at`, `created_at`).
- `public.profiles` — 1:1 com `auth.users` (`id`, `nome`, `email`, `telefone`, `tipo`, `must_change_password`, `created_by`, `avatar_url`).
- `public.user_roles` — `(user_id, role)` UNIQUE. Enum `app_role`: `admin | master | gestor | analista | user`.
- Função `has_role(_user_id uuid, _role app_role) returns boolean` SQL stable + SECURITY DEFINER.

### Consultas externas
- `consulta_clients` — cadastro centralizado por CPF/CNPJ (`document`, `name`, `type pf|pj`).
- `consulta_history` — todo log de consulta (Serasa/SCR/AgRisk/Smart): `id, user_id, client_id, platform, consulta_type, status, request, response, error_message, created_at`.
- `scr_query_jobs` — `uuid_query`, `document`, `raw_response`, `lsdtb`, `base_date`, `created_at` (permite reprocessar sem custo).
- `agrisk_clients` — mapping CPF/CNPJ → `clientId` AgRisk.
- `agrisk_queries` — `clientId`, `queryId`, `productKey`, `response` (para reuso).
- `integration_logs` — telemetria: `trace_id`, `provider`, `step`, `latency_ms`, `http_status`, `attempts`, `request`, `response`, `error_class`, `created_at`.
- `integration_cache` — `key` (hash), `provider`, `value` jsonb, `expires_at`.

### Carteira/portfólio
- `portfolio_assignments` — `user_id`, `cedente_cpf_cnpj`, `status (pending|approved|rejected)`, `rejection_reason`, `approved_by`, `created_at`.
- `notes` — anotações livres por entidade.

### Documentos / assinatura
- `documentos` — contratos enviados.
- `assinaturas` — log de assinatura, signatário, hash certificado.
- `nfe_monitoramento` — chaves push SERPRO.
- `nfe_eventos` — eventos recebidos do webhook SERPRO.

### Análise de crédito
- `analyses` — análises geradas (cliente, operação).
- `analysis_documents` — docs anexados (com hash para dedupe).
- `credit_analysis_chats` — conversas com IA.

### E-mail
- `email_queue` — `id, queue_name (auth_emails|transactional_emails), payload jsonb, status, retries, scheduled_at`.
- `email_dead_letters`.
- `email_suppressions` — `email, reason (bounce|complaint|unsubscribe), created_at`.
- `email_unsubscribes` — tokens RFC 8058.
- `email_settings` — TTLs e tamanho de batch.

### Settings
- `goldsign_settings` — config da empresa para assinatura.
- `app_settings` — chave/valor genérico.

---

## Schema externo (`smartsecurities_*` — read-only)

Espelho do ERP. Tabelas:

- `smartsecurities_cedentes` — cadastro principal.
- `smartsecurities_operacoes_individualizadas` — operações.
- `smartsecurities_titulos_em_aberto`
- `smartsecurities_titulos_quitados`
- `smartsecurities_titulos_quitados_suspeita_fraude`
- `smartsecurities_titulos_prorrogados`
- `smartsecurities_titulos_recomprados`
- `smartsecurities_titulos_devolvidos` — coluna `tipo` (filtrar `'CHQ'` para cheques).
- `smartsecurities_receita_por_cedente`
- `smartsecurities_aniversariantes`
- `smartsecurities_socios_*`

> Use `external-db` action `describe-table` para descobrir colunas exatas em ambiente.

---

## Migração prática

1. Dump do schema interno via `pg_dump --schema-only` direto do Postgres do Supabase (`SUPABASE_DB_URL`).
2. Restaurar em novo Postgres.
3. Reescrever RLS como middleware (Express, Fastify etc.) que valida JWT e aplica `has_role()` antes das queries.
4. Manter conexão de leitura ao ERP externo intacta.
5. Apontar frontend para o novo backend trocando o cliente Supabase por `fetch` simples.
