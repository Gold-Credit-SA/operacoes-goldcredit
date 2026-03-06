

## Plano: Integrar API Serasa — Relatório Básico PF

### Resumo
Criar uma Edge Function `serasa-report` que autentica na API Serasa (UAT) via OAuth2 e consulta o relatório `PERFIL_DE_CREDITO_BASICO_PF` por CPF. Conectar isso ao fluxo de consultas existente, adicionando a opção "Relatório Básico PF" no grupo Serasa.

### 1. Configurar Secrets
Salvar as credenciais UAT como secrets do backend:
- `SERASA_CLIENT_ID` = `6050f0ea8b8a5f474c8c92ca`
- `SERASA_CLIENT_SECRET` = `9c29c8c474f5a8b8ae0f0506`
- `SERASA_API_URL` = `https://uat-api.serasaexperian.com.br`

### 2. Criar Edge Function `serasa-report`
**Arquivo:** `supabase/functions/serasa-report/index.ts`

Fluxo:
1. Recebe `{ cpf, reportName?, optionalFeatures? }` no body
2. **Autenticação**: POST para `/security/iam/v1/client-identities/login` com header `Authorization: Basic base64(clientId:clientSecret)` e `Content-Type: application/json` → recebe `accessToken` + `tokenType`
3. **Consulta**: GET para `/credit-services/person-information-report/v1/creditreport?reportName=PERFIL_DE_CREDITO_BASICO_PF` com headers:
   - `Authorization: Bearer {token}`
   - `X-Document-Id: {cpf}` (11 dígitos)
   - `Content-Type: application/json`
4. Retorna o JSON da resposta da Serasa

Configurar `verify_jwt = false` no `config.toml`.

### 3. Atualizar `ConsultaSelection.tsx`
Substituir o item genérico "Serasa Avançado" por:
- `{ id: 'serasa_basico_pf', label: 'Relatório Básico PF (Serasa)' }`

### 4. Atualizar `ConsultaExecution.tsx`
No `executeConsulta`, adicionar tratamento para `id === 'serasa_basico_pf'`:
- Invocar `supabase.functions.invoke('serasa-report', { body: { cpf: cnpj } })`
- Retornar os dados da resposta

### 5. Criar componente de visualização `SerasaDetailView.tsx`
Componente que renderiza os dados do relatório Serasa de forma organizada:
- Dados Cadastrais (nome, CPF, situação, data nascimento, nome da mãe)
- Anotações Negativas (PEFIN, REFIN, dívidas vencidas, cheques, protestos) com sumários
- Score (se retornado)
- Documentos Roubados
- Consultas à Serasa

Integrar no dialog de detalhes existente em `ConsultaExecution.tsx`.

### Arquivos a criar/editar
- **Criar:** `supabase/functions/serasa-report/index.ts`
- **Editar:** `supabase/config.toml` (adicionar entry da function)
- **Editar:** `src/components/analise-operacao/ConsultaSelection.tsx` (novo item Serasa)
- **Editar:** `src/components/analise-operacao/ConsultaExecution.tsx` (roteamento para Serasa)
- **Criar:** `src/components/analise-operacao/serasa/SerasaDetailView.tsx`

