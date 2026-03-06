

## Análise do Problema

Comparando os PDFs HBI originais com a plataforma:

**HBI original agrupa operações por modalidade (mod code)**:
- 3x "Modalidade 0299" → 1 linha "Outros empréstimos" R$ 316.575,85 (soma)
- 16x "Modalidade 0399" + 7x "Direitos creditórios descontados" → agrupados por mod
- 2x "Modalidade 0499" → 1 linha "Outros financiamentos" R$ 56.208,82
- 2x mod 1304 → 1 linha R$ 22.340,73

**Plataforma atual**: mostra cada operação individualmente, gerando linhas duplicadas com valores "quebrados".

O total geral está correto, mas os valores por linha estão fragmentados porque não agrupa.

## Correção

### 1. `SCRDetalhamento.tsx` — Agrupar operações por mod code

Criar lógica que agrupa operações com mesmo `mod` dentro de cada categoria:
- Somar todos os buckets de `resVenc`
- Somar o valor total
- Mostrar 1 linha por mod code com valores agregados
- Para `varCamb`, usar "Sim" se qualquer operação do grupo tiver

### 2. `SCRPdfExport.tsx` — Mesma lógica de agrupamento no detalhamento do PDF

Aplicar o mesmo agrupamento por mod na seção de detalhamento do PDF exportado.

### Arquivos a editar:
- `src/components/analise-operacao/scr/SCRDetalhamento.tsx` — agrupar ops por mod
- `src/components/analise-operacao/scr/SCRPdfExport.tsx` — agrupar ops por mod no PDF

