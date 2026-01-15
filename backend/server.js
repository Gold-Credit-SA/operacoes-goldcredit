const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do MySQL - ALTERE CONFORME SEU AMBIENTE
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cedentes_db',
  multipleStatements: true, // Permite executar múltiplos statements SQL
};

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do Multer para upload de arquivos
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .sql são permitidos'));
    }
  }
});

// Pool de conexões
let pool;

async function initializeDatabase() {
  try {
    // Primeiro, conecta sem especificar database para criar se não existir
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await tempConnection.end();
    
    // Agora cria o pool com o database
    pool = mysql.createPool(dbConfig);
    console.log('✅ Conectado ao MySQL');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MySQL:', error.message);
    console.log('\n📋 Configuração necessária:');
    console.log('1. Certifique-se que o MySQL está rodando');
    console.log('2. Configure as variáveis de ambiente ou edite dbConfig no server.js');
    console.log('   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME\n');
  }
}

// Rota de health check
app.get('/api/health', async (req, res) => {
  try {
    if (!pool) {
      return res.json({ success: false, error: 'Database não conectado' });
    }
    await pool.query('SELECT 1');
    res.json({ success: true, data: { connected: true } });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Rota para upload e execução de SQL
app.post('/api/upload-sql', upload.single('sqlFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
  }

  try {
    if (!pool) {
      throw new Error('Database não conectado');
    }

    const sqlContent = fs.readFileSync(req.file.path, 'utf8');
    
    // Executa o SQL
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(sqlContent);
      
      // Calcula rows afetados
      let rowsAffected = 0;
      if (Array.isArray(result)) {
        rowsAffected = result.reduce((acc, r) => acc + (r.affectedRows || 0), 0);
      } else if (result.affectedRows) {
        rowsAffected = result.affectedRows;
      }

      res.json({ 
        success: true, 
        data: { rowsAffected },
        message: 'SQL executado com sucesso' 
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao executar SQL:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    // Remove arquivo temporário
    fs.unlinkSync(req.file.path);
  }
});

// Rota para listar cedentes
app.get('/api/cedentes', async (req, res) => {
  try {
    if (!pool) {
      throw new Error('Database não conectado');
    }

    const { search } = req.query;
    
    // Primeiro, verifica se a tabela cedentes existe
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cedentes'
    `, [dbConfig.database]);

    if (tables.length === 0) {
      return res.json({ success: true, data: [] });
    }

    let query = 'SELECT * FROM cedentes';
    const params = [];

    if (search) {
      // Busca flexível por nome, razão social, CNPJ ou CPF
      query += ` WHERE 
        (nome LIKE ? OR razao_social LIKE ? OR cnpj LIKE ? OR cpf LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY id DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao buscar cedentes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para buscar cedente por ID
app.get('/api/cedentes/:id', async (req, res) => {
  try {
    if (!pool) {
      throw new Error('Database não conectado');
    }

    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM cedentes WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cedente não encontrado' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Erro ao buscar cedente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cria pasta de uploads se não existir
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Inicializa o servidor
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('\n📌 Endpoints disponíveis:');
    console.log(`   GET  /api/health          - Verifica conexão`);
    console.log(`   POST /api/upload-sql      - Upload e execução de arquivo .sql`);
    console.log(`   GET  /api/cedentes        - Lista cedentes (query: ?search=termo)`);
    console.log(`   GET  /api/cedentes/:id    - Detalhe do cedente\n`);
  });
});
