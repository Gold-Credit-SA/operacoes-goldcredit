export interface Cedente {
  id: number;
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
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
