

## Plano: Atualizar e Deploy da Edge Function `serasa-report`

### Problema
A função local ainda usa o payload antigo (`cpf` + `reportName`). O frontend também chama com esse formato. Precisamos atualizar ambos para o novo formato (`document` + `consultaId`) e adicionar suporte a PJ.

### Alterações

#### 1. Reescrever `supabase/functions/serasa-report/index.ts`
- Aceitar payload: `{ document, consultaId, optionalFeatures? }`
- Mapear `consultaId` para `reportName` da API Serasa:
  - `serasa_basico_pf` → `PERFIL_DE_CREDITO_BASICO_PF`
  - `serasa_avancado_top_score_pf` → relatório avançado PF
  - `serasa_basico_pj` → relatório básico PJ
  - `serasa_avancado_pj_analitico` → relatório avançado PJ
- Detectar PF (11 dígitos) vs PJ (14 dígitos) e usar endpoint correto:
  - PF: `/credit-services/person-information-report/v1/creditreport`
  - PJ: `/credit-services/company-information-report/v1/creditreport` (ou equivalente)
- Adicionar `federalUnit` como parâmetro obrigatório (logs mostram erro 412 exigindo esse campo)
- Validação: rejeitar PF com CNPJ e vice-versa
- Manter mesma lógica de auth (Basic → Bearer)

#### 2. Atualizar `src/components/analise-operacao/ConsultaExecution.tsx`
- Mudar chamada Serasa de `{ cpf: cnpj, reportName: '...' }` para `{ document: cnpj, consultaId: id }`

#### 3. Atualizar `src/components/analise-operacao/ConsultaSelection.tsx`
- Adicionar novos tipos Serasa: `serasa_avancado_top_score_pf`, `serasa_basico_pj`, `serasa_avancado_pj_analitico`
- Filtrar PF-only e PJ-only corretamente

#### 4. Deploy e Testes
- Deploy da edge function
- Secrets já configurados (SERASA_CLIENT_ID, SERASA_CLIENT_SECRET, SERASA_API_URL existem)
- Testar com CPF `36494431801` e CNPJ `33000167000101`

### Questão pendente
Os logs mostram que a Serasa exige `federalUnit` como parâmetro obrigatório. Precisamos saber qual UF enviar ou se o frontend deve coletar essa informação. Por ora, usarei um valor default (ex: `SP`) ou tentarei sem ele no endpoint PJ.

