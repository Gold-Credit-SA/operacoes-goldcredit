

## Comparação: Relatório Oficial Serasa vs Nosso Relatório

Analisei o JSON retornado pela API Serasa para o CNPJ 20.663.814/0001-13 (Avançado PJ) e comparei com as 4 imagens do relatório oficial. Aqui estão as discrepâncias encontradas:

---

### Problemas Identificados

**1. Limite de Crédito PJ nao encontra os dados**
- O código procura `optionalFeatures.creditLimit` ou `report.creditLimit`
- A API retorna o limite em `scores.scoreResponse[0]` com `scoreModel: "HLC1"` e `score: 74550` (= R$ 74.550,00)
- Resultado: seção mostra "Sem dados" quando deveria mostrar **R$ 74.550,00**

**2. defaultRate exibido incorretamente**
- API retorna `"01378"` (string crua sem formatação)
- Deveria exibir: `13,78%` (probabilidade de inadimplência)
- O cálculo de "honrar compromissos" faz `100 - parseFloat("01378")` = `-1278` em vez de `86,22%`
- Correção: parsear "01378" como `13.78` (inserir ponto decimal 2 casas antes do final)

**3. Gráfico de consultas mostra apenas 6 meses**
- Oficial mostra **13 meses** de histórico (Fev/2025 a Mar/2026)
- API retorna 13 itens em `historical[]`
- Nosso `InquiryBarChartPJ` renderiza apenas 6 meses

**4. Tabela de consultas falta coluna CNPJ**
- Oficial tem: Data | Nome do consultante | **CNPJ do consultante** | Quantidade
- Nosso tem: Data | Quantidade | Empresa consultante
- Faltam: coluna CNPJ e reordenação das colunas

**5. Fontes Consultadas ausente**
- Oficial exibe "Fontes Consultadas: 12" ao lado da contagem de consultas
- Não renderizamos esse dado

**6. Campo "Opção Tributária" ausente nos Dados Cadastrais**
- O grid de cards oficiais tem 8 cards (inclui "Filiais" e "Opção Tributária")
- Nosso grid tem 7 cards, falta "Opção Tributária"

**7. Seção "Informações sobre compras" e campos extras nos Outros Dados**
- Oficial mostra campos adicionais: "Importação sobre compras", "Exportação sobre vendas"
- Nosso código não renderiza esses campos

**8. Empresa antecessora** 
- API retorna `predecessorList` (array com 2 itens)
- Código exibe apenas um valor estático, não itera a lista

---

### Plano de Correções

1. **Fix Limite de Crédito PJ**: Buscar valor em `scores.scoreResponse` onde `scoreModel === 'HLC1'`, usar `score` como valor monetário e `message` como interpretação

2. **Fix defaultRate parsing**: Converter string crua ("01378") para percentual formatado ("13,78%") — inserir vírgula 2 casas antes do final

3. **Expandir gráfico para 13 meses**: Alterar `InquiryBarChartPJ` para usar todos os itens do `historical[]` da API em vez de gerar apenas 6 meses

4. **Adicionar coluna CNPJ na tabela de consultas PJ**: Incluir `companyDocumentId` formatado

5. **Adicionar "Fontes Consultadas"**: Exibir contagem total de fontes na seção de consultas

6. **Adicionar "Opção Tributária"**: Novo card no grid de dados cadastrais

7. **Iterar predecessorList**: Exibir todas as empresas antecessoras como lista

Todas as alterações serão feitas em `SerasaDetailView.tsx`.

