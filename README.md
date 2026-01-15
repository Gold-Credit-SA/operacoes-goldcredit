# Consulta de Cedentes - MySQL

Sistema web para consulta de cedentes a partir de banco de dados MySQL, com funcionalidade para importar arquivos .sql.

## Funcionalidades

- ✅ Upload de arquivo .sql
- ✅ Execução de scripts SQL no MySQL
- ✅ Listagem de cedentes em tabela
- ✅ Busca por nome / CNPJ / CPF
- ✅ Página de detalhes do cedente

## Estrutura do Projeto

```
├── src/                  # Frontend React
│   ├── components/       # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   ├── lib/             # Funções utilitárias e API
│   └── types/           # TypeScript types
│
├── backend/             # Backend Node.js + Express
│   ├── server.js        # Servidor principal
│   ├── package.json     # Dependências do backend
│   └── README.md        # Documentação do backend
```

## Como Rodar

### 1. Backend (MySQL + Express)

```bash
# Entrar na pasta do backend
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente (opcional)
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=sua_senha
# DB_NAME=cedentes_db

# Iniciar servidor
npm start
```

O backend irá rodar em `http://localhost:3001`

### 2. Frontend (React)

```bash
# Na raiz do projeto
npm install
npm run dev
```

O frontend irá rodar em `http://localhost:5173`

## Uso

1. Certifique-se que o MySQL está rodando
2. Inicie o backend (`cd backend && npm start`)
3. Inicie o frontend (`npm run dev`)
4. Acesse `http://localhost:5173`
5. Faça upload de um arquivo .sql para importar dados
6. Consulte os cedentes na tabela

## Observações

- O sistema não usa dados mockados
- Todos os dados vêm do banco MySQL via arquivo .sql importado
- A tabela principal deve se chamar `cedentes`
- O sistema exibe dinamicamente todos os campos da tabela
