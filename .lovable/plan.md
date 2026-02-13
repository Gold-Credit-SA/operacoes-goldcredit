
# Correção dos indicadores "Concentração de Risco" e "Risco Total" zerados

## Problemas identificados

Foram encontrados **dois bugs** na edge function `portfolio-data`:

### Bug 1: Filtro `tipo = 'C'` incorreto na consulta de risco
A acao `portfolio-advanced-metrics` (linha 536) filtra titulos em aberto com `AND tipo = 'C'`, mas a tabela externa `smartsecurities_titulos_em_aberto` aparentemente nao retorna registros com esse filtro. A acao `my-portfolio` (linha 217-222) faz a mesma consulta de risco **sem esse filtro** e funciona corretamente. A acao `cedente-info` tambem calcula risco usando **todos os titulos** (sem filtro de tipo), conforme comentario no codigo: "Calcular risco real a partir de TODOS os titulos em aberto (nao apenas tipo C)".

**Solucao:** Remover o filtro `AND tipo = 'C'` da query de risco na acao `portfolio-advanced-metrics`, alinhando com o comportamento das demais acoes.

### Bug 2: `req.json()` chamado duas vezes (body ja consumido)
Na linha 36, o corpo da requisicao e lido com `await req.json()`. Na linha 476, tenta-se ler novamente com `await req.json().catch(() => ({}))` -- mas o stream do body ja foi consumido, entao sempre retorna `{}`. Isso significa que `data_inicio`, `data_fim` e `periodo_meses` enviados pelo frontend **nunca sao lidos**, e os filtros de data sempre usam o fallback (ultimos 6 meses).

**Solucao:** Extrair `data_inicio`, `data_fim` e `periodo_meses` na primeira leitura do body (linha 36) e reutilizar esses valores na acao `portfolio-advanced-metrics`.

## Alteracoes tecnicas

### Arquivo: `supabase/functions/portfolio-data/index.ts`

1. **Linha 36**: Adicionar `data_inicio`, `data_fim` e `periodo_meses` na destructuring do body inicial:
```typescript
const { action, cedente_cpf_cnpj, user_id, assignment_id, status, rejection_reason, data_inicio, data_fim, periodo_meses } = await req.json();
```

2. **Linhas 476-479**: Remover a segunda chamada a `req.json()` e usar as variaveis ja extraidas:
```typescript
const pMeses = periodo_meses || 6;
const dInicio = data_inicio || null;
const dFim = data_fim || null;
```

3. **Linhas 533-538**: Remover o filtro `AND tipo = 'C'` da query de risco:
```sql
SELECT cpf_cnpj_cedente, COALESCE(SUM(valor), 0) as risco
FROM smartsecurities_titulos_em_aberto
WHERE cpf_cnpj_cedente IN (...)
GROUP BY cpf_cnpj_cedente
```

4. Reimplantar a edge function apos as alteracoes.

## Resultado esperado
- **Risco Total** passara a refletir a soma real dos titulos em aberto de todos os cedentes atribuidos
- **Concentracao (HHI)** sera calculado corretamente com base nesse risco
- Os filtros de periodo enviados pelo frontend (mes inicio/fim) serao aplicados corretamente nas consultas de operacoes
