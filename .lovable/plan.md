

# Aniversariantes Globais - Todos os Gestores

## Problema
A query de aniversariantes no `gestor-dashboard` filtra por `c.cpf_cnpj IN (cpfList)`, mostrando apenas socios de empresas da carteira do gestor logado. O pedido e que **todos** os aniversariantes aparecam para **todos** os gestores.

## Alteracoes

### Edge Function `portfolio-data/index.ts` (acao `gestor-dashboard`)

1. **Remover o filtro por carteira na query de aniversariantes** (linhas 770-778): trocar a query com `INNER JOIN ... WHERE c.cpf_cnpj IN (...)` por uma query simples sem filtro:

```sql
SELECT a.nome, a.nascimento, a.empresa
FROM smartsecurities_aniversariantes a
WHERE a.nascimento IS NOT NULL
  AND a.empresa IS NOT NULL AND TRIM(a.empresa) != ''
```

2. **Mover a query de aniversariantes para antes do early-return de carteira vazia** (linhas 752-761): atualmente, se `cpfList` esta vazio, o endpoint retorna arrays vazios para tudo, incluindo aniversariantes. A query de aniversariantes precisa executar independentemente da carteira.

3. **Calcular `na_carteira`** no mapeamento dos resultados: comparar `UPPER(TRIM(a.empresa))` com os nomes dos cedentes da carteira do usuario para manter a flag visual.

### Fluxo revisado

```text
Antes:
  cpfList vazio -> retorna [] para tudo
  cpfList preenchido -> aniversariantes filtrados por cpfList

Depois:
  Sempre busca TODOS os aniversariantes (sem filtro)
  cpfList vazio -> saldoTrustee=[], chequesDevolvidos=[], mas aniversariantes preenchidos
  na_carteira = true/false baseado na carteira do usuario
```

### Arquivo modificado
- `supabase/functions/portfolio-data/index.ts` - Acao `gestor-dashboard`, linhas 740-882

