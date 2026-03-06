

## Plano: Histórico visível para todos + indicador de quem consultou

### Problema atual
- A RLS da tabela `consulta_history` restringe SELECT ao próprio `user_id` (ou admin). Usuários só veem suas próprias consultas.
- Não há informação de quem realizou a consulta nos cards.

### Mudanças

**1. Migration: nova policy RLS + coluna consulted_by_name**
- Adicionar uma **policy SELECT permissiva** para todos os usuários autenticados (`auth.uid() IS NOT NULL`)
- Remover as policies SELECT restritivas existentes ("Users can view own" e "Admins can view all")
- Não é necessário nova coluna — vamos fazer join com `profiles` para obter o nome do usuário que consultou

**2. `ConsultaHistoryPage.tsx` — buscar com join no profiles + exibir nome do consultor**
- Alterar a query para fazer select com join: `select('*, profiles!consulta_history_user_id_fkey(name)')` — porém como não há FK explícita mapeada, faremos uma abordagem alternativa: buscar os profiles separadamente ou incluir o nome do usuário na inserção
- **Abordagem mais simples**: adicionar coluna `consulted_by_name` na tabela e salvar o nome do usuário no momento da inserção (evita joins complexos)
- Exibir no card: "Consultado por {nome}" em texto pequeno

**3. Migration SQL**
```sql
-- Adicionar coluna com nome de quem consultou
ALTER TABLE consulta_history ADD COLUMN consulted_by_name text;

-- Remover policies SELECT restritivas
DROP POLICY IF EXISTS "Users can view own consulta history" ON consulta_history;
DROP POLICY IF EXISTS "Admins can view all consulta history" ON consulta_history;

-- Nova policy: todos autenticados podem ver
CREATE POLICY "All authenticated can view consulta history"
  ON consulta_history FOR SELECT TO authenticated
  USING (true);
```

**4. `ConsultaExecution.tsx` — salvar nome do consultor**
- Buscar `profile.name` do AuthContext e incluir `consulted_by_name` no insert

**5. `ConsultaHistoryPage.tsx` — exibir "Consultado por X"**
- Adicionar `consulted_by_name` no HistoryEntry interface
- Exibir no card junto à data: "Consultado por {nome} · dd/MM/yyyy às HH:mm"

### Arquivos a editar
- **Nova migration SQL** — coluna + RLS
- `src/components/analise-operacao/ConsultaExecution.tsx` — salvar `consulted_by_name`
- `src/components/consultas/ConsultaHistoryPage.tsx` — interface + exibição

