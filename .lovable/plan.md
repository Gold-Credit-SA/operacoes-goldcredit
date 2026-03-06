

## Problema

Comparando o PDF exportado pela plataforma com o relatório HBI original, existem várias diferenças estruturais:

### O que o HBI mostra (formato correto):
1. **"Créditos a Vencer - R$ X"** — seção separada com tabela Prazo | Valor | %
2. **"Créditos Vencidos - R$ X"** — seção separada com tabela Prazo | Valor | %
3. **"Limites de Crédito - R$ X"** — seção separada com tabela Modalidade | Limite
4. **"Detalhamento das Operações - Mês/Ano"** — com sub-seções por categoria:
   - **"Empréstimos — R$ X"** (header de grupo com total)
   - Linhas individuais: Modalidade | Valor | Vencimentos (inline: "30 Dias: R$ X | 31 a 60 Dias: R$ X")
   - **"Títulos Descontados — R$ X"** (header de grupo)
   - etc.

### O que a plataforma mostra (errado):
1. **"CARTEIRA ATIVA"** — formato unificado (não existe no HBI)
2. Sem seção separada de "Limites de Crédito"
3. Detalhamento mostra categoria + sublabel empilhados por operação, sem headers de grupo com totais
4. Coluna "Cambial" no detalhamento (HBI não mostra)
5. Bucket `v165` aparece sem label mapeado
6. Labels de vencido no detalhamento mostram com prefixo errado

## Plano de Correção

### 1. Reestruturar layout para 4 seções separadas (UI + PDF)

**Substituir** `SCRCarteiraAtiva` por duas seções separadas:
- **"Créditos a Vencer"** — Card com total no título, tabela com Prazo | Valor | %
- **"Créditos Vencidos"** — Card com total no título, tabela com Prazo | Valor | %

**Criar** `SCRLimitesCredito` como seção separada:
- **"Limites de Crédito"** — Card com total no título, tabela com Modalidade | Limite

### 2. Reformatar `SCRDetalhamento` para formato HBI

- Título: "Detalhamento das Operações - Mês/Ano"
- Para cada categoria com operações, mostrar **header de grupo**: "Empréstimos — R$ total"
- Abaixo, cada operação com: Modalidade (label) | Valor | Vencimentos inline ("30 Dias: R$ X, 31 a 60 Dias: R$ Y")
- Remover coluna "Cambial"
- Usar labels corretos: "30 Dias", "31 a 60 Dias" etc. (sem prefixo "A vencer de")

### 3. Adicionar `v165` ao mapa de labels

- Adicionar `'v165': 'Acima de 720 Dias'` (ou label adequado) ao `VENCIMENTO_AVENCER_MAP`

### 4. Corrigir labels de vencidos

No mapa `VENCIMENTO_VENCIDO_MAP`:
- `v10` → "Vencidos há mais de 15 dias"  
- `v20` → "Vencidos até 15 dias"
- `v30` → "Vencidos de 1 a 30 dias" (verificar)
- `v40` → "Vencidos de 31 a 60 dias"

### 5. Atualizar `SCRDetailView` para renderizar as 4 seções na ordem correta

```
SCRHeader → SCRCreditosAVencer → SCRCreditosVencidos → SCRLimitesCredito → SCRDetalhamento → SCRHistorico
```

### 6. Sincronizar `SCRPdfExport` com a mesma estrutura

- Separar em seções: "Créditos a Vencer", "Créditos Vencidos", "Limites de Crédito"
- Detalhamento com headers de categoria e ops individuais
- Remover coluna Cambial
- Usar labels de vencimento corretos (sem prefixo)

### Arquivos a criar/editar:
- `src/components/analise-operacao/scr/SCRCarteiraAtiva.tsx` — reescrever como "Créditos a Vencer" + "Créditos Vencidos" (dois componentes ou um com duas cards)
- `src/components/analise-operacao/scr/SCRLimitesCredito.tsx` — criar novo
- `src/components/analise-operacao/scr/SCRDetalhamento.tsx` — reformatar com headers de grupo
- `src/components/analise-operacao/scr/scr-constants.ts` — adicionar v165, corrigir labels de detalhamento
- `src/components/analise-operacao/SCRDetailView.tsx` — atualizar composição
- `src/components/analise-operacao/scr/SCRPdfExport.tsx` — sincronizar estrutura

