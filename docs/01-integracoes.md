# Integrações Externas

Cada integração descrita aqui contém: **autenticação, endpoints chamados, fluxo, observações e referências de código**.

---

## 1. Banco de dados externo (ERP `smartsecurities_*`)

- **Driver**: Postgres puro. Hoje usamos `postgresjs` (Deno) e `deno-postgres`. Em Node, use `postgres` ou `pg`.
- **Conexão** (variáveis de ambiente):
  ```
  postgres://${EXTERNAL_DB_USER}:${EXTERNAL_DB_PASS}@${EXTERNAL_DB_HOST}:${EXTERNAL_DB_PORT}/${EXTERNAL_DB_NAME}
  ```
- **Conexão por requisição** (serverless-safe; *não* manter pool ocioso longo).
- **Prefixo de tabelas**: `smartsecurities_`. Apenas leitura.
- **Tabelas usadas** (lista canônica):
  - `smartsecurities_cedentes` — cadastro de cedentes (cpf_cnpj, nome, gerente, limite, risco, status).
  - `smartsecurities_operacoes_individualizadas` — operações de fomento.
  - `smartsecurities_titulos_em_aberto` — títulos pendentes.
  - `smartsecurities_titulos_quitados` — histórico.
  - `smartsecurities_titulos_quitados_suspeita_fraude` — alertas de fraude (vermelho no UI).
  - `smartsecurities_titulos_prorrogados`.
  - `smartsecurities_titulos_recomprados`.
  - `smartsecurities_titulos_devolvidos` — cheques devolvidos (filtrar `tipo='CHQ'`).
  - `smartsecurities_receita_por_cedente`.
  - `smartsecurities_aniversariantes`.
  - `smartsecurities_socios_*` (sócios por cedente).

> **NUNCA dividir valores por 100**. O ERP grava BRL inteiro.

---

## 2. Serasa Experian (PF e PJ)

- **Auth**: OAuth2 client_credentials.
  ```
  POST ${SERASA_API_URL}/security/iam/v1/client-identities/login
  Headers: Authorization: Basic base64(client_id:client_secret)
  Body:    grant_type=client_credentials
  → { access_token, expires_in }
  ```
- **Endpoints PF**:
  - Cadastral PF: `POST /credit-services/person-information-report/v1/creditreport`
  - Avançado PF (com score HRLD): `POST /credit-services/person-credit-report/v1/creditreport`
- **Endpoints PJ (PME)**:
  - Cadastral PJ: `POST /credit-services/company-information-report/v1/creditreport`
  - Analítico PJ (parsing bloco ACPH segmento 028): `POST /credit-services/company-credit-report/v1/creditreport`
- **Parâmetros obrigatórios** no body:
  ```json
  {
    "reportName": "<NomeDoRelatorioConformeContrato>",
    "documentId": "<CPF/CNPJ só dígitos>",
    "optionalFeatures": ["SCORE"] ,  // omitir no analítico PJ
    "consumer": { "costCenter": "${SERASA_COST_CENTER}" },
    "retailer": { "documentId": "${SERASA_RETAILER_DOCUMENT}" }
  }
  ```
- **Tratamento "NADA CONSTA"**: marcação judicial → exibir como alerta vermelho.
- **Parsing**: ver `src/components/analise-operacao/serasa/SerasaDetailView.tsx`. Normalizar `defaultRate`, QSA, limite, datas em múltiplos formatos (campos vêm em paths diferentes por tipo de relatório).

---

## 3. HBI / SCR (Bacen)

Cliente completo em `supabase/functions/_shared/hbi-client.ts`.

Fluxo obrigatório (ordem):

1. `POST ${HBI_API_URL}/authentication/login` → JWT.
   ```json
   { "client_id":"...", "client_secret":"...", "grant_type":"...", "scope":"..." }
   Header: user: be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4
   ```
2. `GET /form/type/scr` → lista de `uuidTypeScr` (AVULSA, COMPARATIVO, DETALHADA). Hardcodear é frágil — sempre buscar; usar env como fallback.
3. `GET /company/scr/scrDataBase` → `baseDateInitial` sugerida (mês mais recente válido).
4. `POST /query/scr/v2/new/{documentId}` ← **única chamada PAGA. NUNCA retry.**
   ```json
   { "baseDateInitial":"YYYY-MM", "uuidTypeScr":"<uuid>" }
   ```
5. Polling `GET /query/list/v2?service=SCR&q={doc}` até `status.title == "Concluído"` (12 tentativas × 2.5 s).
6. `GET /query/bacen/{uuidQuery}` → payload Bacen cru → converter via `formatters/scr-bacen-to-lsdtb.ts`.
7. Persistir `uuidQuery` + `rawResponse` em `scr_query_jobs` para reprocessar sem nova chamada paga.

**Regras de classificação SCR**: padrão Resolução 2.682; versão `v20` para datas ≤ 15 dias, `v10` para > 15 dias. Selecionar mês mais recente com operações válidas.

**Limites do SCR**: "Vencido" no campo de limite = linha **expirada**, não saldo devedor.

---

## 4. AgRisk

- **Base**: `https://api.agrisk.digital`
- **Auth**: `POST /login { credential, password }` → token.
- **Endpoints usados**:
  - `GET /v2/products` — lista produtos disponíveis (CPR, Compliance, Lawsuits, KYC, etc.).
  - `POST /clients` — cadastra cliente (CPF/CNPJ). **Gratuito.**
  - `POST /queries` — dispara consulta paga. **NUNCA retry.**
  - `GET /queries/clients/{clientId}` — detalhes consolidados.
  - `GET /queries/clients/{clientId}/compliance` — fallback compliance.
  - `GET /queries/clients/{clientId}/lawsuits/{lawsuitId}` — processo detalhado.
  - `GET /queries/clients/{clientId}/cpr-details/{cprId}` — CPRs.
  - `GET /assets/properties/rural/{propertyId}` — propriedades rurais.
  - `GET /v2/queries/clients/{clientId}` — versão 2.
  - `GET /v2/queries/clients/cars/{carId}` — CAR.
- **Deduplicação**: checar 10 páginas em `/clients` antes de cadastrar, para reutilizar `clientId` existente.
- **Economia**: se `queryId` já existe para o cliente, reutilizar via `fetch-existing-details` em vez de criar nova query.
- **Polling máximo**: 25 s. Validar dados não-vazios antes de gravar.
- **Normalização**: aceita estruturas legacy aninhadas e flat (ver `src/components/agrisk/`).

---

## 5. SERPRO NF-e

- **Base**: `https://gateway.apiserpro.serpro.gov.br`
- **Auth**: OAuth2 client_credentials com `SERPRO_CONSUMER_KEY/SECRET` (Basic base64).
- **Endpoints**:
  - `GET /nfe/{chave44}` — consulta NF-e.
  - `GET/POST/PUT /nfe/push/clientes { urlNotificacao }` — registra/atualiza webhook.
  - `GET /nfe/push/solicitacoes` — lista monitoramentos.
  - `POST /nfe/push/solicitacoes { chavesMonitoracao:[...] }` — adiciona chaves.
- **Webhook recebido**: payload via `action=webhook` → grava em `nfe_eventos` e dispara e-mail transacional.

---

## 6. GoldSign (assinatura digital ICP-Brasil)

- **Backend**: `https://goldsign.onrender.com` (ou `GOLDSIGN_BACKEND_URL`).
- **Edge function `goldsign-proxy`**: proxy puro com retry para mitigar cold start do Render. Aceita `?target=<path>` e repassa método/headers/body.
- **Função**: validação de certificado ICP-Brasil contra o signatário esperado (CPF do signee == CPF do certificado).
- **Workflow multi-doc**: contrato + aditivo (pag. 2 reservada) + solidária automática.

---

## 7. Lovable AI Gateway (modelos)

- Endpoint genérico para chat completions, compatível com formato OpenAI.
- Header: `Authorization: Bearer ${LOVABLE_API_KEY}`.
- Modelo padrão para análise: `openai/gpt-4o`.
- **Sempre injetar a data atual no system prompt** (modelos não têm noção de tempo).
- Funções usuárias: `analyze-document`, `analyze-cedente`, `analyze-client-summary`, `analyze-credit-operation`, `credit-analysis-chat`.

---

## 8. Lovable Email / SMTP

- Envio: `send-transactional-email` enfileira em `transactional_emails` (tabela `email_queue`).
- Consumidor: `process-email-queue` (cron) processa `auth_emails` primeiro, depois `transactional_emails`.
- Suppression: `handle-email-suppression` recebe bounces/complaints/unsubscribes via HMAC assinado com `LOVABLE_API_KEY`.
- Templates: `supabase/functions/_shared/transactional-email-templates/` (JSX).

Para migrar: usar Resend / SES / Mailgun direto. Preservar tabelas `email_queue`, `email_suppressions`, `email_unsubscribes`.

---

## 9. Supabase Auth → JWT próprio

Caso queira sair do Supabase Auth, replique:

- Tabela `auth.users` mínima: `id (uuid)`, `email`, `encrypted_password (bcrypt)`, `created_at`, `email_confirmed_at`.
- Tabela `public.profiles`: `id (= auth.users.id)`, `nome`, `telefone`, `tipo`, `must_change_password`, `created_by`.
- Tabela `public.user_roles`: `user_id`, `role enum('admin','master','gestor','analista','user')`.
- Função `has_role(user_id uuid, role app_role) returns boolean` (SQL stable + security definer).
- Master admin: `renan@goldcreditsa.com.br` / `admin123` — cria todos os usuários, sem self-registration.
- Primeiro login: `must_change_password=true` força tela `/change-password` → endpoint `complete-initial-password-change` valida senha contra HIBP.
