// Shared helpers for cobrança module
export const fmtBRL = (v: number | null | undefined) =>
  (Number(v ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return String(d); }
};

export const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return String(d); }
};

export const onlyDigits = (s: string) => (s ?? "").replace(/\D+/g, "");

export const formatCpfCnpj = (s: string) => {
  const d = onlyDigits(s);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s;
};

export type Titulo = {
  numero_titulo: string;
  id_titulo?: string | null;
  nosso_numero?: string | null;
  sacado_cpf_cnpj: string;
  sacado_nome: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string;
  valor: number;
  vencimento: string | null;
  dias_atraso: number;
  telefone?: string;
  email?: string;
  status?: string;
  ultimo_contato_at?: string;
  faixa_id?: string;
  faixa_nome?: string;
  faixa_canal?: string;
  faixa_template_id?: string;
  tem_promessa?: boolean;
  promessa_data?: string;
};

export type Template = {
  id: string;
  nome: string;
  mensagem: string;
  canal: string;
  assunto?: string | null;
};

export type Regua = {
  id: string;
  nome: string;
  dias_min: number;
  dias_max: number | null;
  canal: string;
  template_id: string | null;
  ordem: number;
  ativo: boolean;
};
