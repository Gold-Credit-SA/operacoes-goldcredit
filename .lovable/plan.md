

## Integração AgRisk — Consulta Cliente + Patrimônio

### Escopo
Integrar 4 consultas reais da API AgRisk:
1. **Consulta Cliente** (`consulta-cliente`) — dados cadastrais do cliente
2. **Pesquisa de Imóveis - Simples** (`pesquisa-imoveis`)
3. **Pesquisa Imóveis - CAR** (`car`)
4. **Patrimônio Veicular** (`vehicle-assets`)

### Pré-requisitos
Adicionar 2 secrets no backend:
- `AGRISK_CREDENTIAL` → `api-agrisk@goldcreditsa.com.br`
- `AGRISK_PASSWORD` → `@CB9W0AkYRkvFfx`

### Implementação

#### 1. Edge Function `agrisk-query` (criar)
`supabase/functions/agrisk-query/index.ts`

Fluxo:
1. Recebe `{ taxId, consultaType }` no body
2. **POST** `/login` com credential/password → obtém JWT token
3. **POST** `/clients` com `{ taxId }` → obtém `clientId` (se 400 = já existe, busca na listagem)
4. Mapeia `consultaType` para o código do produto AgRisk:

| Frontend ID | Code AgRisk |
|---|---|
| `consulta_cliente` | `consulta-cliente` |
| `imoveis_simples` | `pesquisa-imoveis` |
| `imoveis_car` | `car` |
| `patrimonio_veicular` | `vehicle-assets` |

5. Solicita a consulta para o cliente e produto
6. Polling até 45s aguardando resultado
7. Retorna dados consolidados

#### 2. ConsultaSelection.tsx — adicionar "Consulta Cliente"
Adicionar novo item `{ id: 'consulta_cliente', label: 'Consulta Cliente' }` no grupo Agrisk.

#### 3. ConsultaExecution.tsx — conectar ao backend
Adicionar bloco antes da simulação para IDs AgRisk:
```typescript
const AGRISK_IDS = ['consulta_cliente', 'imoveis_simples', 'imoveis_car', 'patrimonio_veicular'];
if (AGRISK_IDS.includes(id)) {
  const { data, error } = await supabase.functions.invoke('agrisk-query', {
    body: { taxId: cnpj.replace(/\D/g, ''), consultaType: id },
  });
  // handle response...
}
```

#### 4. Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/agrisk-query/index.ts` | Criar |
| `src/components/analise-operacao/ConsultaSelection.tsx` | Editar — add Consulta Cliente |
| `src/components/analise-operacao/ConsultaExecution.tsx` | Editar — add case AgRisk |

