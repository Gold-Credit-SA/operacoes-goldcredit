

## Remodelagem: Cadastro de Clientes com Consultas Integradas

### Conceito
Trocar o fluxo atual (wizard linear CPF → selecionar → executar) por um modelo centrado no cliente, similar ao AgRisk: cada CPF/CNPJ consultado vira um cadastro no sistema, com perfil próprio e histórico de consultas vinculado.

### Novo Fluxo
```text
┌─────────────────────┐     ┌──────────────────────────────┐
│  /clientes           │     │  /clientes/:id               │
│                     │     │                              │
│  Lista de clientes  │────▶│  Dados cadastrais (AgRisk)   │
│  + Busca/Filtro     │     │  Nome, CPF, Nascimento, etc  │
│  + Botão "Novo"     │     │                              │
│  (digita CPF/CNPJ)  │     │  [Consultar] ← abre modal   │
│                     │     │                              │
└─────────────────────┘     │  Histórico de consultas      │
                            │  (Serasa, SCR, AgRisk...)    │
                            └──────────────────────────────┘
```

### Banco de Dados

Nova tabela `consulta_clients`:
- `id` (uuid, PK)
- `cpf_cnpj` (text, unique)
- `name` (text, nullable)
- `agrisk_client_id` (text, nullable) — ID do cliente no AgRisk
- `basic_data` (jsonb, nullable) — dados cadastrais do AgRisk (nascimento, gênero, estado civil, validações, endereços, etc.)
- `created_by` (uuid, ref auth.users)
- `created_at`, `updated_at`

RLS: autenticados podem ler todos; inserir/atualizar se `created_by = auth.uid()` ou admin.

A tabela `consulta_history` existente já possui `cnpj` — será usada como histórico por cliente sem alterações.

### Arquivos Novos

1. **`src/pages/Clientes.tsx`** — Lista de clientes cadastrados com busca, e botão "Novo Cliente" que abre input de CPF/CNPJ. Ao confirmar, chama AgRisk `consulta_cliente` para dados básicos e salva na tabela `consulta_clients`.

2. **`src/pages/ClienteDetail.tsx`** — Perfil do cliente:
   - Card com dados cadastrais (nome, CPF, nascimento, gênero, estado civil, validações)
   - Botão "Consultar" que abre modal com as opções de consulta (Serasa, SCR, AgRisk patrimônio, etc.)
   - Seção de histórico de consultas (filtra `consulta_history` pelo `cnpj` do cliente)
   - Cada item do histórico permite ver detalhes e gerar PDF (reusa componentes existentes)

3. **`src/components/clientes/ConsultaModal.tsx`** — Modal com checkbox dos tipos de consulta disponíveis (reusa lógica do `ConsultaSelection` atual), executa e salva resultados.

### Arquivos Editados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Adicionar rotas `/clientes` e `/clientes/:id` |
| `src/components/layout/AppSidebar.tsx` | Substituir menu "Consultas" (dropdown com históricos separados) por item "Clientes" que aponta para `/clientes`. Manter sub-item "Nova Consulta" apontando para `/clientes` |
| `src/components/analise-operacao/ConsultaExecution.tsx` | Reutilizado internamente pelo `ConsultaModal` |

### Sidebar Simplificada

O menu lateral perde os sub-itens de histórico separados (Serasa, SCR, Agrisk) e ganha:
- **Clientes** → `/clientes` (lista + cadastro + consultas + histórico, tudo em um só lugar)

### Edge Function

A edge function `agrisk-query` existente já funciona para `consulta_cliente`. Será chamada automaticamente ao cadastrar um novo cliente para buscar dados básicos.

