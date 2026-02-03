export interface DocumentoAnalisado {
  id: string;
  nomeArquivo: string;
  tipoDocumento: 'VADU' | 'SCR' | 'SERASA' | 'OUTRO';
  status: 'processando' | 'concluido' | 'erro';
  dataUpload: Date;
  dados?: DadosExtraidos;
  erro?: string;
}

export interface DadosExtraidos {
  tipoDocumento: 'VADU' | 'SCR' | 'SERASA' | 'OUTRO';
  dataConsulta: string;
  identificacao: {
    cpfCnpj: string;
    nome: string;
    situacaoReceita?: string;
    dataAbertura?: string;
    dataNascimento?: string;
    nomeMae?: string;
    endereco?: string;
    capitalSocial?: number;
  };
  score?: {
    valor: number;
    faixa?: string;
    descricao?: string;
    probabilidadePagamento?: number;
    fonte?: string;
  };
  restricoes: {
    protestos: Restricao[];
    chequesSemFundo: Restricao[];
    anotacoesNegativas: Restricao[];
    acoesCiveisFalencia?: Restricao[];
    totalDividas: number;
    possuiRestricao: boolean;
  };
  comportamentoFinanceiro?: {
    carteira?: {
      aVencer: number;
      vencido: number;
      prejuizo: number;
      total: number;
    };
    modalidades?: ModalidadeCredito[];
    classificacaoRisco?: string;
    ilm?: number;
  };
  participacoesSocietarias?: ParticipacaoSocietaria[];
  consultas?: ConsultaRecente[];
  sancoes?: {
    nacionais: boolean;
    internacionais: boolean;
    detalhes?: string;
  };
}

export interface Restricao {
  tipo: string;
  valor: number;
  data?: string;
  credor?: string;
  cidade?: string;
  quantidade?: number;
}

export interface ModalidadeCredito {
  nome: string;
  aVencer: number;
  vencido: number;
  prejuizo: number;
}

export interface ParticipacaoSocietaria {
  cnpj: string;
  razaoSocial: string;
  participacao?: number;
  situacao?: string;
  dataEntrada?: string;
}

export interface ConsultaRecente {
  data: string;
  origem?: string;
  quantidade?: number;
}
