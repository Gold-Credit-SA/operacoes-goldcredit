export interface ResVenc {
  [key: string]: number;
}

export interface Operacao {
  mod: string;
  oriRec: string;
  indx: string;
  varCamb: string;
  segmento: string;
  resVenc: ResVenc;
  lsGar?: Array<{ tp: string; qtd: number }>;
}

export interface DtbEntry {
  dtb: number;
  docProc: string;
  volProc: string;
  qtdIfs: number;
  qtdCongFinc?: number;
  dtbIniRel: string;
  coobAss: number;
  coobRec: number;
  lsOp: Operacao[];
}

export interface SCRResponse {
  cdCli: string;
  tpCli?: number;
  dtbConsult: string;
  name?: string;
  lsDtb: DtbEntry[];
}
