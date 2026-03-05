

## Problema Identificado

O valor que deveria aparecer como **Limite Total** está sendo exibido como **Créditos Vencidos**. Isso acontece porque:

1. A função `isLimiteOp` só identifica `mod === '1909'` como limite, mas na prática operações de cheque especial (0214/0208) e cartão de crédito (0207) também podem funcionar como limites de crédito no SCR.
2. O bucket `v20` dessas operações é classificado como "vencido" pela `separateVencBuckets` (num ≤ 100 = vencido), quando na verdade representam valores de limite.
3. O componente `SCRLimites` mostra um formato simplificado que não corresponde ao layout real do HBI (que inclui sub-labels como "Cheque especial", "Cartão de Crédito" e informação de prazo do limite).

## Plano de Correção

### 1. Expandir `isLimiteOp` em `scr-utils.ts`
- Incluir mods que são limites de crédito: `1909`, `0208`, `0214` (quando atuam como limite), e `1905` (Capital de giro com teto rotativo).
- Ou melhor: usar `getModalidadeCategory(op.mod) === 'limite'` para manter consistência com o agrupamento por categoria.

### 2. Atualizar `getModalidadeCategory` em `scr-constants.ts`
- Garantir que mods de limite (0208, 0214 quando aplicável) sejam categorizados como `'limite'`.

### 3. Reformatar `SCRLimites.tsx` conforme o relatório HBI real
- Mostrar formato com colunas: Modalidade | Valor | Subvencionado | Descrição do prazo | Valor do prazo
- Incluir sub-labels ("Cheque especial", "Cartão de Crédito") conforme a imagem de referência
- Mostrar "Limite Total" no header com o valor consolidado

### 4. Garantir que `SCRCarteiraAtiva` e `SCRPdfExport` excluam corretamente os limites
- Verificar que o filtro `!isLimiteOp(op)` use a mesma lógica atualizada
- Corrigir o PDF export para refletir as mesmas mudanças

### Arquivos a editar
- `src/components/analise-operacao/scr/scr-utils.ts` — expandir `isLimiteOp`
- `src/components/analise-operacao/scr/scr-constants.ts` — ajustar categorização de limites
- `src/components/analise-operacao/scr/SCRLimites.tsx` — reformatar layout conforme HBI
- `src/components/analise-operacao/scr/SCRPdfExport.tsx` — manter consistência no PDF

