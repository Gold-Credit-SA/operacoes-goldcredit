# Backend - Consulta de Cedentes

Backend em Node.js + Express para consulta de cedentes em MySQL.

## Pré-requisitos

- Node.js 18+
- MySQL 8.0+

## Configuração

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar MySQL

O servidor espera as seguintes variáveis de ambiente (ou use os valores padrão):

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_HOST` | localhost | Host do MySQL |
| `DB_USER` | root | Usuário do MySQL |
| `DB_PASSWORD` | (vazio) | Senha do MySQL |
| `DB_NAME` | cedentes_db | Nome do banco de dados |

Você pode criar um arquivo `.env` ou configurar diretamente no `server.js`.

### 3. Iniciar o servidor

```bash
npm start
```

Ou para desenvolvimento (auto-reload):

```bash
npm run dev
```

O servidor irá rodar em `http://localhost:3001`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Verifica conexão com banco |
| POST | `/api/upload-sql` | Upload e execução de arquivo .sql |
| GET | `/api/cedentes` | Lista cedentes (query: `?search=termo`) |
| GET | `/api/cedentes/:id` | Detalhe de um cedente |

## Estrutura esperada da tabela

O sistema espera uma tabela `cedentes` com campos comuns como:

```sql
CREATE TABLE cedentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255),
  razao_social VARCHAR(255),
  cnpj VARCHAR(18),
  cpf VARCHAR(14),
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco VARCHAR(255),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  banco VARCHAR(100),
  agencia VARCHAR(10),
  conta VARCHAR(20),
  status VARCHAR(50),
  data_cadastro DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Mas o sistema é flexível e exibirá todos os campos que existirem na tabela.

## Exemplo de arquivo .sql para importação

```sql
-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS cedentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255),
  razao_social VARCHAR(255),
  cnpj VARCHAR(18),
  email VARCHAR(255),
  telefone VARCHAR(20),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  status VARCHAR(50) DEFAULT 'Ativo'
);

-- Inserir dados
INSERT INTO cedentes (nome, razao_social, cnpj, email, cidade, estado, status) VALUES
('João Silva', 'JS Comércio LTDA', '12.345.678/0001-90', 'joao@empresa.com', 'São Paulo', 'SP', 'Ativo'),
('Maria Santos', 'MS Serviços ME', '98.765.432/0001-10', 'maria@servicos.com', 'Rio de Janeiro', 'RJ', 'Ativo');
```
