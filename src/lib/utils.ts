import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date string without timezone shifting.
 * Handles:
 *  - 'YYYY-MM-DD' (date-only) → treated as local date (no UTC shift)
 *  - 'DD/MM/YYYY' or 'DD-MM-YYYY' → local date
 *  - ISO with time (contains 'T') → native Date parsing
 *  - Date object → returned as-is
 */
export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;

  // ISO date-only: YYYY-MM-DD (no time component) — build as LOCAL date to avoid UTC shift
  const isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const y = +isoDateOnly[1], m = +isoDateOnly[2], d = +isoDateOnly[3];
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = +dmy[3];
    if (y < 100) y += 2000;
    const dt = new Date(y, +dmy[2] - 1, +dmy[1]);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Fallback (ISO with time, etc.)
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Format a date for pt-BR display without timezone shifting.
 * Returns the provided fallback when parsing fails.
 */
export function formatDateBR(value: string | Date | null | undefined, fallback = '—'): string {
  const dt = parseDateSafe(value);
  if (!dt) return fallback;
  return dt.toLocaleDateString('pt-BR');
}
