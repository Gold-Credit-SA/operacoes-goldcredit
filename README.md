# Consulta de Cedentes

Sistema web para consulta de cedentes com importação de arquivos .sql.

## Funcionalidades

- ✅ Upload de arquivo .sql (formato MySQL convertido automaticamente)
- ✅ Armazenamento no Lovable Cloud (PostgreSQL)
- ✅ Listagem de cedentes em tabela
- ✅ Busca por nome / CNPJ / CPF
- ✅ Página de detalhes do cedente

## Como Usar

1. Acesse a aplicação
2. Faça upload de um arquivo .sql contendo INSERTs na tabela `cedentes`
3. Os dados serão importados automaticamente
4. Use a busca para encontrar cedentes específicos
5. Clique em um cedente para ver os detalhes

## Formato do SQL Esperado

O arquivo .sql deve conter INSERT INTO cedentes:

```sql
INSERT INTO cedentes (nome, razao_social, cnpj, email, cidade, estado, status) VALUES
('João Silva', 'JS Comércio LTDA', '12.345.678/0001-90', 'joao@empresa.com', 'São Paulo', 'SP', 'Ativo'),
('Maria Santos', 'MS Serviços ME', '98.765.432/0001-10', 'maria@servicos.com', 'Rio de Janeiro', 'RJ', 'Ativo');
```

## Tecnologias

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Lovable Cloud (PostgreSQL + Edge Functions)
