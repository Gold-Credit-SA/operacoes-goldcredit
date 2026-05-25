# Endpoints

Todos seguem o padrão `POST /<nome-da-função>` com body JSON `{ "action": "<nome>", ...params }`, exceto onde explicitado (REST puro).

Headers comuns:
```
Content-Type: application/json
Authorization: Bearer <JWT do usuário>      # exceto webhooks/públicos
```

> **Padrão de resposta de erro**: HTTP **200** com `{ "success": false, "error": "..." }` para erros de negócio.
> Use `4xx/5xx` apenas para falhas técnicas reais.

---

## 1. `external-db` — Leitura do ERP

Conecta ao Postgres externo. Actions:

| Action                       | Params                                       | Retorno                                                |
|------------------------------|----------------------------------------------|--------------------------------------------------------|
| `test-connection`            | —                                            | `{ ok, latency_ms }`                                   |
| `count-cheques-devolvidos`   | `{ filters? }`                               | `{ total }`                                            |
| `list-tables`                | —                                            | `string[]` (tabelas `smartsecurities_*`)               |
| `describe-table`             | `{ filters:{ table } }`                      | `[{ column, type, nullable }]`                         |
| `cedentes-list`              | `{ filters:{ search?, limit?, offset? } }`   | `Cedente[]`                                            |
| `cedente-info`               | `{ filters:{ cpf_cnpj } }`                   | dados completos + operações + títulos                  |
| `stats`                      | —                                            | contagens de todas as tabelas                          |
| `operacoes`                  | `{ filters }`                                | operações individualizadas                             |
| `receitas`                   | `{ filters }`                                | receita por cedente                                    |
| `titulos-aberto`             | `{ filters }`                                | títulos em aberto                                      |
| `cedentes-detalhes`          | `{ filters }`                                | join cedentes + métricas                               |
| `resumo-por-periodo`         | `{ filters:{ from, to } }`                   | volumes agregados                                      |
| `top-cedentes`               | `{ filters:{ limit? } }`                     | ranking por volume                                     |
| `sacados-list`               | `{ filters }`                                | lista sacados                                          |
| `sacado-detail`              | `{ filters:{ cpf_cnpj } }`                   | detalhes sacado                                        |
| `socios-por-cedente`         | `{ filters:{ cpf_cnpj_cedente } }`           | sócios (QSA)                                           |

---

## 2. `dashboard-data` — Dashboard interno

Mesmas actions de leitura (`stats`, `cedentes-list`, `operacoes`, `receitas`, `titulos-aberto`, `titulos-quitados`, `cedentes-detalhes`, `resumo-por-periodo`, `top-cedentes`) mas servidas via Supabase (cache local).

---

## 3. `portfolio-data` — Carteira por gestor

| Action                       | Params                                                                 | Descrição                                          |
|------------------------------|-----------------------------------------------------------------------|----------------------------------------------------|
| `list-assignments`           | `{ status? }`                                                          | Lista vínculos gestor↔cedente.                     |
| `request-assignment`         | `{ user_id, cedente_cpf_cnpj }`                                        | Solicita vínculo (pending).                        |
| `approve-assignment`         | `{ assignment_id }`                                                    | Admin aprova.                                      |
| `reject-assignment`          | `{ assignment_id, rejection_reason }`                                  | Admin rejeita (motivo obrigatório).                |
| `remove-assignment`          | `{ assignment_id }`                                                    | Desfaz vínculo.                                    |
| `my-portfolio`               | —                                                                      | Carteira do gestor logado.                         |
| `portfolio-overview`         | —                                                                      | Resumo agregado.                                   |
| `list-cedentes-all`          | —                                                                      | Cedentes disponíveis para vincular.                |
| `search-cedentes`            | `{ q }`                                                                | Busca por nome/CPF/CNPJ.                           |
| `suggest-by-gerente`         | `{ user_id }`                                                          | Sugere cedentes onde `cedente.gerente == profile.nome`. |
| `auto-assign-by-gerente`     | `{ user_id }`                                                          | Aplica vínculos automaticamente.                   |
| `portfolio-advanced-metrics` | `{ user_id?, periodo_meses? }`                                         | 8 KPIs, HHI de concentração, rankings.             |
| `admin-overview`             | —                                                                      | Visão admin global.                                |
| `gestor-dashboard`           | `{ data_inicio?, data_fim? }`                                          | KPIs + alertas (cheques devolvidos `tipo='CHQ'`).  |

**HHI (Herfindahl–Hirschman)**: Σ(share²) em pontos percentuais. Baixa < 1500, Moderada < 2500, Alta > 2500.

---

## 4. `giro-carteira` — Análise operacional

| Action          | Params                       | Retorno                                       |
|-----------------|------------------------------|-----------------------------------------------|
| `list-all`      | —                            | Todos cedentes + risco real (Σ títulos em aberto) |
| `analyze-batch` | `{ cedentes:[cpf_cnpj] }`    | Métricas batch                                |

---

## 5. `cedente-info` — Detalhes consolidados

| Action   | Params                              | Retorno                                                                                                  |
|----------|-------------------------------------|----------------------------------------------------------------------------------------------------------|
| `list`   | `{ search? }`                       | Lista cedentes (com filtro).                                                                              |
| `detail` | `{ cpf_cnpj }`                      | Cedente + operações + títulos em aberto + quitados + recomprados + prorrogados + fraude + receita + QSA.  |
| `search` | `{ query }`                         | Busca livre.                                                                                              |

---

## 6. `hbi-scr` — Consulta SCR Bacen (PAGA)

Body:
```json
{ "documentId":"<CPF/CNPJ>", "consultaType":"AVULSA|COMPARATIVO|DETALHADA", "baseDateInitial":"YYYY-MM" }
```

Resposta:
```json
{ "ok": true, "trace_id":"...", "uuidQuery":"...", "lsDtb":[ ... ], "cached": false }
```

Regras:
- Dedupe 30 s, cache 6 h.
- Validar CPF/CNPJ antes de chamar HBI.
- `trace_id` correlaciona logs em `integration_logs`.
- Grava em `scr_query_jobs` para reprocessamento.

## 7. `scr-reprocess`

Body: `{ "uuidQuery":"..." }` → reconverte `rawResponse` armazenado sem custo.

---

## 8. `serasa-report` — Consulta Serasa (PAGA)

Body:
```json
{
  "consultaId":"serasa_basico|serasa_avancado|serasa_pj_basico|serasa_pj_analitico",
  "documentId":"<CPF/CNPJ>",
  "scoreModel":"<opcional, default por tipo>"
}
```

Resposta:
```json
{ "ok":true, "trace_id":"...", "data":{ /* parsed */ }, "rawResponse":{ ... }, "cached":false }
```

Tipos:
- **PF Básico**: `person-information-report`
- **PF Avançado**: `person-credit-report` (inclui score HRLD; alguns parâmetros em base64).
- **PJ Básico (PME)**: `company-information-report`
- **PJ Analítico (PME)**: `company-credit-report` — parsing especial bloco ACPH segmento 028.

---

## 9. `agrisk-query` — Consultas AgRisk (PAGA)

| Action                   | Params                                                  | Notas                                              |
|--------------------------|---------------------------------------------------------|----------------------------------------------------|
| `list-products`          | —                                                       | Cacheável.                                         |
| `register-client`        | `{ document, name, ... }`                               | Cria/reusa cliente AgRisk (10 páginas dedupe).     |
| `consulta-cliente`       | `{ clientId, productKeys:[...] }`                       | Dispara queries pagas. Polling máx 25 s.           |
| `fetch-existing-details` | `{ clientId, queryId }`                                 | **Reusa** consulta paga existente.                 |
| `fetch-lawsuit-detail`   | `{ clientId, lawsuitId }`                               | Detalha processo.                                  |

---

## 10. `analyze-document` — OCR/extração com IA

Body multipart ou `{ fileBase64, mimeType, kind }` → `LOVABLE_API_KEY` + modelo `openai/gpt-4o`. Retorna campos estruturados (CPF, nome, score, restrições etc.).

## 11. `analyze-cedente` / `analyze-client-summary` / `analyze-credit-operation`

Recebem `{ cpf_cnpj }` (ou contexto) e produzem análise textual usando o Lovable AI Gateway. Sempre **injetam a data atual no system prompt**.

## 12. `credit-analysis-chat`

Chat conversacional com contexto do cliente (`{ messages, clientContext }`). Persona "Analista Sênior de Securitização".

---

## 13. `admin-users` — Gestão de usuários (apenas master admin)

| Action   | Params                                                       |
|----------|--------------------------------------------------------------|
| `list`   | —                                                            |
| `create` | `{ email, password, nome, tipo, roles:[] }`                  |
| `update` | `{ user_id, ...campos }`                                     |
| `delete` | `{ user_id }`                                                |

`bootstrap-master`: cria o usuário master se ainda não existir.

`complete-initial-password-change`: troca senha forçada no primeiro login. Valida HIBP, mínimo 12 chars, sem reutilização.

---

## 14. `goldsign-proxy` — Assinatura ICP-Brasil

`POST /goldsign-proxy?target=<path do backend GoldSign>` repassa request/response. Suporta FormData e JSON. Retry x2 para cold start.

## 15. `goldsign-settings`

| Action  | Params         | Descrição                          |
|---------|----------------|------------------------------------|
| `get`   | —              | Lê configurações da empresa.       |
| `set`   | `{ ...config }`| Atualiza.                          |
| `clear` | —              | Reset.                             |

---

## 16. `serpro-nfe` — NF-e SERPRO

| Action               | Params                          |
|----------------------|---------------------------------|
| `consultar`          | `{ chave }` (44 dígitos)        |
| `push_get_cliente`   | —                               |
| `push_set_cliente`   | `{ urlNotificacao }`            |
| `push_solicitacoes`  | —                               |
| `push_criar`         | `{ chaves:[] }`                 |
| `webhook`            | payload do SERPRO (público)     |

Endpoints SERPRO usados: `GET /nfe/{chave}`, `GET/POST/PUT /nfe/push/clientes`, `GET/POST /nfe/push/solicitacoes`.

---

## 17. `audit-consultas` — API pública de auditoria

**REST puro** com auth `Authorization: Bearer ${AUDIT_API_KEY}`.

```
GET /audit-consultas?from=YYYY-MM-DD&to=YYYY-MM-DD&platform=serasa|scr|agrisk|smart
                    &user_id=<uuid>&consulta_type=<str>&status=success|error|pending
                    &page=1&page_size=50
```

Retorna `{ page, page_size, total, total_pages, filters, items:[...] }`. Ver `ENDPOINTS.md` para exemplos completos.

---

## 18. `import-csv` / `process-sql`

- `import-csv`: ingere CSV de cedentes/operações (validações de tipo e data).
- `process-sql`: importa dumps MySQL → Postgres (converte AUTO_INCREMENT, ENUM, DATETIME etc.). Actions: `import`, `list`, `get`, `tables`.

---

## 19. Fila de e-mails

- `send-transactional-email` `{ templateName, recipient, params }` → enfileira em `email_queue`.
- `process-email-queue` (cron 1 min): processa lote, lida com 429/403, DLQ.
- `handle-email-suppression` (webhook HMAC): grava bounces/complaints/unsubscribes.
- `handle-email-unsubscribe` (público): RFC 8058 one-click + página web.
- `preview-transactional-email`: renderiza templates (gated por `LOVABLE_API_KEY`).

---

## 20. `endpoints-registry`

Registry interno (auth `DOCS_API_KEY`) que descreve cada endpoint chamado nas integrações externas — usado pela tela `/admin/endpoints`.
