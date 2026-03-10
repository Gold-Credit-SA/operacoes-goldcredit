

## Integração AgRisk - Plano

### Resumo

Criar uma Edge Function `agrisk-query` que se autentica na API de produção do AgRisk (`https://api.agrisk.digital`) e executa o fluxo completo: login → cadastro do cliente por CPF/CNPJ → solicitação de consulta com produtos → polling dos resultados. No frontend, conectar as consultas Agrisk existentes (Restritivos, Endividamento, Imóveis) a esta função real, substituindo a simulação atual.

### 1. Configuração de Secrets

Serão necessários dois secrets:
- `AGRISK_CREDENTIAL` — e-mail ou CPF de acesso à API
- `AGRISK_PASSWORD` — senha de acesso

### 2. Edge Function `agrisk-query`

**Arquivo:** `supabase/functions/agrisk-query/index.ts`

Fluxo da função:
1. Recebe `{ taxId, products }` no body (taxId = CPF/CNPJ sem máscara, products = array de IDs de produto)
2. **Login** — `POST /login` com `credential` e `password` → obtém `token`
3. **Cadastrar cliente** — `POST /clients` com `{ taxId }`. Se retornar 400 com `clientId` (já cadastrado), usa esse ID
4. **Solicitar consulta** — `POST /queries` com `{ clients: [clientId], products }` → retorna items com queryIds e status
5. **Polling** — Aguarda até 30s fazendo polling em `GET /queries/clients/{clientId}` checando se os status mudaram de `pending` para `completed`/`error`
6. **Buscar resultados** — Dependendo do produto, busca dados nos endpoints específicos:
   - Restritivos: `/queries/clients/{clientId}/bvs/{queryId}` (contém judicial, fiscal, criminal, etc.)
   - Endividamento: `/queries/clients/{clientId}/bndes`
   - Imóveis CAR: dados no campo `check_bioma` ou endpoint de CAR
   - Imóveis Simples: via endpoint de veicular/imóveis

Retorna os dados consolidados ao frontend.

### 3. Mapeamento de Produtos

A API do AgRisk usa IDs de produto (obtidos via `GET /v2/products`). A função buscará dinamicamente os produtos disponíveis e mapeará os IDs selecionados no frontend para os IDs reais da API.

Mapeamento frontend → AgRisk:
- `restritivos` → produto "Restritivo Nacional" (credit-restrictives-fif-pf, antecedentes, protestos, etc.)
- `endividamento` → produto "Endividamento" (BNDES, Boa Vista)
- `imoveis_simples` → produto "Imóveis Rurais - Simples"
- `imoveis_car` → produto "Imóveis Rurais - CAR"

### 4. Alterações no Frontend

**`ConsultaExecution.tsx`** — Na função `executeConsulta`, adicionar cases para os IDs Agrisk que chamam a Edge Function:
```text
if (['restritivos', 'endividamento', 'imoveis_simples', 'imoveis_car', ...].includes(id)) {
  → supabase.functions.invoke('agrisk-query', { body: { taxId: cnpj, consultaType: id } })
}
```

**`ConsultaSelection.tsx`** — As consultas Agrisk já existem na lista. Nenhuma alteração necessária, exceto eventualmente remover `patrimonio_veicular` e `cpr` se não forem integrados nesta fase.

### 5. Tratamento de Erros

- **401 Unauthorized** — Credenciais inválidas, mensagem clara ao usuário
- **400 Bad Request** — Cliente não encontrado/CPF inválido, retornar mensagem do AgRisk
- **Timeout no polling** — Após 30s sem resultado, retornar status parcial informando que a consulta está em processamento
- Respostas com status não-OK da API retornam erro descritivo sem expor detalhes técnicos

### 6. Arquivos Envolvidos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agrisk-query/index.ts` | Criar — nova Edge Function |
| `src/components/analise-operacao/ConsultaExecution.tsx` | Editar — conectar consultas Agrisk à função real |
| `supabase/config.toml` | Verificar — `verify_jwt = false` para nova função |

### Próximo Passo

Antes de implementar, preciso configurar os dois secrets (`AGRISK_CREDENTIAL` e `AGRISK_PASSWORD`) com suas credenciais reais.

