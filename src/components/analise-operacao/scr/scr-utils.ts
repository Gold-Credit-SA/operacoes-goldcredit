import { ResVenc, DtbEntry, Operacao } from './scr-types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Aceita "92.48", "92,48", 92.48 ou null e devolve "92,48%" (vírgula br).
 * Idempotente: já formatado vira o mesmo valor.
 */
export function formatPercentBR(input: string | number | null | undefined): string {
  if (input == null || input === '') return '—';
  const numeric = typeof input === 'number'
    ? input
    : parseFloat(String(input).replace(',', '.').replace('%', '').trim());
  if (!Number.isFinite(numeric)) return String(input);
  return `${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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

/**
 * Formata "2026-03" → "Mar/26", aceitando 1+ intervalos separados por vírgula
 * ("2025-11,2025-12,2026-03" → "Nov/25 a Mar/26"). Coerente com o PDF SCR.
 */
export function formatPeriodoConsultado(dtbConsult: string | undefined | null): string {
  if (!dtbConsult) return '-';
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const fmt = (s: string) => {
    const m = s.trim().match(/^(\d{4})-?(\d{2})$/);
    if (!m) return s.trim();
    return `${months[parseInt(m[2]) - 1]}/${m[1].slice(2)}`;
  };
  const parts = dtbConsult.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '-';
  if (parts.length === 1) return fmt(parts[0]);
  const sorted = [...parts].sort();
  return `${fmt(sorted[0])} a ${fmt(sorted[sorted.length - 1])}`;
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
  return (dtbEntry.lsOp || []).reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);
}

export function calcCarteiraAtiva(dtbEntry: DtbEntry): number {
  return (dtbEntry.lsOp || [])
    .filter(op => !isLimiteOp(op))
    .reduce((sum, op) => sum + calcTotalVenc(op.resVenc), 0);
}

/**
 * Risco Direto conforme PDF oficial do SCR/Bacen:
 * - Quando o payload Bacen traz `riscoDireto`, é a fonte da verdade.
 * - Fallback (cálculo): apenas buckets de PREJUÍZO (v205-v240) e vencidos
 *   pesados (v90-v100). NÃO inclui "a vencer" nem indeterminado.
 *
 * Para o caso GEOSUL (cliente sem inadimplência), o resultado deve ser R$ 0,00.
 */
export function calcRiscoDireto(dtbEntry: DtbEntry): number {
  if (typeof dtbEntry.riscoDireto === 'number') return dtbEntry.riscoDireto;
  return (dtbEntry.lsOp || [])
    .filter(op => !isLimiteOp(op))
    .reduce((sum, op) => {
      return sum + Object.entries(op.resVenc).reduce((acc, [bucket, val]) => {
        const num = parseInt(bucket.replace('v', ''));
        // Prejuízo: v205-v240. Vencidos pesados: v90, v100. Coerente com PDF SCR.
        if ((num >= 205 && num <= 240) || num === 90 || num === 100) {
          return acc + (val || 0);
        }
        return acc;
      }, 0);
    }, 0);
}

// Separate vencido (overdue) buckets from a-vencer (upcoming) buckets
// Vencidos: v10-v100 (overdue periods ONLY)
// A vencer: v110-v200 (upcoming maturity periods)
// Indeterminado: v250/v255/v260 (prazo indeterminado — NOT overdue, separate category)
export function separateVencBuckets(resVenc: ResVenc): { vencidos: Record<string, number>; aVencer: Record<string, number>; indeterminado: Record<string, number> } {
  const vencidos: Record<string, number> = {};
  const aVencer: Record<string, number> = {};
  const indeterminado: Record<string, number> = {};
  const INDETERMINATE_BUCKETS = ['v250', 'v255', 'v260'];
  
  Object.entries(resVenc).forEach(([key, val]) => {
    const num = parseInt(key.replace('v', ''));
    if (INDETERMINATE_BUCKETS.includes(key)) {
      indeterminado[key] = val;
    } else if (num <= 100) {
      vencidos[key] = val;
    } else {
      aVencer[key] = val;
    }
  });
  
  return { vencidos, aVencer, indeterminado };
}

/**
 * Determines if an operation is a credit limit.
 * 
 * 1909, 1905: ALWAYS limits (known limit-only modal codes).
 * 0208 (Cheque especial), 0214 (Cheque especial), 0207 (Cartão de crédito):
 *   These are limits ONLY when they have no "a vencer" buckets (v110+).
 *   When they DO have a-vencer buckets, they represent active credit usage.
 * All other mod codes: NEVER limits. A fully overdue loan (only vencido buckets)
 *   is still a credit operation, not a limit.
 */
export function isLimiteOp(op: Operacao): boolean {
  const ALWAYS_LIMITE = ['1909', '1905'];
  if (ALWAYS_LIMITE.includes(op.mod)) return true;
  
  // Mod codes that can be either limit or active credit
  const CONDITIONAL_LIMITE = ['0208', '0214', '0207', '1901', '1902', '1903', '1904'];
  if (CONDITIONAL_LIMITE.includes(op.mod)) {
    const hasAVencer = Object.entries(op.resVenc).some(([k, v]) => {
      const num = parseInt(k.replace('v', ''));
      return num >= 110 && num < 250 && v > 0;
    });
    // If no a-vencer buckets with value > 0, it's a limit
    return !hasAVencer;
  }
  
  return false;
}
