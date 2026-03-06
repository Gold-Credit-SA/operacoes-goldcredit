

## Diagnóstico

A autenticação Serasa está funcionando corretamente (status 201). O erro `DOCUMENT_NOT_FOUND` ocorre porque:

1. **Ambiente UAT**: O ambiente de testes da Serasa possui apenas CPFs de teste cadastrados, não CPFs reais.
2. **CNPJ enviado para endpoint PF**: O relatório `PERFIL_DE_CREDITO_BASICO_PF` aceita apenas CPFs (11 dígitos). Se o usuário digitar um CNPJ (14 dígitos), a consulta falhará.

## Plano

### 1. Validação no Edge Function (`serasa-report`)
- Rejeitar documentos que não tenham exatamente 11 dígitos (CPF) com mensagem clara: "Relatório PF requer CPF (11 dígitos). Para CNPJ, use um relatório PJ."

### 2. Filtro no frontend (`ConsultaSelection.tsx`)
- Quando o documento digitado for CNPJ (14 dígitos), esconder automaticamente a opção "Relatório Básico PF (Serasa)" da lista de consultas disponíveis, já que esse relatório só funciona com CPF.
- Quando for CPF (11 dígitos), exibir normalmente.

### 3. Melhorar mensagem de erro no frontend
- Em `ConsultaExecution.tsx`, ao receber `DOCUMENT_NOT_FOUND`, exibir mensagem mais orientativa: "CPF não encontrado. Verifique se o CPF está correto. No ambiente de testes, apenas CPFs de homologação são aceitos."

### Arquivos a editar
- `supabase/functions/serasa-report/index.ts` — validação de 11 dígitos
- `src/components/analise-operacao/ConsultaSelection.tsx` — filtrar opções PF/PJ por tipo de documento
- `src/components/analise-operacao/ConsultaExecution.tsx` — mensagem de erro mais clara

