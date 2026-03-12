import { Operacao } from './scr-types';

// SCR Modalidade codes to labels
export const MODALIDADE_MAP: Record<string, string> = {
  '0201': 'Adiantamentos a depositantes',
  '0202': 'Empréstimos',
  '0203': 'Títulos descontados',
  '0204': 'Antecipação de fatura de cartão de crédito',
  '0205': 'Aquisição de recebíveis',
  '0206': 'Avais e fianças',
  '0207': 'Cartão de crédito - compra',
  '0208': 'Cheque especial e conta garantida',
  '0209': 'Crédito pessoal consignado',
  '0210': 'Crédito pessoal sem consignação',
  '0211': 'Crédito rotativo',
  '0212': 'Financiamento imobiliário',
  '0213': 'Empréstimos Cheque especial',
  '0214': 'Cheque especial',
  '0215': 'Empréstimos Capital de giro com prazo de vencimento até 365 dias',
  '0217': 'Empréstimos Capital de giro com teto rotativo',
  '0299': 'Empréstimos Outros empréstimos',
  '0301': 'Títulos descontado Direitos creditorios descontados Desconto de duplicatas',
  '0302': 'Desconto de duplicatas',
  '0303': 'Desconto de cheques',
  '0399': 'Títulos descontado Direitos creditorios descontados Outros títulos descontados',
  '0401': 'Financiamento imobiliário',
  '0402': 'Financiamento de veículos',
  '0403': 'Financiamento rural',
  '0404': 'Financiamento de máquinas e equipamentos',
  '0405': 'Financiamento de infraestrutura',
  '0499': 'Outros financiamentos',
  '1304': 'Outros créditos Cartão de crédito - compra à vista e parcelado lojista',
  '1305': 'Capital de giro com prazo de vencimento superior a 365 dias',
  '1901': 'Outros créditos',
  '1902': 'Outros empréstimos',
  '1903': 'Outros títulos descontados',
  '1904': 'Outros financiamentos',
  '1905': 'Capital de giro com teto rotativo',
  '1909': 'Cheque especial / Cartão de crédito',
};

// Vencimento labels for CARTEIRA ATIVA table
export const VENCIMENTO_AVENCER_MAP: Record<string, string> = {
  'v110': '30 Dias',
  'v120': '31 a 60 Dias',
  'v130': '61 a 90 Dias',
  'v140': '91 a 180 Dias',
  'v150': '181 a 360 Dias',
  'v160': '361 a 720 Dias',
  'v165': 'Acima de 720 Dias',
  'v170': '721 a 1080 Dias',
  'v175': '1081 a 1440 Dias',
  'v180': '1441 a 1800 Dias',
  'v190': '1801 a 5400 Dias',
  'v200': 'Acima de 5400 Dias',
  'v250': 'Prazo Indeterminado',
  'v255': 'Prazo Indeterminado (curto)',
  'v260': 'Prazo Indeterminado (longo)',
};

export const VENCIMENTO_VENCIDO_MAP: Record<string, string> = {
  'v10': 'Vencidos há mais de 15 dias',
  'v20': 'Vencidos até 15 dias',
  'v30': 'Vencidos de 1 a 30 dias',
  'v40': 'Vencidos de 31 a 60 dias',
};

// Labels for DETALHAMENTO table - same as carteira (HBI uses same labels)
export const VENCIMENTO_DETALHE_MAP: Record<string, string> = {
  'v10': 'Vencidos há mais de 15 dias',
  'v20': 'Vencidos até 15 dias',
  'v30': 'Vencidos de 1 a 30 dias',
  'v40': 'Vencidos de 31 a 60 dias',
  'v110': '30 Dias',
  'v120': '31 a 60 Dias',
  'v130': '61 a 90 Dias',
  'v140': '91 a 180 Dias',
  'v150': '181 a 360 Dias',
  'v160': '361 a 720 Dias',
  'v165': 'Acima de 720 Dias',
  'v170': '721 a 1080 Dias',
  'v175': '1081 a 1440 Dias',
  'v180': '1441 a 1800 Dias',
  'v190': '1801 a 5400 Dias',
  'v200': 'Acima de 5400 Dias',
  'v250': 'Prazo Indeterminado',
  'v255': 'Prazo Indeterminado (curto)',
  'v260': 'Prazo Indeterminado (longo)',
};

// Labels específicos para operações de LIMITE no DETALHAMENTO
export const VENCIMENTO_LIMITE_MAP: Record<string, string> = {
  'v10': 'Limite com vencimento acima de 360 dias',
  'v20': 'Limite com vencimento até 360 dias',
  'v30': 'Limite com vencimento até 360 dias',
  'v40': 'Limite com vencimento acima de 360 dias',
  'v110': 'Limite com vencimento até 360 dias',
  'v120': 'Limite com vencimento até 360 dias',
  'v130': 'Limite com vencimento até 360 dias',
  'v140': 'Limite com vencimento até 360 dias',
  'v150': 'Limite com vencimento até 360 dias',
  'v160': 'Limite com vencimento acima de 360 dias',
};

export const SEGMENTO_MAP: Record<string, string> = {
  '01': 'PF',
  '02': 'PJ',
  '03': 'PJ - Pequeno Porte',
};

export const ORI_REC_MAP: Record<string, string> = {
  '0101': 'Recursos livres',
  '0199': 'Outros recursos livres',
  '0201': 'Recursos direcionados',
};

// Category grouping for operations
export type CategoryKey = 'emprestimos' | 'titulos_descontados' | 'financiamentos' | 'outros_creditos' | 'limite';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  emprestimos: 'Empréstimos',
  titulos_descontados: 'Títulos Descontados',
  financiamentos: 'Financiamentos',
  outros_creditos: 'Outros Créditos',
  limite: 'Limites de Crédito',
};

// Shorter labels for sub-modalidade display under Limite category
export const LIMITE_SUB_LABELS: Record<string, string> = {
  '0208': 'Cheque especial',
  '0214': 'Cheque especial',
  '0207': 'Cartão de Crédito',
  '1909': 'Descontos',
  '1905': 'Capital de giro rotativo',
  '1901': 'Outros créditos',
  '1902': 'Outros empréstimos',
  '1904': 'Outros financiamentos',
};

// Sort priority within each category (lower = first). Unlisted mods go to 9999.
export const CATEGORY_SORT_ORDER: Record<string, number> = {
  // Empréstimos
  '0213': 1, '0215': 2, '0217': 3, '0299': 99,
  // Títulos Descontados
  '0301': 1, '0399': 99,
  // Financiamentos
  '0499': 99,
  // Outros Créditos
  '1304': 1,
};

export function getModalidadeCategory(mod: string): CategoryKey {
  const code = parseInt(mod);
  if (code >= 200 && code < 300) return 'emprestimos';
  if (code >= 300 && code < 400) return 'titulos_descontados';
  if (code >= 400 && code < 500) return 'financiamentos';
  if (code >= 1300 && code < 1400) return 'outros_creditos';
  if (code >= 1900 && code < 2000) return 'outros_creditos';
  return 'outros_creditos';
}

/**
 * Returns the category for display purposes.
 * For limite operations, always returns 'limite' regardless of mod code range.
 */
export function getDisplayCategory(mod: string, isLimite: boolean): CategoryKey {
  if (isLimite) return 'limite';
  return getModalidadeCategory(mod);
}

export function getModalidadeLabel(mod: string): string {
  return MODALIDADE_MAP[mod] || `Modalidade ${mod}`;
}

export function sortOpsByPriority(ops: Operacao[]): Operacao[] {
  return [...ops].sort((a, b) => {
    const pa = CATEGORY_SORT_ORDER[a.mod] ?? 9999;
    const pb = CATEGORY_SORT_ORDER[b.mod] ?? 9999;
    return pa - pb;
  });
}
