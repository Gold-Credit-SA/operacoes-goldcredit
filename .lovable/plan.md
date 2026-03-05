

## Integração HBI SCR - Plano de Implementação

O valor `be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4` será usado tanto como `uuidTypeScr` (tipo de consulta detalhada) quanto como `providerID` / header `user` na autenticação.

### Visão Geral

Criar uma edge function `hbi-scr` que:
1. Autentica na API HBI obtendo um JWT
2. Envia consulta SCR detalhada para um CPF/CNPJ
3. Busca o resultado via polling no endpoint de listagem
4. Retorna os dados ao frontend

Conectar essa edge function ao fluxo existente em `ConsultaExecution`, substituindo a simulação atual por chamada real quando a consulta selecionada for `scr`.

---

### 1. Edge Function `hbi-scr`

**Arquivo**: `supabase/functions/hbi-scr/index.ts`

**Fluxo**:
- Recebe `{ cnpj: string }` no body
- **Auth**: `POST /authentication/login` com secrets já configurados + header `user: be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4`
- **Consulta**: `POST /query/scr/v2/new/{cnpj}` com Bearer JWT, body `{ baseDateInitial: "YYYY-MM" (mês anterior), uuidTypeScr: "be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4" }`
- **Polling**: Se o POST não retornar dados, faz `GET /query/list/v2?service=SCR&q={cnpj}` a cada 3s (máx 10 tentativas) até encontrar resultado
- Retorna dados da consulta SCR ao frontend

**Secrets utilizados**: `HBI_API_URL`, `HBI_CLIENT_ID`, `HBI_CLIENT_SECRET`, `HBI_GRANT_TYPE`, `HBI_SCOPE`

### 2. Config TOML

Adicionar entrada `[functions.hbi-scr]` com `verify_jwt = false`.

### 3. Frontend - `ConsultaExecution`

Atualizar `executeConsulta()` para, quando `id === 'scr'`, chamar `supabase.functions.invoke('hbi-scr', { body: { cnpj } })` em vez da simulação com timeout. As demais consultas continuam simuladas por enquanto.

### 4. Tratamento de Erros

- Timeout na autenticação HBI
- Falha na consulta SCR (CNPJ inválido, serviço indisponível)
- Polling sem resultado após tentativas máximas
- Mensagens de erro em português para o usuário

