

## Análise: Diferenças entre SCRDetailView atual e o relatório real HBI

Comparei o PDF real do HBI (SCR-2.pdf) com o componente `SCRDetailView.tsx` atual. Existem várias diferenças significativas:

### Campos faltantes no cabeçalho
O PDF real exibe campos que não estão no componente atual:
- **Razão social** (nome da empresa, em destaque)
- **CNPJ formatado** (18.475.469/0002-23)
- **Raiz do documento** (primeiros 8 dígitos)
- **Total de operações** (ex: 40)
- **Op. em discordância** e **Op. sub judice** (ambos 0 no exemplo)
- **Risco direto** (R$ 0,00)
- **Classificação de risco** (ex: "A")

### Seções faltantes ou incompletas
1. **Créditos Vencidos** - O PDF tem uma seção separada para créditos vencidos (v10, v20 para vencidos). Atualmente tudo é misturado em "Carteira Ativa".
2. **Seção de Limites** - O PDF mostra limites de crédito (Cheque especial, Cartão de Crédito) separados das operações. O componente atual não distingue limites.
3. **Categorias do detalhamento** - O PDF agrupa por categorias maiores: Empréstimos, Títulos Descontados, Financiamentos, Outros Créditos, Limite. Cada categoria tem subtotal e sub-modalidades indentadas.

### Labels de Carteira Ativa
O PDF usa labels mais curtas: "30 Dias", "31 a 60 Dias", "61 a 90 Dias", etc. O componente usa "A vencer até 30 dias", "A vencer de 31 a 60 dias".

### Modalidades faltantes no mapa
- Códigos para "Outros créditos" e "Cartão de crédito - compra"
- Códigos de limite (1909 já existe mas precisa separar como "Limite")

---

## Plano de implementação

### 1. Atualizar cabeçalho com todos os campos do relatório real
- Adicionar Razão social em destaque
- Formatar CNPJ com máscara
- Adicionar "Raiz do documento", "Total de operações", "Op. em discordância", "Op. sub judice", "Risco direto", "Classificação de risco"
- Nota: alguns destes campos podem não vir na API; exibir quando disponíveis, ocultar quando não

### 2. Separar Carteira Ativa em "Créditos a Vencer" e "Créditos Vencidos"
- Buckets v10-v40 = vencidos; v110-v200 = a vencer
- Mostrar subtotais separados e mensagem "não possui créditos vencidos" quando aplicável

### 3. Reformatar seção de Detalhamento
- Agrupar operações por categoria principal (Empréstimos, Títulos Descontados, Financiamentos, Outros Créditos, Limite)
- Mostrar subtotal por categoria como header
- Sub-modalidade indentada abaixo da categoria
- Usar labels curtas nos prazos ("30 Dias" em vez de "A vencer até 30 dias")

### 4. Adicionar seção de Limites separada
- Filtrar operações que são limites (mod 1909 e similares)
- Exibir em seção própria com "Limite Total"

### 5. Expandir mapas de modalidades
- Adicionar códigos faltantes para "Outros créditos", "Cartão de crédito - compra", etc.

**Arquivo editado:** `src/components/analise-operacao/SCRDetailView.tsx`

