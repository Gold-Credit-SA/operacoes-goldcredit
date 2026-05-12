// Validações compartilhadas. Sempre que possível, validar ANTES
// de chamar a API paga — erro detectado aqui não custa nada.

export function normalizeDoc(input: string): string {
  return (input || '').replace(/\D/g, '');
}

export function isValidCpf(cpfRaw: string): boolean {
  const cpf = normalizeDoc(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i], 10) * (slice + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10);
}

export function isValidCnpj(cnpjRaw: string): boolean {
  const cnpj = normalizeDoc(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, ...weights1];
  const dv = (weights: number[], slice: number) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(cnpj[i], 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return dv(weights1, 12) === parseInt(cnpj[12], 10) && dv(weights2, 13) === parseInt(cnpj[13], 10);
}

export type DocKind = 'CPF' | 'CNPJ';

export function classifyDoc(doc: string): { kind: DocKind; clean: string } | null {
  const clean = normalizeDoc(doc);
  if (clean.length === 11 && isValidCpf(clean)) return { kind: 'CPF', clean };
  if (clean.length === 14 && isValidCnpj(clean)) return { kind: 'CNPJ', clean };
  return null;
}

// Valida data-base no formato 'YYYY-MM' e que seja <= mês corrente.
export function isValidBaseDate(input: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input || '')) return false;
  const [y, m] = input.split('-').map(Number);
  const now = new Date();
  const inputDate = new Date(y, m - 1, 1);
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  return inputDate <= cur;
}

export function monthOffsetISO(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function baseDateToDtb(baseDate: string): number {
  const [y, m] = baseDate.split('-');
  return parseInt(`${y}${m}`, 10);
}
