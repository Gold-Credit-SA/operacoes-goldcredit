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
  // Coobrigação assumida/recebida em R$ (valores monetários do SCR Bacen).
  coobAss: number;
  coobRec: number;
  // Contadores específicos do SCR (vinham sendo confundidos com coobAss/coobRec).
  qtdOps?: number;              // total de operações (mesmo que lsOp.length, mas oficial)
  qtdOpsDiscordancia?: number;  // operações em discordância
  qtdOpsSubJudice?: number;     // operações sub judice
  riscoDireto?: number;         // valor oficial vindo do payload Bacen (R$)
  lsOp: Operacao[];
}

export interface SCRResponse {
  cdCli: string;
  tpCli?: number;
  dtbConsult: string;
  name?: string;
  classificacao?: string;       // 'A'..'H' — Resolução 2.682 do Bacen
  lsDtb: DtbEntry[];
}
