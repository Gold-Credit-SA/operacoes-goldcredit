

## Correção: Contagem de consultas nos últimos 13 meses

### Problema
O campo `historical[]` da API usa `occurrences` como nome do campo, mas o código lê `quantity` e `count` — ambos inexistentes. Resultado: soma = 0, e só `actual` (5) é exibido.

Dados reais da API:
```
historical: [
  { inquiryDate: "2026-02", occurrences: 4 },
  { inquiryDate: "2026-01", occurrences: 1 },
  { inquiryDate: "2025-12", occurrences: 6 },
  ...
]
```

### Correção em `SerasaDetailView.tsx`

**1. Linha ~358 — Card "Consultas nos últimos 13 meses"**
Alterar de:
```ts
sum + Number(item?.quantity || item?.count || 0)
```
Para:
```ts
sum + Number(item?.occurrences || item?.quantity || item?.count || 0)
```

**2. Gráfico `InquiryBarChartPJ` (~linha 1780+)**
Onde o gráfico monta as barras a partir de `pjInquiryHistorical`, garantir que use `occurrences` como campo de valor.

**3. Tabela de consultas — campo `daysQuantity`**
A tabela já usa `daysQuantity` que existe na API, mas o fallback `inquiryQuantity` pode causar confusão. Ajustar prioridade.

Impacto: 1 arquivo, 2-3 linhas alteradas.

