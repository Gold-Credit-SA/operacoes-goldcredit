

## Plano: Histórico Mensal — Mostrar apenas Carteira Ativa

### Problema atual
O `calcTotalAVencer` soma **todas** as operações (incluindo limites de crédito), inflando o valor de "endividamento". Limites de crédito não são dívida real.

### Solução

**1. Criar função `calcCarteiraAtiva` em `scr-utils.ts`**
- Filtra operações usando `isLimiteOp` para excluir limites
- Soma apenas operações de carteira ativa (créditos a vencer + vencidos)

```typescript
export function calcCarteiraAtiva(dtbEntry: DtbEntry): number {
  return dtbEntry.lsOp
    .filter(op => !isLimiteOp(op))
    .reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);
}
```

**2. Atualizar `SCRHistorico.tsx`**
- Usar `calcCarteiraAtiva` no lugar de `calcTotalAVencer` para o gráfico e tabela
- Renomear coluna "Total" para "Carteira Ativa"
- Manter instituições e doc. processados

**3. Atualizar `SCRPdfExport.tsx`**
- Usar `calcCarteiraAtiva` na seção de histórico mensal do PDF

### Arquivos a editar
- `src/components/analise-operacao/scr/scr-utils.ts` — nova função
- `src/components/analise-operacao/scr/SCRHistorico.tsx` — trocar cálculo e label
- `src/components/analise-operacao/scr/SCRPdfExport.tsx` — trocar cálculo no histórico

