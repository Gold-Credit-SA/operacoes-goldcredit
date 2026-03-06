

## Plano: Nome da empresa no histórico + filtros + não salvar erros

### Mudanças necessárias

**1. Migration: adicionar coluna `entity_name` na tabela `consulta_history`**
- `ALTER TABLE consulta_history ADD COLUMN entity_name text;`
- Armazena o nome da empresa/pessoa consultada

**2. `ConsultaExecution.tsx` — não salvar erros + salvar nome da empresa**
- Receber nova prop `entityName?: string`
- No bloco de save (linha 85-97), já só salva no `success` — correto, erros não entram
- Adicionar `entity_name` no insert
- Extrair nome do resultado quando disponível (ex: SCR retorna nome na resposta)

**3. `Consultas.tsx` — passar nome da entidade**
- Após confirmar CNPJ, tentar buscar o nome via dados do resultado ou permitir que o `ConsultaExecution` extraia do retorno da API
- Passar `entityName` para `ConsultaExecution`

**4. `ConsultaHistoryPage.tsx` — exibir nome + adicionar filtros**
- Mostrar `entity_name` como título principal de cada entrada (ao invés de apenas `consulta_label`)
- Adicionar barra de filtros no topo:
  - Campo de busca por nome/CNPJ (texto livre)
  - Filtro por período (data início/fim com date pickers)
- Filtrar no client-side sobre os dados carregados
- Remover badge de status (já que erros não serão mais salvos)

### Arquivos a editar
- **Migration SQL** — nova coluna `entity_name`
- `src/components/analise-operacao/ConsultaExecution.tsx` — prop `entityName`, incluir no insert
- `src/pages/Consultas.tsx` — passar `entityName`
- `src/components/consultas/ConsultaHistoryPage.tsx` — exibir nome, filtros de busca e data

