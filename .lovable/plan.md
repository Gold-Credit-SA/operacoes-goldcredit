

# Importacao em Lote de Aniversariantes via Planilha

## Situacao Atual
- A tabela `smartsecurities_cedentes` no banco externo **nao possui** campo de data de nascimento
- O sistema Smart exporta o relatorio "Aniversariantes" com os campos: Nome, Nascimento, Endereco, Telefone, E-mail, Empresa
- Ja existe a tabela local `cedente_birthdays` para armazenar as datas manualmente
- O cadastro atual e feito um a um pelo dialog

## Solucao
Adicionar um botao "Importar Planilha" no card de Aniversariantes que permita o upload do arquivo XLS exportado do Smart. O sistema ira:
1. Ler o arquivo (XLS/CSV)
2. Extrair Nome e Data de Nascimento de cada linha
3. Tentar vincular cada nome a um cedente da carteira do gestor (busca por nome no banco externo)
4. Fazer upsert na tabela `cedente_birthdays`

## Fluxo do Usuario
1. Exporta o relatorio "Aniversariantes" do sistema Smart (arquivo XLS)
2. No Painel do Gestor, clica em "Importar Planilha"
3. Seleciona o arquivo
4. O sistema processa e exibe quantos registros foram importados
5. Os aniversariantes do dia passam a aparecer automaticamente

## Alteracoes Tecnicas

### 1. Nova action na edge function `portfolio-data`: `import-birthdays`

Recebe um array de registros `{ nome, data_nascimento }` e para cada um:
- Busca o CPF/CNPJ correspondente na tabela `smartsecurities_cedentes` pelo nome (match exato ou ILIKE)
- Faz upsert na tabela `cedente_birthdays` com o CPF/CNPJ encontrado

```text
Request: { action: 'import-birthdays', registros: [{ nome: "JOSE ARAUJO", nascimento: "01/01/1967" }, ...] }
Response: { success: true, importados: 250, nao_encontrados: ["FULANO X", ...] }
```

### 2. Frontend - Componente de importacao

Adicionar no `AniversariantesCard`:
- Botao "Importar" ao lado do botao "Cadastrar"
- Ao clicar, abre um file input que aceita `.xls, .xlsx, .csv`
- Parse do arquivo no frontend (usando leitura de texto para XLS simples ou parse de CSV)
- Envia os dados extraidos para a edge function
- Exibe toast com resultado (X importados, Y nao encontrados)

### 3. Parse do arquivo XLS

O arquivo exportado pelo Smart tem formato XLS antigo (HTML table disfarçado de XLS). Sera parseado como HTML:
- Ler o conteudo como texto
- Extrair as linhas da tabela HTML
- Mapear colunas Nome (indice 0) e Nascimento (indice 1)
- Converter data de "DD/MM/YYYY" para "YYYY-MM-DD"

### Arquivos modificados
- `supabase/functions/portfolio-data/index.ts` - Nova action `import-birthdays`
- `src/components/painel/AniversariantesCard.tsx` - Botao de importacao e logica de parse

### Arquivos novos
- Nenhum arquivo novo necessario
