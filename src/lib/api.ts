import { Cedente, ApiResponse } from '@/types/cedente';

const API_BASE_URL = 'http://localhost:3001/api';

export async function uploadSqlFile(file: File): Promise<ApiResponse<{ rowsAffected: number }>> {
  const formData = new FormData();
  formData.append('sqlFile', file);

  const response = await fetch(`${API_BASE_URL}/upload-sql`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function getCedentes(search?: string): Promise<ApiResponse<Cedente[]>> {
  const params = new URLSearchParams();
  if (search) {
    params.append('search', search);
  }

  const response = await fetch(`${API_BASE_URL}/cedentes?${params.toString()}`);
  return response.json();
}

export async function getCedenteById(id: number): Promise<ApiResponse<Cedente>> {
  const response = await fetch(`${API_BASE_URL}/cedentes/${id}`);
  return response.json();
}

export async function checkDatabaseConnection(): Promise<ApiResponse<{ connected: boolean }>> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}
