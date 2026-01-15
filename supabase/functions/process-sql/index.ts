import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CedenteData {
  nome?: string;
  razao_social?: string;
  cnpj?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  status?: string;
  data_cadastro?: string;
}

// Converte sintaxe MySQL para PostgreSQL
function convertMySQLToPostgres(sql: string): string {
  let converted = sql;
  
  // Remove backticks (MySQL) e substitui por aspas duplas se necessário
  converted = converted.replace(/`/g, '"');
  
  // AUTO_INCREMENT -> SERIAL (já tratamos na criação da tabela)
  converted = converted.replace(/AUTO_INCREMENT/gi, '');
  
  // INT(n) -> INT
  converted = converted.replace(/INT\(\d+\)/gi, 'INT');
  
  // VARCHAR(n) já é compatível
  
  // DATETIME -> TIMESTAMP
  converted = converted.replace(/DATETIME/gi, 'TIMESTAMP');
  
  // ENGINE=InnoDB e similares
  converted = converted.replace(/ENGINE\s*=\s*\w+/gi, '');
  
  // DEFAULT CHARSET
  converted = converted.replace(/DEFAULT\s+CHARSET\s*=\s*\w+/gi, '');
  
  // COLLATE
  converted = converted.replace(/COLLATE\s*=?\s*\w+/gi, '');
  
  // UNSIGNED
  converted = converted.replace(/UNSIGNED/gi, '');
  
  // ON UPDATE CURRENT_TIMESTAMP
  converted = converted.replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');
  
  // IF NOT EXISTS em CREATE TABLE (manter)
  
  return converted;
}

// Extrai INSERTs do SQL e retorna os dados
function extractInserts(sql: string): CedenteData[] {
  const cedentes: CedenteData[] = [];
  
  // Padrão para INSERT INTO cedentes
  const insertRegex = /INSERT\s+INTO\s+["']?cedentes["']?\s*\(([^)]+)\)\s*VALUES\s*(.+?)(?:;|$)/gis;
  
  let match;
  while ((match = insertRegex.exec(sql)) !== null) {
    const columnsStr = match[1];
    const valuesStr = match[2];
    
    // Parse columns
    const columns = columnsStr.split(',').map(c => 
      c.trim().replace(/["'`]/g, '').toLowerCase()
    );
    
    // Parse multiple VALUES groups: (val1, val2), (val3, val4)
    const valuesGroups = valuesStr.match(/\(([^)]+)\)/g) || [];
    
    for (const group of valuesGroups) {
      const values = parseValues(group.slice(1, -1)); // Remove parênteses
      
      const cedente: CedenteData = {};
      columns.forEach((col, idx) => {
        const val = values[idx];
        if (val !== undefined && val !== null && val !== 'NULL') {
          (cedente as any)[col] = val;
        }
      });
      
      if (Object.keys(cedente).length > 0) {
        cedentes.push(cedente);
      }
    }
  }
  
  return cedentes;
}

// Parse valores de um INSERT, tratando strings com vírgulas
function parseValues(valuesStr: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      // Verifica escape
      if (i + 1 < valuesStr.length && valuesStr[i + 1] === stringChar) {
        current += char;
        i++; // Skip escaped quote
      } else {
        inString = false;
      }
    } else if (!inString && char === ',') {
      values.push(cleanValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    values.push(cleanValue(current.trim()));
  }
  
  return values;
}

function cleanValue(val: string): string {
  // Remove aspas ao redor
  if ((val.startsWith("'") && val.endsWith("'")) || 
      (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }
  return val;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, sql, search, id } = await req.json();

    console.log(`[process-sql] Action: ${action}`);

    if (action === 'import') {
      if (!sql || typeof sql !== 'string') {
        throw new Error('SQL não fornecido');
      }

      console.log(`[process-sql] Processing SQL file, length: ${sql.length}`);
      
      // Extrair dados dos INSERTs
      const cedentes = extractInserts(sql);
      console.log(`[process-sql] Found ${cedentes.length} cedentes to import`);

      if (cedentes.length === 0) {
        // Tenta converter e executar o SQL diretamente para CREATE TABLE etc
        // Mas para segurança, vamos apenas retornar que não encontramos dados
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { rowsAffected: 0 },
            message: 'Nenhum INSERT INTO cedentes encontrado no arquivo SQL'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Inserir cedentes no banco
      const { data, error } = await supabase
        .from('cedentes')
        .insert(cedentes)
        .select();

      if (error) {
        console.error('[process-sql] Insert error:', error);
        throw error;
      }

      console.log(`[process-sql] Inserted ${data?.length || 0} records`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { rowsAffected: data?.length || 0 },
          message: 'Importação concluída com sucesso'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      let query = supabase.from('cedentes').select('*');
      
      if (search) {
        query = query.or(`nome.ilike.%${search}%,razao_social.ilike.%${search}%,cnpj.ilike.%${search}%,cpf.ilike.%${search}%`);
      }
      
      query = query.order('id', { ascending: false }).limit(100);
      
      const { data, error } = await query;

      if (error) {
        console.error('[process-sql] List error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get') {
      if (!id) {
        throw new Error('ID não fornecido');
      }

      const { data, error } = await supabase
        .from('cedentes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[process-sql] Get error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
