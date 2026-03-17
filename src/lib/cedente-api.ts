import { supabase } from '@/integrations/supabase/client';

export interface CedenteCadastroResumo {
  id?: number;
  nome: string;
  cpf_cnpj: string;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

function normalizarDocumento(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '');
}

function mapCedente(row: Record<string, unknown>): CedenteCadastroResumo {
  return {
    id: typeof row.id_cedente === 'number' ? row.id_cedente : undefined,
    nome: String(row.nome || '').trim(),
    cpf_cnpj: String(row.cpf_cnpj || ''),
    email: typeof row.email === 'string' ? row.email : null,
    telefone: typeof row.telefone === 'string' ? row.telefone : null,
    cidade: typeof row.cidade === 'string' ? row.cidade : null,
    uf: typeof row.uf === 'string' ? row.uf : null,
  };
}

export async function buscarCedentesCadastrados(searchTerm: string) {
  const termo = searchTerm.trim();
  if (termo.length < 2) {
    return [] as CedenteCadastroResumo[];
  }

  const { data, error } = await supabase.functions.invoke('external-db', {
    body: { action: 'cedentes-list', filters: { search: termo } },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Nao foi possivel consultar os cedentes cadastrados.');
  }

  const rows = Array.isArray(data.data) ? data.data : [];

  return rows
    .map((row) => mapCedente(row as Record<string, unknown>))
    .filter((row) => row.nome || row.cpf_cnpj)
    .slice(0, 20);
}

export async function buscarCedentePorDocumento(cpfCnpj: string) {
  const documento = normalizarDocumento(cpfCnpj);

  if (!documento) {
    throw new Error('CPF/CNPJ do cedente nao informado.');
  }

  const { data, error } = await supabase.functions.invoke('external-db', {
    body: { action: 'cedente-info', filters: { cpf_cnpj: documento } },
  });

  if (error) {
    throw error;
  }

  if (!data?.success || !data?.data?.cedente) {
    throw new Error(data?.error || 'Nao foi possivel carregar os dados do cedente.');
  }

  return mapCedente(data.data.cedente as Record<string, unknown>);
}
