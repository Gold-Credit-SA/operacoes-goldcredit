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

// Table-specific column schemas
const tableColumns: Record<string, string[]> = {
  'paginations': ['page', 'tabela'],
  'grupos_analise_vadu': ['id_grupo_analise_vadu', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'operadores': ['id_operador', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'regimes_tributarios': ['id_regime_tributario', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'estados_civis': ['id_estado_civil', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'fontes_captacao': ['id_fonte_captacao', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'gerentes': ['id_gerente', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'controladores': ['id_controlador', 'descricao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'contas_bancarias': ['num_conta', 'descricao', 'num_carteiras', 'escrow', 'nome_cedente_escrow', 'cpf_cnpj_cedente_escrow', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'cedentes_completo': ['id_cedente', 'nome', 'cpf_cnpj', 'endereco', 'cep', 'cidade', 'uf', 'telefone', 'email', 'data_cadastro', 'primeira_operacao', 'vencimento_contrato', 'gerente', 'captador', 'operador', 'controlador', 'grupo_economico', 'setor', 'fonte_captacao', 'bloqueado', 'limite_global', 'limite_tranche', 'limite_boleto_garantido', 'limite_boleto_especial', 'limite_boleto_especial_tranche', 'limite_operacao_clean', 'limite_comissaria', 'fator', 'advalorem', 'risco_atual', 'saldo', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'operacoes_individualizadas': ['operacao', 'data', 'inicio', 'finalizacao', 'etapa', 'cedente', 'cpf_cnpj_cedente', 'captador', 'operador', 'valor_bruto', 'valor_liquido', 'valor_taxa', 'valor_tarifa', 'valor_iof', 'valor_receita', 'cred_cedente', 'valor_pagto_operacao', 'valor_recompra_repass', 'valor_pendencia', 'valor_saldo', 'prazo_medio', 'conta_pagto', 'pagamento_operacao', 'nfse', 'iss', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'receita_por_cedente': ['data_pagamento', 'cedente', 'cpf_cnpj', 'captador', 'operador', 'modalidade', 'desagio', 'juros', 'multas', 'tarifas', 'desconto', 'despesas_bancarias', 'taxas_administrativas', 'taxa', 'total', 'porcentagem', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'titulos_em_aberto': ['id_titulo', 'documento', 'tipo', 'cedente', 'cpf_cnpj_cedente', 'sacado', 'cpf_cnpj_sacado', 'valor', 'data_emissao', 'vencimento', 'conta', 'op', 'etapa', 'situacao', 'cr', 'historico', 'nosso_numero', 'm', 'conf', 'motivo', 'original', 'id_titulo_original', 'valor_juros', 'valor_multa', 'valor_tarifas', 'valor_total', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'titulos_prorrogados': ['numero', 'tipo', 'cedente', 'cpf_cnpj_cedente', 'sacado', 'cpf_cnpj_sacado', 'valor_face', 'emissao', 'vencimento', 'conta', 'data_prorrogacao', 'vencimento_anterior', 'valor_face_anterior', 'etapa', 'juros', 'multa', 'iof', 'tarifas', 'm', 'conf', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'titulos_quitados': ['numero', 'tipo', 'cedente', 'cpf_cnpj_cedente', 'sacado', 'cpf_cnpj_sacado', 'valor_face', 'emissao', 'vencimento', 'conta', 'quitacao', 'tipo_quitacao', 'valor_liquidado', 'valor_juros', 'valor_multa', 'valor_desconto', 'valor_tarifas', 'valor_tar_dev_cheque', 'valor_tar_recompra', 'valor_total', 'situacao', 'op', 'op_de_pagamento', 'nosso_numero', 'm', 'motivo_devolucao', 'categoria', 'classe_risco', 'status', 'observacao', 'banco_cobrador', 'agencia_cobradora', 'data_custodia', 'original', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'titulos_quitados_suspeita_fraude': ['numero_documento', 'cedente', 'cpf_cnpj_cedente', 'sacado', 'cpf_cnpj_sacado', 'valor', 'vencimento', 'data_quitacao', 'banco_cobrador', 'agencia_cobradora', 'praca_pagamento', 'localidade_sacado', 'criticas', 'dev_id', 'dev_created_at', 'dev_updated_at'],
  'titulos_recomprados': ['numero', 'tipo', 'cedente', 'cpf_cnpj_cedente', 'sacado', 'cpf_cnpj_sacado', 'valor_face', 'emissao', 'vencimento', 'conta', 'recompra', 'liquidado', 'juros', 'multa', 'desconto', 'tarifa', 'total', 'situacao', 'op', 'op_de_pagamento', 'nosso_numero', 'm', 'motivo', 'categoria', 'classe_risco', 'observacao', 'dev_id', 'dev_created_at', 'dev_updated_at'],
};

// Parse CSV content into array of objects
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
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
function mapColumnName(csvColumn: string, tableName: string): string | null {
  const allowedColumns = tableColumns[tableName] || [];
  
  // Standard mappings
  const mappings: Record<string, string> = {
    'id': 'dev_id',
    'created_at': 'dev_created_at',
    'updated_at': 'dev_updated_at',
  };
  
  const mapped = mappings[csvColumn] || csvColumn;
  
  // Check if column is allowed for this table
  if (allowedColumns.length > 0 && !allowedColumns.includes(mapped)) {
    return null; // Skip this column
  }
  
  return mapped;
}

// Clean and prepare row for insertion
function prepareRowForInsert(row: Record<string, string>, tableName: string): Record<string, unknown> {
  const prepared: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = mapColumnName(key, tableName);
    
    // Skip if column not allowed or empty value
    if (!mappedKey || value === '' || value === null || value === undefined) {
      continue;
    }
    
    // Handle numeric fields
    if (isNumericField(mappedKey)) {
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
function isNumericField(fieldName: string): boolean {
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
    const preparedRows = rows.map(row => prepareRowForInsert(row, tableName)).filter(row => Object.keys(row).length > 0);
    
    if (preparedRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, rowsInserted: 0, message: 'Nenhum dado válido para importar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Prepared ${preparedRows.length} rows for insertion`);
    console.log(`Sample row:`, JSON.stringify(preparedRows[0]));

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
