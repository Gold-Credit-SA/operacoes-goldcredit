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
  '0213': 'Microcrédito',
  '0214': 'Cheque especial',
  '0301': 'Direitos creditórios descontados',
  '0302': 'Desconto de duplicatas',
  '0303': 'Desconto de cheques',
  '0401': 'Financiamento imobiliário',
  '0402': 'Financiamento de veículos',
  '0403': 'Financiamento rural',
  '0404': 'Financiamento de máquinas e equipamentos',
  '0405': 'Financiamento de infraestrutura',
  '1304': 'Capital de giro com prazo de vencimento até 365 dias',
  '1305': 'Capital de giro com prazo de vencimento superior a 365 dias',
  '1901': 'Outros créditos',
  '1902': 'Outros empréstimos',
  '1903': 'Outros títulos descontados',
  '1904': 'Outros financiamentos',
  '1905': 'Capital de giro com teto rotativo',
  '1909': 'Cheque especial / Cartão de crédito',
};

// Vencimento labels - short form matching HBI PDF
export const VENCIMENTO_AVENCER_MAP: Record<string, string> = {
  'v110': '30 Dias',
  'v120': '31 a 60 Dias',
  'v130': '61 a 90 Dias',
  'v140': '91 a 180 Dias',
  'v150': '181 a 360 Dias',
  'v160': '361 a 720 Dias',
  'v170': '721 a 1080 Dias',
  'v180': '1081 a 1440 Dias',
  'v190': '1441 a 1800 Dias',
  'v200': 'Acima de 1800 Dias',
};

export const VENCIMENTO_VENCIDO_MAP: Record<string, string> = {
  'v10': 'Vencidos há mais de 15 dias',
  'v20': 'Vencidos até 15 dias',
  'v30': 'Vencidos de 1 a 30 dias',
  'v40': 'Vencidos de 31 a 60 dias',
};

// Labels específicos para operações de LIMITE (buckets têm semântica diferente)
export const VENCIMENTO_LIMITE_MAP: Record<string, string> = {
  'v10': 'Limite com vencimento acima de 360 dias',
  'v20': 'Limite com vencimento até 360 dias',
  'v30': 'Limite com vencimento até 360 dias',
  'v40': 'Limite com vencimento acima de 360 dias',
  'v110': 'Limite com vencimento até 30 dias',
  'v120': 'Limite com vencimento de 31 a 60 dias',
  'v130': 'Limite com vencimento de 61 a 90 dias',
  'v140': 'Limite com vencimento de 91 a 180 dias',
  'v150': 'Limite com vencimento de 181 a 360 dias',
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
  limite: 'Limite',
};

export function getModalidadeCategory(mod: string): CategoryKey {
  const LIMITE_MODS = ['1909', '0208', '0214', '1905'];
  if (LIMITE_MODS.includes(mod)) return 'limite';
  const code = parseInt(mod);
  if (code >= 200 && code < 300) return 'emprestimos';
  if (code >= 300 && code < 400) return 'titulos_descontados';
  if (code >= 400 && code < 500) return 'financiamentos';
  if (code >= 1300 && code < 1400) return 'outros_creditos';
  if (code >= 1900 && code < 2000) return 'outros_creditos';
  return 'outros_creditos';
}

export function getModalidadeLabel(mod: string): string {
  return MODALIDADE_MAP[mod] || `Modalidade ${mod}`;
}
