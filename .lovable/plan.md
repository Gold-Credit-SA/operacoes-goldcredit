

## Análise do Problema

Comparando as imagens:

**HBI original** (3 linhas agrupadas):
- Cheque especial: R$ 5.000,00
- Cartão de Crédito: R$ 77.659,27
- Descontos: R$ 600.000,00

**Plataforma atual** (5 linhas individuais):
- Outros financiamentos: R$ 39.261,69
- Outros financiamentos: R$ 30.000,00
- Descontos: R$ 600.000,00
- Outros financiamentos: R$ 8.397,58
- Outros empréstimos: R$ 5.000,00

O total bate (R$ 682.659,27), mas dois problemas:
1. **Operações não estão agrupadas** — o HBI soma operações com a mesma categoria de limite
2. **Labels errados** — operações com mod 1902/1904 mostram o label genérico ("Outros financiamentos") em vez do label de limite do HBI

## Plano de Correção

### 1. Agrupar operações de limite por sub-label no `SCRLimitesCredito.tsx`

Em vez de mostrar cada operação individualmente, agrupar por label e somar os valores:

```
Antes: 3x "Outros financiamentos" → 3 linhas
Depois: 1x "Outros financiamentos" → 1 linha com soma
```

### 2. Expandir `LIMITE_SUB_LABELS` em `scr-constants.ts`

Adicionar mapeamentos para mod codes que aparecem como limites:
- `1902` → "Outros empréstimos"
- `1904` → "Outros financiamentos"  
- `1901` → "Outros créditos"

### 3. Aplicar mesma lógica de agrupamento no `SCRPdfExport.tsx`

Agrupar limites por label no PDF também.

### Arquivos a editar:
- `src/components/analise-operacao/scr/scr-constants.ts` — adicionar labels
- `src/components/analise-operacao/scr/SCRLimitesCredito.tsx` — agrupar por label
- `src/components/analise-operacao/scr/SCRPdfExport.tsx` — agrupar limites no PDF

