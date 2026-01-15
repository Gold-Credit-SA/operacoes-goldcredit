import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Converte sintaxe MySQL para PostgreSQL
function convertMySQLToPostgres(sql: string): string {
  let converted = sql;
  
  // Remove backticks (MySQL) e substitui por aspas duplas se necessário
  converted = converted.replace(/`/g, '"');
  
  // AUTO_INCREMENT -> gerado pelo SERIAL
  converted = converted.replace(/\s+AUTO_INCREMENT/gi, '');
  converted = converted.replace(/AUTO_INCREMENT\s*=\s*\d+/gi, '');
  
  // INT(n) UNSIGNED -> INTEGER
  converted = converted.replace(/INT\(\d+\)\s*UNSIGNED/gi, 'INTEGER');
  
  // INT(n) -> INTEGER
  converted = converted.replace(/INT\(\d+\)/gi, 'INTEGER');
  
  // TINYINT(1) -> BOOLEAN
  converted = converted.replace(/TINYINT\(1\)/gi, 'BOOLEAN');
  
  // TINYINT(n) -> SMALLINT
  converted = converted.replace(/TINYINT\(\d+\)/gi, 'SMALLINT');
  
  // BIGINT(n) -> BIGINT
  converted = converted.replace(/BIGINT\(\d+\)/gi, 'BIGINT');
  
  // MEDIUMINT -> INTEGER
  converted = converted.replace(/MEDIUMINT\(\d+\)/gi, 'INTEGER');
  converted = converted.replace(/MEDIUMINT/gi, 'INTEGER');
  
  // DOUBLE -> DOUBLE PRECISION
  converted = converted.replace(/\bDOUBLE\b(?!\s+PRECISION)/gi, 'DOUBLE PRECISION');
  
  // DATETIME -> TIMESTAMP
  converted = converted.replace(/DATETIME/gi, 'TIMESTAMP');
  
  // LONGTEXT, MEDIUMTEXT, TINYTEXT -> TEXT
  converted = converted.replace(/LONGTEXT/gi, 'TEXT');
  converted = converted.replace(/MEDIUMTEXT/gi, 'TEXT');
  converted = converted.replace(/TINYTEXT/gi, 'TEXT');
  
  // LONGBLOB, MEDIUMBLOB, TINYBLOB, BLOB -> BYTEA
  converted = converted.replace(/LONGBLOB/gi, 'BYTEA');
  converted = converted.replace(/MEDIUMBLOB/gi, 'BYTEA');
  converted = converted.replace(/TINYBLOB/gi, 'BYTEA');
  converted = converted.replace(/\bBLOB\b/gi, 'BYTEA');
  
  // ENUM -> TEXT (simplificação)
  converted = converted.replace(/ENUM\s*\([^)]+\)/gi, 'TEXT');
  
  // ENGINE=InnoDB e similares
  converted = converted.replace(/ENGINE\s*=\s*\w+/gi, '');
  
  // DEFAULT CHARSET
  converted = converted.replace(/DEFAULT\s+CHARSET\s*=\s*\w+/gi, '');
  
  // CHARSET
  converted = converted.replace(/\bCHARSET\s*=\s*\w+/gi, '');
  
  // CHARACTER SET
  converted = converted.replace(/CHARACTER\s+SET\s+\w+/gi, '');
  
  // COLLATE
  converted = converted.replace(/COLLATE\s*=?\s*\w+/gi, '');
  
  // UNSIGNED
  converted = converted.replace(/\bUNSIGNED\b/gi, '');
  
  // ON UPDATE CURRENT_TIMESTAMP
  converted = converted.replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');
  
  // COMMENT 'xxx' ou COMMENT "xxx"
  converted = converted.replace(/COMMENT\s*=?\s*'[^']*'/gi, '');
  converted = converted.replace(/COMMENT\s*=?\s*"[^"]*"/gi, '');
  
  // KEY `nome` (colunas) - remove índices inline
  converted = converted.replace(/,\s*KEY\s+"[^"]+"\s*\([^)]+\)/gi, '');
  converted = converted.replace(/,\s*KEY\s+\w+\s*\([^)]+\)/gi, '');
  
  // UNIQUE KEY `nome` (colunas)
  converted = converted.replace(/,\s*UNIQUE\s+KEY\s+"[^"]+"\s*\([^)]+\)/gi, '');
  converted = converted.replace(/,\s*UNIQUE\s+KEY\s+\w+\s*\([^)]+\)/gi, '');
  
  // FULLTEXT KEY
  converted = converted.replace(/,\s*FULLTEXT\s+KEY\s+"[^"]+"\s*\([^)]+\)/gi, '');
  
  // PRIMARY KEY já usando nome de constraint
  converted = converted.replace(/,\s*PRIMARY\s+KEY\s+"[^"]+"\s*\(([^)]+)\)/gi, ', PRIMARY KEY ($1)');
  
  // CONSTRAINT ... FOREIGN KEY - simplificar
  // Mantém as foreign keys básicas
  
  // Limpar vírgulas duplicadas ou finais antes de )
  converted = converted.replace(/,\s*\)/g, ')');
  converted = converted.replace(/,\s*,/g, ',');
  
  return converted;
}

// Divide o SQL em statements individuais
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let commentType = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    // Detecta início de comentário
    if (!inString && !inComment) {
      if (char === '-' && nextChar === '-') {
        inComment = true;
        commentType = 'line';
        i++; // Skip next char
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inComment = true;
        commentType = 'block';
        i++;
        continue;
      }
    }
    
    // Detecta fim de comentário
    if (inComment) {
      if (commentType === 'line' && char === '\n') {
        inComment = false;
        continue;
      }
      if (commentType === 'block' && char === '*' && nextChar === '/') {
        inComment = false;
        i++;
        continue;
      }
      continue; // Skip comment content
    }
    
    // Detecta strings
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }
    
    if (inString) {
      current += char;
      if (char === stringChar) {
        // Verifica escape
        if (i + 1 < sql.length && sql[i + 1] === stringChar) {
          current += sql[i + 1];
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    
    // Detecta fim de statement
    if (char === ';') {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Último statement sem ponto e vírgula
  const lastStmt = current.trim();
  if (lastStmt) {
    statements.push(lastStmt);
  }
  
  return statements;
}

// Verifica se é um statement válido para executar
function isValidStatement(stmt: string): boolean {
  const upper = stmt.toUpperCase().trim();
  
  // Statements que queremos executar
  if (upper.startsWith('CREATE TABLE')) return true;
  if (upper.startsWith('INSERT INTO')) return true;
  if (upper.startsWith('DROP TABLE IF EXISTS')) return true;
  if (upper.startsWith('ALTER TABLE')) return true;
  
  // Ignorar
  if (upper.startsWith('SET')) return false;
  if (upper.startsWith('USE')) return false;
  if (upper.startsWith('LOCK')) return false;
  if (upper.startsWith('UNLOCK')) return false;
  if (upper.startsWith('CREATE DATABASE')) return false;
  if (upper.startsWith('DROP DATABASE')) return false;
  if (upper.startsWith('CREATE INDEX')) return false; // Tratar separadamente se necessário
  if (upper.startsWith('CREATE UNIQUE INDEX')) return false;
  if (upper.startsWith('ALTER DATABASE')) return false;
  if (upper.startsWith('START TRANSACTION')) return false;
  if (upper.startsWith('COMMIT')) return false;
  if (upper.startsWith('ROLLBACK')) return false;
  if (upper.startsWith('BEGIN')) return false;
  if (upper === '') return false;
  
  // Por padrão, tentar executar outros statements
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, sql, search, id } = await req.json();

    console.log(`[process-sql] Action: ${action}`);

    if (action === 'import') {
      if (!sql || typeof sql !== 'string') {
        throw new Error('SQL não fornecido');
      }

      const sqlLength = sql.length;
      console.log(`[process-sql] Processing SQL chunk, length: ${sqlLength}`);
      
      // Limite de segurança - chunks maiores que 2MB são rejeitados
      if (sqlLength > 2 * 1024 * 1024) {
        throw new Error('Chunk muito grande. Máximo 2MB por chunk.');
      }
      
      // Converter para PostgreSQL
      const convertedSQL = convertMySQLToPostgres(sql);
      
      // Dividir em statements
      const statements = splitSQLStatements(convertedSQL);
      console.log(`[process-sql] Found ${statements.length} statements`);
      
      // Filtrar statements válidos
      const validStatements = statements.filter(isValidStatement);
      console.log(`[process-sql] Valid statements: ${validStatements.length}`);
      
      if (validStatements.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { rowsAffected: 0, statementsExecuted: 0 },
            message: 'Nenhum statement válido encontrado neste chunk'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Conectar diretamente ao PostgreSQL para executar DDL
      // Usando postgres driver do Deno
      const { Pool } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
      
      const pool = new Pool(dbUrl, 3, true);
      const connection = await pool.connect();
      
      let executed = 0;
      let errors: string[] = [];
      let createdTables: string[] = [];
      let insertedRows = 0;

      try {
        for (const stmt of validStatements) {
          try {
            const upperStmt = stmt.toUpperCase();
            
            // Log do tipo de statement
            if (upperStmt.startsWith('CREATE TABLE')) {
              const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i);
              const tableName = match ? match[1] : 'unknown';
              console.log(`[process-sql] Creating table: ${tableName}`);
              createdTables.push(tableName);
            }
            
            const result = await connection.queryObject(stmt);
            executed++;
            
            // Contar rows inseridos
            if (upperStmt.startsWith('INSERT INTO')) {
              // Conta quantos VALUES groups existem
              const valuesCount = (stmt.match(/\),\s*\(/g) || []).length + 1;
              insertedRows += valuesCount;
            }
            
          } catch (stmtError) {
            const errorMsg = stmtError instanceof Error ? stmtError.message : String(stmtError);
            console.error(`[process-sql] Statement error: ${errorMsg}`);
            console.error(`[process-sql] Failed statement (first 200 chars): ${stmt.substring(0, 200)}`);
            errors.push(`${stmt.substring(0, 50)}... : ${errorMsg}`);
          }
        }
      } finally {
        connection.release();
        await pool.end();
      }

      console.log(`[process-sql] Executed ${executed} statements, ${insertedRows} rows inserted`);
      if (createdTables.length > 0) {
        console.log(`[process-sql] Created tables: ${createdTables.join(', ')}`);
      }
      if (errors.length > 0) {
        console.log(`[process-sql] Errors: ${errors.length}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            rowsAffected: insertedRows,
            statementsExecuted: executed,
            tablesCreated: createdTables,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limita erros retornados
          },
          message: `Importação concluída: ${executed} statements executados, ${insertedRows} registros inseridos${createdTables.length > 0 ? `, tabelas criadas: ${createdTables.join(', ')}` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      // Listar tabelas disponíveis primeiro, depois buscar cedentes se existir
      const { Pool } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
      const dbUrl = Deno.env.get('SUPABASE_DB_URL')!;
      
      const pool = new Pool(dbUrl, 1, true);
      const connection = await pool.connect();
      
      try {
        // Verifica se a tabela cedentes existe
        const tableCheck = await connection.queryObject<{exists: boolean}>(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'cedentes'
          ) as exists
        `);
        
        if (!tableCheck.rows[0]?.exists) {
          // Tenta encontrar qualquer tabela com dados
          const tables = await connection.queryObject<{tablename: string}>(`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
          `);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: [],
              availableTables: tables.rows.map(t => t.tablename)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Buscar cedentes
        let query = `SELECT * FROM public.cedentes`;
        const params: string[] = [];
        
        if (search) {
          query += ` WHERE 
            nome ILIKE $1 OR 
            razao_social ILIKE $1 OR 
            cnpj ILIKE $1 OR 
            cpf ILIKE $1`;
          params.push(`%${search}%`);
        }
        
        query += ` ORDER BY id DESC LIMIT 100`;
        
        const result = await connection.queryObject(query, params);
        
        return new Response(
          JSON.stringify({ success: true, data: result.rows }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } finally {
        connection.release();
        await pool.end();
      }
    }

    if (action === 'get') {
      if (!id) {
        throw new Error('ID não fornecido');
      }

      const { Pool } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
      const dbUrl = Deno.env.get('SUPABASE_DB_URL')!;
      
      const pool = new Pool(dbUrl, 1, true);
      const connection = await pool.connect();
      
      try {
        const result = await connection.queryObject(
          `SELECT * FROM public.cedentes WHERE id = $1`,
          [id]
        );
        
        if (result.rows.length === 0) {
          throw new Error('Cedente não encontrado');
        }

        return new Response(
          JSON.stringify({ success: true, data: result.rows[0] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        connection.release();
        await pool.end();
      }
    }

    if (action === 'tables') {
      // Lista todas as tabelas disponíveis
      const { Pool } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
      const dbUrl = Deno.env.get('SUPABASE_DB_URL')!;
      
      const pool = new Pool(dbUrl, 1, true);
      const connection = await pool.connect();
      
      try {
        const result = await connection.queryObject<{tablename: string}>(`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
        `);
        
        return new Response(
          JSON.stringify({ success: true, data: result.rows.map(r => r.tablename) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        connection.release();
        await pool.end();
      }
    }

    throw new Error('Ação não reconhecida');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[process-sql] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
