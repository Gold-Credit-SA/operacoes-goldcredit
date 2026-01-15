import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const validTables = [
  'grupos_analise_vadu', 'operadores', 'regimes_tributarios', 'estados_civis',
  'fontes_captacao', 'gerentes', 'controladores', 'contas_bancarias', 'paginations',
  'cedentes_completo', 'operacoes_individualizadas', 'receita_por_cedente',
  'titulos_em_aberto', 'titulos_prorrogados', 'titulos_quitados',
  'titulos_quitados_suspeita_fraude', 'titulos_recomprados'
];

// Date fields that need validation
const dateFields = [
  'data_cadastro', 'primeira_operacao', 'vencimento_contrato', 'data', 'inicio',
  'finalizacao', 'data_pagamento', 'data_emissao', 'vencimento', 'emissao',
  'vencimento_anterior', 'quitacao', 'data_custodia', 'data_quitacao', 'recompra',
  'dev_created_at', 'dev_updated_at'
];

// Numeric fields
const numericFields = new Set([
  'dev_id', 'advalorem', 'fator', 'limite_boleto_especial', 'limite_boleto_especial_tranche',
  'limite_boleto_garantido', 'limite_comissaria', 'limite_global', 'limite_operacao_clean',
  'limite_tranche', 'risco_atual', 'saldo', 'escrow', 'cred_cedente', 'iss', 'prazo_medio',
  'valor_bruto', 'valor_iof', 'valor_liquido', 'valor_pagto_operacao', 'valor_pendencia',
  'valor_receita', 'valor_recompra_repass', 'valor_saldo', 'valor_tarifa', 'valor_taxa',
  'desagio', 'desconto', 'despesas_bancarias', 'juros', 'multas', 'porcentagem', 'tarifas',
  'taxa', 'taxas_administrativas', 'total', 'valor', 'valor_juros', 'valor_multa',
  'valor_tarifas', 'valor_total', 'data_prorrogacao', 'iof', 'multa', 'valor_face',
  'valor_face_anterior', 'valor_desconto', 'valor_liquidado', 'valor_tar_dev_cheque',
  'valor_tar_recompra', 'liquidado', 'tarifa'
]);

function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '').trim().toLowerCase();
      const value = values[index] || '';
      row[cleanHeader] = value.replace(/^["']|["']$/g, '').trim();
    });
    
    rows.push(row);
  }
  
  return rows;
}

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

function mapColumnName(csvColumn: string): string {
  const mappings: Record<string, string> = {
    'id': 'dev_id',
    'created_at': 'dev_created_at',
    'updated_at': 'dev_updated_at',
  };
  return mappings[csvColumn] || csvColumn;
}

function isValidDate(value: string): boolean {
  if (!value || value === '0000-00-00' || value === '0000-00-00 00:00:00') return false;
  if (value.startsWith('0000')) return false;
  // Basic date pattern check
  const datePattern = /^\d{4}-\d{2}-\d{2}/;
  return datePattern.test(value);
}

function prepareRowForInsert(row: Record<string, string>): Record<string, unknown> {
  const prepared: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = mapColumnName(key);
    
    if (value === '' || value === null || value === undefined) continue;
    
    // Handle date fields - skip invalid dates
    if (dateFields.includes(mappedKey)) {
      if (isValidDate(value)) {
        prepared[mappedKey] = value;
      }
      // Skip invalid dates (don't add to prepared)
      continue;
    }
    
    // Handle numeric fields
    if (numericFields.has(mappedKey)) {
      const numValue = parseFloat(value.replace(',', '.'));
      if (!isNaN(numValue)) {
        prepared[mappedKey] = numValue;
      }
      continue;
    }
    
    prepared[mappedKey] = value;
  }
  
  return prepared;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableName, csvContent, batchSize = 50 } = await req.json();
    
    if (!validTables.includes(tableName)) {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Parsing CSV for table: ${tableName}`);
    const rows = parseCSV(csvContent);
    console.log(`Parsed ${rows.length} rows`);
    
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, rowsInserted: 0, message: 'CSV vazio' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preparedRows = rows.map(row => prepareRowForInsert(row)).filter(row => Object.keys(row).length > 0);
    
    if (preparedRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, rowsInserted: 0, message: 'Nenhum dado válido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Prepared ${preparedRows.length} rows for insertion`);

    let totalInserted = 0;
    let errors: string[] = [];
    
    // Process in smaller batches to avoid timeout
    for (let i = 0; i < preparedRows.length; i += batchSize) {
      const batch = preparedRows.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from(tableName)
          .insert(batch)
          .select('id');
        
        if (error) {
          console.error(`Batch ${i}: ${error.message}`);
          errors.push(`Lote ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        } else {
          totalInserted += data?.length || 0;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Batch ${i} exception: ${errMsg}`);
        errors.push(`Lote ${Math.floor(i/batchSize) + 1}: ${errMsg}`);
      }
    }

    console.log(`Inserted ${totalInserted}/${rows.length} rows into ${tableName}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        rowsInserted: totalInserted,
        totalRows: rows.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
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
