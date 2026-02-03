

# Plano: Tela "Análise de Consulta" com Extração de Documentos via IA

## Objetivo
Criar uma nova tela no sistema que permita o upload de documentos financeiros (PDFs de consultas VADU, SCR, Serasa, etc.) e utilize IA para extrair, interpretar e organizar os dados em um relatório estruturado.

---

## Visão Geral do Fluxo

```text
+------------------+     +-------------------+     +------------------+
|  Upload do PDF   | --> | Extração via IA   | --> | Relatório        |
|  (Drag & Drop)   |     | (Edge Function)   |     | Estruturado      |
+------------------+     +-------------------+     +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  | Download/Export  |
                                                  | PDF/JSON         |
                                                  +------------------+
```

---

## Tipos de Documentos Suportados

Baseado nos PDFs analisados, o sistema identificara e extraira dados de:

| Tipo | Fonte | Dados Extraidos |
|------|-------|-----------------|
| CreditBox/VADU | Bureau de credito | Score, cadastro, protestos, cheques, CredMap |
| SCR | Banco Central | Classificacao de risco, carteira ativa, creditos |
| Serasa | Bureau de credito | Score, anotacoes negativas, participacoes societarias |

---

## Estrutura de Dados Extraidos

O sistema organizara os dados em categorias padronizadas:

**1. Identificacao**
- CPF/CNPJ
- Nome/Razao Social
- Data de nascimento/abertura
- Situacao na Receita

**2. Score e Risco**
- Score (Serasa/CreditBox)
- Classificacao de risco (SCR)
- Probabilidade de pagamento

**3. Restricoes**
- Protestos
- Anotacoes negativas (Pefin, Refin, Convem)
- Cheques sem fundo
- Dividas comerciais

**4. Comportamento Financeiro**
- Historico de pagamentos
- Carteira ativa
- Creditos a vencer/vencidos
- ILM (Indice de Liquidez)

**5. Informacoes Adicionais**
- Participacoes societarias
- Sancoes nacionais/internacionais
- Consultas recentes

---

## Componentes a Criar

### 1. Nova Pagina: `src/pages/AnaliseConsulta.tsx`
- Upload area com drag & drop
- Lista de documentos processados
- Visualizacao do relatorio extraido
- Acoes de exportacao

### 2. Componentes de UI
- `src/components/analise/DocumentUpload.tsx` - Area de upload estilizada
- `src/components/analise/DocumentList.tsx` - Lista de documentos enviados
- `src/components/analise/ExtractedReport.tsx` - Relatorio estruturado
- `src/components/analise/ScoreCard.tsx` - Card de score/risco
- `src/components/analise/RestricaoCard.tsx` - Card de restricoes
- `src/components/analise/LoadingAnalysis.tsx` - Placeholder de carregamento

### 3. Edge Function: `supabase/functions/analyze-document/index.ts`
- Recebe o conteudo do PDF (texto extraido)
- Envia para Lovable AI (Gemini) para interpretacao
- Retorna dados estruturados em JSON

---

## Interface do Usuario

### Estado Inicial
```text
+----------------------------------------------------------+
|  Analise de Consulta                                      |
+----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |                                                     |  |
|  |     [icone upload]                                  |  |
|  |                                                     |  |
|  |     Arraste PDFs aqui ou clique para selecionar    |  |
|  |     VADU, SCR, Serasa e outros                     |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  Documentos suportados: CreditBox, SCR, Serasa, SPC       |
|                                                           |
+----------------------------------------------------------+
```

### Apos Upload e Analise
```text
+----------------------------------------------------------+
|  Analise de Consulta                                      |
+----------------------------------------------------------+
|                                                           |
|  +-- Documentos Processados (3) -------------------------+|
|  | [x] AGRO_NATIVA.pdf          CreditBox    Processado  ||
|  | [x] COMERCIO_PLANTAS.pdf     SCR          Processado  ||
|  | [x] SIDNEY_GAUGLITZ.pdf      Serasa       Processado  ||
|  +-------------------------------------------------------+|
|                                                           |
|  +-- Relatorio Consolidado ------------------------------+|
|  |                                                       ||
|  | [IDENTIFICACAO]  [SCORE]  [RESTRICOES]  [FINANCEIRO]  ||
|  |                                                       ||
|  | CPF/CNPJ: 32.128.982/0001-98                         ||
|  | Nome: AGRO NATIVA INSUMOS AGRICOLAS LTDA             ||
|  | Score: 740 (Risco Moderado)                          ||
|  |                                                       ||
|  | Protestos: NADA CONSTA                               ||
|  | Cheques sem fundo: NADA CONSTA                       ||
|  |                                                       ||
|  +-------------------------------------------------------+|
|                                                           |
|  [Exportar PDF]  [Exportar JSON]  [Nova Analise]          |
|                                                           |
+----------------------------------------------------------+
```

---

## Detalhes Tecnicos

### Edge Function - Prompt de Extracao
A IA recebera o texto do PDF e extraira dados em formato JSON padronizado:

```json
{
  "tipoDocumento": "VADU" | "SCR" | "SERASA" | "OUTRO",
  "dataConsulta": "2026-01-28",
  "identificacao": {
    "cpfCnpj": "32.128.982/0001-98",
    "nome": "AGRO NATIVA INSUMOS AGRICOLAS LTDA",
    "situacaoReceita": "ATIVA",
    "dataAbertura": "2018-11-28"
  },
  "score": {
    "valor": 740,
    "faixa": "501-700",
    "descricao": "Risco moderado",
    "probabilidadePagamento": 80.5
  },
  "restricoes": {
    "protestos": [],
    "chequesSemFundo": [],
    "anotacoesNegativas": [],
    "totalDividas": 0
  },
  "comportamentoFinanceiro": {
    "carteira": {...},
    "historicoPagamento": {...}
  }
}
```

### Frontend - Leitura de PDF
Utilizaremos a API FileReader para ler o conteudo do PDF como texto/base64 e enviar para a edge function.

---

## Arquivos a Modificar

### Navegacao
- `src/components/layout/AppSidebar.tsx` - Adicionar novo item "Analise de Consulta"

### Roteamento
- `src/App.tsx` - Adicionar rota `/analise-consulta`

---

## Estimativa de Implementacao

| Componente | Complexidade |
|------------|--------------|
| Pagina principal | Media |
| Componente de upload | Baixa |
| Edge function com IA | Alta |
| Componentes de extracao | Media |
| Exportacao PDF/JSON | Media |

---

## Consideracoes

1. **Limitacao de Tamanho**: PDFs grandes podem precisar de processamento em chunks
2. **Rate Limits**: Implementar tratamento de erros 429/402 da Lovable AI
3. **Validacao**: Verificar se o PDF contem texto extraivel (nao apenas imagens)
4. **Persistencia**: Opcional - salvar analises no banco para historico

