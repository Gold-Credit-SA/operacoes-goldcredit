

## Problema

Operações com modalidades 0208 (Cheque especial e conta garantida), 0214 (Cheque especial) e 0207 (Cartão de crédito) estão aparecendo como "Créditos Vencidos" em vez de "Limites de Crédito". 

A causa: a heurística atual em `isLimiteOp` só classifica como limite se a operação NÃO tem buckets v110+. Porém, essas modalidades podem ter buckets v110+ E v10-v100 ao mesmo tempo. Quando isso acontece, a função retorna `false`, e os buckets baixos (v10-v100) vazam para "Créditos Vencidos".

No relatório HBI original, **0208, 0214 e 0207 são sempre limites**, assim como 1909 e 1905.

## Correção

### 1. `scr-utils.ts` — Adicionar 0208, 0214, 0207 ao `ALWAYS_LIMITE`

Mover esses mod codes para a lista de "sempre limite", para que nunca sejam contados como créditos vencidos:

```typescript
const ALWAYS_LIMITE = ['1909', '1905', '0208', '0214', '0207'];
```

A heurística genérica (sem a-vencer = limite) continua valendo para qualquer outro mod code desconhecido.

### Arquivos a editar:
- `src/components/analise-operacao/scr/scr-utils.ts` — uma linha alterada

