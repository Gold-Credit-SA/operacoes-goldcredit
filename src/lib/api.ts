import { supabase } from '@/integrations/supabase/client';
import { Cedente, ApiResponse } from '@/types/cedente';

export async function uploadSqlFile(file: File): Promise<ApiResponse<{ rowsAffected: number }>> {
  try {
    const sql = await file.text();
    
    const { data, error } = await supabase.functions.invoke('process-sql', {
      body: { action: 'import', sql }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function getCedentes(search?: string): Promise<ApiResponse<Cedente[]>> {
  try {
    const { data, error } = await supabase.functions.invoke('process-sql', {
      body: { action: 'list', search }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function getCedenteById(id: number): Promise<ApiResponse<Cedente>> {
  try {
    const { data, error } = await supabase.functions.invoke('process-sql', {
      body: { action: 'get', id }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function checkDatabaseConnection(): Promise<ApiResponse<{ connected: boolean }>> {
  try {
    const { data, error } = await supabase.functions.invoke('process-sql', {
      body: { action: 'list' }
    });

    if (error) {
      return { success: false, data: { connected: false }, error: error.message };
    }

    return { success: true, data: { connected: true } };
  } catch (err) {
    return { success: false, data: { connected: false }, error: (err as Error).message };
  }
}
