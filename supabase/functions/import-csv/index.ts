import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid table names for import
const validTables = [
  'grupos_analise_vadu',
  'operadores', 
  'regimes_tributarios',
  'estados_civis',
  'fontes_captacao',
  'gerentes',
  'controladores',
  'contas_bancarias',
  'paginations',
  'cedentes_completo',
  'operacoes_individualizadas',
  'receita_por_cedente',
  'titulos_em_aberto',
  'titulos_prorrogados',
  'titulos_quitados',
  'titulos_quitados_suspeita_fraude',
  'titulos_recomprados'
];

// Parse CSV content into array of objects
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Parse header - handle quoted values
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      // Clean header name (remove BOM, quotes, spaces)
      const cleanHeader = header.replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '').trim().toLowerCase();
      const value = values[index] || '';
      row[cleanHeader] = value.replace(/^["']|["']$/g, '').trim();
    });
    
    rows.push(row);
  }
  
  return rows;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Map CSV column names to database column names
function mapColumnName(csvColumn: string): string {
  const mappings: Record<string, string> = {
    'id': 'dev_id',
    'created_at': 'dev_created_at',
    'updated_at': 'dev_updated_at',
  };
  
  return mappings[csvColumn] || csvColumn;
}

// Clean and prepare row for insertion
function prepareRowForInsert(row: Record<string, string>, tableName: string): Record<string, unknown> {
  const prepared: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = mapColumnName(key);
    
    // Skip empty values
    if (value === '' || value === null || value === undefined) {
      continue;
    }
    
    // Handle numeric fields
    if (isNumericField(mappedKey, tableName)) {
      const numValue = parseFloat(value.replace(',', '.'));
      if (!isNaN(numValue)) {
        prepared[mappedKey] = numValue;
      }
    } else {
      prepared[mappedKey] = value;
    }
  }
  
  return prepared;
}

// Check if a field should be numeric
function isNumericField(fieldName: string, tableName: string): boolean {
  const numericFields = [
    'dev_id', 'advalorem', 'fator', 'limite_boleto_especial', 
    'limite_boleto_especial_tranche', 'limite_boleto_garantido',
    'limite_comissaria', 'limite_global', 'limite_operacao_clean',
    'limite_tranche', 'risco_atual', 'saldo', 'escrow',
    'cred_cedente', 'iss', 'prazo_medio', 'valor_bruto', 'valor_iof',
    'valor_liquido', 'valor_pagto_operacao', 'valor_pendencia',
    'valor_receita', 'valor_recompra_repass', 'valor_saldo',
    'valor_tarifa', 'valor_taxa', 'desagio', 'desconto',
    'despesas_bancarias', 'juros', 'multas', 'porcentagem',
    'tarifas', 'taxa', 'taxas_administrativas', 'total',
    'valor', 'valor_juros', 'valor_multa', 'valor_tarifas',
    'valor_total', 'data_prorrogacao', 'iof', 'multa',
    'valor_face', 'valor_face_anterior', 'valor_desconto',
    'valor_liquidado', 'valor_tar_dev_cheque', 'valor_tar_recompra',
    'liquidado', 'tarifa'
  ];
  
  return numericFields.includes(fieldName);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableName, csvContent, batchSize = 100 } = await req.json();
    
    // Validate table name
    if (!validTables.includes(tableName)) {
      console.error(`Invalid table name: ${tableName}`);
      return new Response(
        JSON.stringify({ success: false, error: `Tabela inválida: ${tableName}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!csvContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conteúdo CSV não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse CSV
    console.log(`Parsing CSV for table: ${tableName}`);
    const rows = parseCSV(csvContent);
    console.log(`Parsed ${rows.length} rows`);
    
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, rowsInserted: 0, message: 'CSV vazio ou sem dados válidos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare rows for insertion
    const preparedRows = rows.map(row => prepareRowForInsert(row, tableName));
    
    // Insert in batches
    let totalInserted = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < preparedRows.length; i += batchSize) {
      const batch = preparedRows.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from(tableName)
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`Batch error at ${i}:`, error);
        errors.push(`Lote ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      } else {
        totalInserted += data?.length || 0;
      }
    }

    console.log(`Successfully inserted ${totalInserted} rows into ${tableName}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        rowsInserted: totalInserted,
        totalRows: rows.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
