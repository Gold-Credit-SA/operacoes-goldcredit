import { ResVenc, DtbEntry, Operacao } from './scr-types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDtb(dtb: number): string {
  const str = String(dtb);
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year}`;
}

export function formatDate(date: string): string {
  if (!date) return '-';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cnpj;
}

export function getRaizDocumento(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) return digits.slice(0, 8);
  return digits;
}

export function calcTotalVenc(resVenc: ResVenc): number {
  return Object.values(resVenc).reduce((sum, v) => sum + (v || 0), 0);
}

export function calcTotalAVencer(dtbEntry: DtbEntry): number {
  return dtbEntry.lsOp.reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);
}

// Separate vencido (overdue) buckets from a-vencer (upcoming) buckets
export function separateVencBuckets(resVenc: ResVenc): { vencidos: Record<string, number>; aVencer: Record<string, number> } {
  const vencidos: Record<string, number> = {};
  const aVencer: Record<string, number> = {};
  
  Object.entries(resVenc).forEach(([key, val]) => {
    const num = parseInt(key.replace('v', ''));
    if (num <= 100) {
      vencidos[key] = val;
    } else {
      aVencer[key] = val;
    }
  });
  
  return { vencidos, aVencer };
}

/**
 * Determines if an operation is a credit limit.
 * 
 * Known limit mod codes: 1909, 1905 are ALWAYS limits.
 * For other mod codes (0208, 0214, 0207, and any others):
 * - If the operation has ONLY low-number buckets (v10-v100) and NO "a vencer" 
 *   buckets (v110+), it represents a credit limit, not an overdue credit.
 *   This is because real credit operations always have "a vencer" buckets.
 * - If it has v110+ buckets, it's a real credit operation (may have overdue portions).
 */
export function isLimiteOp(op: Operacao): boolean {
  const ALWAYS_LIMITE = ['1909', '1905', '0208', '0214', '0207'];
  if (ALWAYS_LIMITE.includes(op.mod)) return true;
  
  // Any operation with ONLY low buckets (v10-v100) and NO a-vencer buckets (v110+)
  // is a credit limit, not an overdue credit
  const hasAVencer = Object.keys(op.resVenc).some(k => {
    const num = parseInt(k.replace('v', ''));
    return num >= 110;
  });
  
  // If no a-vencer buckets exist, this is a limit operation
  if (!hasAVencer) return true;
  
  return false;
}
