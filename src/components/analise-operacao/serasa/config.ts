export type SerasaDocumentType = 'cpf' | 'cnpj';

export interface SerasaConsultaConfig {
  id: string;
  label: string;
  documentType: SerasaDocumentType;
}

export const SERASA_CONSULTAS: SerasaConsultaConfig[] = [
  {
    id: 'serasa_basico_pj',
    label: 'Relatorio Basico PJ (Serasa)',
    documentType: 'cnpj',
  },
  {
    id: 'serasa_avancado_pj_analitico',
    label: 'Relatorio Avancado PJ Analitico (Serasa)',
    documentType: 'cnpj',
  },
  {
    id: 'serasa_basico_pf',
    label: 'Relatorio Basico PF (Serasa)',
    documentType: 'cpf',
  },
  {
    id: 'serasa_avancado_top_score_pf',
    label: 'Relatorio Avancado Top Score PF (Serasa)',
    documentType: 'cpf',
  },
];

export function isSerasaConsulta(id: string): boolean {
  return SERASA_CONSULTAS.some((item) => item.id === id);
}

export function getSerasaConsultaConfig(id: string): SerasaConsultaConfig | undefined {
  return SERASA_CONSULTAS.find((item) => item.id === id);
}
