# Módulo Cobrança — Build Completo

## Visão geral

Transformar `/cobranca` em um módulo autônomo com 5 abas:

1. **Dashboard** — KPIs e visão de inadimplência
2. **Cobrar (Sugestões)** — fila priorizada de quem cobrar hoje + envio em massa multi-canal
3. **Régua** — configuração das faixas de cobrança e templates
4. **Acordos** — negociações e parcelamentos
5. **Histórico** — envios + notas + linha do tempo por sacado/título

---

## 1. Banco de dados (nova migration)

Novas tabelas em `public`:

- **`cobranca_regua`** — faixas configuráveis (nome, dias_min, dias_max, canal, template_id, ordem, ativo)
- **`cobranca_titulo_status`** — status por título (chave: cedente_cpf_cnpj + numero_titulo)
  - `status`: enum (`em_dia`, `notificado`, `em_negociacao`, `acordo`, `protestado`, `quitado`, `incobravel`)
  - `ultimo_contato_at`, `proximo_contato_at`
- **`cobranca_promessas`** — promessas de pagamento (titulo, data_prometida, valor_prometido, cumprida, observacao)
- **`cobranca_acordos`** — acordos/parcelamentos (sacado_cpf_cnpj, cedente_cpf_cnpj, titulos_originais jsonb, valor_total, qtd_parcelas, primeiro_vencimento, desconto, status, parcelas jsonb)
- **`cobranca_notas`** — anotações livres do operador (sacado_cpf_cnpj, titulo opcional, conteudo, autor)

Extensões em **`cobranca_envios`**:
- adicionar `canal` (`whatsapp` | `email`), `email_destinatario`, `assunto` (para email)

RLS: leitura para todos autenticados, escrita pelo autor (padrão do projeto).

## 2. Edge function

Estender **`cobranca-whatsapp`** (renomear o action router mas manter o nome) com novos actions:

- `dashboard` → KPIs (total em aberto, total em atraso, aging 0-30/31-60/61-90/90+, top 10 devedores, evolução 30d)
- `suggestions` → cruza títulos em aberto + régua + último contato + promessas, retorna fila ordenada por prioridade (atraso × valor)
- `send-email-batch` → usa template `cobranca-aviso` (criar em `_shared/transactional-email-templates/`) e chama `send-transactional-email`
- `set-status`, `add-nota`, `add-promessa`, `create-acordo`, `list-timeline` (por sacado)

Aproveita conexão Postgres externo já existente para puxar títulos do `smartsecurities_titulos_em_aberto`.

## 3. Frontend

`src/pages/Cobranca.tsx` reescrito com tabs. Componentes novos:

- `components/cobranca/DashboardTab.tsx` (cards KPI + aging chart com Recharts + top devedores)
- `components/cobranca/SugestoesTab.tsx` (fila priorizada, multi-select, escolher canal/template, enviar)
- `components/cobranca/ReguaTab.tsx` (CRUD das faixas)
- `components/cobranca/AcordosTab.tsx` (listar acordos, criar novo via modal com parcelamento)
- `components/cobranca/HistoricoTab.tsx` (envios + timeline + notas por sacado, com drawer de detalhe)
- `components/cobranca/SacadoDrawer.tsx` (visão 360º do sacado: títulos abertos, histórico, notas, promessas)

Templates de mensagem com placeholders `{{sacado_nome}}`, `{{numero_titulo}}`, `{{valor}}`, `{{vencimento}}`, `{{dias_atraso}}`, `{{cedente_nome}}`.

## 4. E-mail

Criar template React-email **`cobranca-aviso`** em `supabase/functions/_shared/transactional-email-templates/` e registrar no `registry.ts`. Conteúdo dinâmico vindo do template configurado na régua.

Aproveita toda infra de email já pronta (`send-transactional-email`, supressão, unsubscribe, log).

## 5. Fluxo "Cobrar"

```text
Dashboard mostra: 47 títulos em atraso, R$ 312k
  ↓ click "Cobrar agora"
Aba Sugestões: lista priorizada
  - faixa 1-7 dias: 12 títulos → template "lembrete amigável" / WhatsApp
  - faixa 8-30 dias: 20 títulos → template "cobrança formal" / WhatsApp+Email
  - faixa 30+ dias: 15 títulos → template "notificação final" / Email
  ↓ operador revisa, marca/desmarca, ajusta canal
  ↓ Enviar selecionados
Após envio: status do título vira "notificado", último_contato atualizado
```

## Detalhes técnicos

- Edge function continua `verify_jwt = true` (padrão).
- Aging calculado no edge (`dias_atraso` derivado de `vencimento`).
- Prioridade da sugestão: `score = (dias_atraso × 0.4) + (valor_normalizado × 0.6)`, filtrando quem tem promessa futura ainda vigente.
- Acordo gerado: cria registro em `cobranca_acordos` e marca títulos originais com status `acordo`.
- Reaproveita `cobranca_templates` existente para WhatsApp; cria `assunto` + `corpo` separados para email (campo novo).
- Charts: `recharts` (já presumível no projeto, ou adicionar).

## Fora do escopo

- Disparo cron automático (usuário escolheu "manual com sugestão")
- SMS
- Integração com cartório/protesto (apenas status manual)

---

Posso seguir com a migration e depois construir tudo de uma vez?