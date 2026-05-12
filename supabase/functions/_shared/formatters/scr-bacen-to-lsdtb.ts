// Conversor da resposta BACEN da HBI (verbose) para o formato
// interno compacto (lsDtb / lsOp / resVenc) consumido pelo frontend.
//
// Mapeamento baseado na documentação Postman da HBI
// (endpoint 2.5.7 - /query/bacen/{uuidQuery}). Campos ausentes na
// resposta BACEN documentada (oriRec, indx, segmento) ficam como
// string vazia — a tela SCR os trata como opcionais.
//
// IMPORTANTE: este conversor preserva o payload bruto via
// `__raw` no resultado, permitindo reprocessar sem nova chamada
// paga caso este parser precise ajustes.

export interface ScrLsDtbResult {
  cdCli: string;
  tpCli?: number;
  dtbConsult: string;
  name?: string;
  classificacao?: string;
  lsDtb: Array<{
    dtb: number;
    docProc: string;
    volProc: string;
    qtdIfs: number;
    qtdCongFinc?: number;
    dtbIniRel: string;
    coobAss: number;
    coobRec: number;
    qtdOps?: number;
    qtdOpsDiscordancia?: number;
    qtdOpsSubJudice?: number;
    riscoDireto?: number;
    lsOp: Array<{
      mod: string;
      oriRec: string;
      indx: string;
      varCamb: string;
      segmento: string;
      resVenc: Record<string, number>;
      lsGar?: Array<{ tp: string; qtd: number }>;
    }>;
  }>;
  // Resposta crua preservada — fonte da verdade caso o parser tenha bug
  __raw?: unknown;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function baseDateToDtbNumber(baseDate: string | undefined | null): number {
  if (!baseDate) return 0;
  const m = baseDate.match(/^(\d{4})-?(\d{2})$/);
  if (!m) return 0;
  return parseInt(`${m[1]}${m[2]}`, 10);
}

interface BacenResumoOperacao {
  modalidade?: string;
  variacaoCambial?: string;
  origemRecursos?: string;
  indexador?: string;
  segmento?: string;
  listaDeVencimentos?: Array<{
    codigoVencimento?: string;
    valorVencimento?: string | number;
  }>;
  listaDeGarantias?: Array<{ tipoGarantia?: string; quantidade?: number }>;
}

interface BacenDados {
  codigoDoCliente?: string;
  documentId?: string;
  tipoDoCliente?: string | number;
  nome?: string;
  nomeCliente?: string;
  classificacaoRisco?: string;
  classificacaoDeRisco?: string;
  dataBaseConsultada?: string;
  dataInicioRelacionamento?: string;
  coobrigacaoAssumida?: string | number;
  coobrigacaoRecebida?: string | number;
  percentualDocumentosProcessados?: string;
  percentualVolumeProcessado?: string;
  quantidadeDeInstituicoes?: string | number;
  quantidadeDeOperacoes?: string | number;
  quantidadeOperacoesDiscordancia?: string | number;
  quantidadeOperacoesSubJudice?: string | number;
  responsabilidadeTotal?: string | number;
  responsabilidadeTotalDiscordancia?: string | number;
  responsabilidadeTotalSubJudice?: string | number;
  riscoDireto?: string | number;
  riscoIndiretoVendor?: string | number;
  listaDeResumoDasOperacoes?: BacenResumoOperacao[];
}

// Aceita o envelope completo da HBI (`{data: {dados: {...}}}`)
// ou apenas o nó `dados`.
export function convertBacenToLsDtb(raw: unknown): ScrLsDtbResult | null {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const dados = (data.dados ?? data) as BacenDados;

  if (!dados || (!dados.codigoDoCliente && !dados.documentId)) {
    return null;
  }

  const cdCli = String(dados.codigoDoCliente || dados.documentId || '').replace(/\D/g, '');
  const baseDate = dados.dataBaseConsultada || '';
  const dtbNum = baseDateToDtbNumber(baseDate);

  const lsOp = (dados.listaDeResumoDasOperacoes || []).map(op => {
    const resVenc: Record<string, number> = {};
    for (const v of op.listaDeVencimentos || []) {
      if (!v?.codigoVencimento) continue;
      resVenc[v.codigoVencimento] = toNumber(v.valorVencimento);
    }
    const lsGar = (op.listaDeGarantias || [])
      .filter(g => g.tipoGarantia)
      .map(g => ({ tp: String(g.tipoGarantia), qtd: toNumber(g.quantidade) }));

    return {
      mod: String(op.modalidade || '').padStart(4, '0'),
      oriRec: String(op.origemRecursos || ''),
      indx: String(op.indexador || ''),
      varCamb: String(op.variacaoCambial || 'N'),
      segmento: String(op.segmento || ''),
      resVenc,
      ...(lsGar.length > 0 ? { lsGar } : {}),
    };
  });

  const result: ScrLsDtbResult = {
    cdCli,
    tpCli: dados.tipoDoCliente != null ? Number(dados.tipoDoCliente) : undefined,
    dtbConsult: baseDate,
    name: (dados.nomeCliente || dados.nome || undefined) as string | undefined,
    classificacao: (dados.classificacaoRisco || dados.classificacaoDeRisco) as string | undefined,
    lsDtb: [
      {
        dtb: dtbNum,
        docProc: String(dados.percentualDocumentosProcessados ?? ''),
        volProc: String(dados.percentualVolumeProcessado ?? ''),
        qtdIfs: Number(dados.quantidadeDeInstituicoes ?? 0),
        dtbIniRel: String(dados.dataInicioRelacionamento ?? ''),
        coobAss: toNumber(dados.coobrigacaoAssumida),
        coobRec: toNumber(dados.coobrigacaoRecebida),
        qtdOps: dados.quantidadeDeOperacoes != null ? Number(dados.quantidadeDeOperacoes) : undefined,
        qtdOpsDiscordancia: dados.quantidadeOperacoesDiscordancia != null ? Number(dados.quantidadeOperacoesDiscordancia) : undefined,
        qtdOpsSubJudice: dados.quantidadeOperacoesSubJudice != null ? Number(dados.quantidadeOperacoesSubJudice) : undefined,
        riscoDireto: dados.riscoDireto != null ? toNumber(dados.riscoDireto) : undefined,
        lsOp,
      },
    ],
    __raw: raw,
  };

  return result;
}

// Permite mesclar múltiplas respostas BACEN (DETALHADA = 5 meses → 5 chamadas).
// Cada chamada tem 1 base date; merge agrega em `lsDtb` ordenado por data crescente.
export function mergeBacenResults(results: ScrLsDtbResult[]): ScrLsDtbResult | null {
  const valid = results.filter(r => r && r.lsDtb?.length > 0);
  if (valid.length === 0) return null;

  const first = valid[0];
  const merged: ScrLsDtbResult = {
    cdCli: first.cdCli,
    tpCli: first.tpCli,
    name: first.name,
    classificacao: first.classificacao,
    dtbConsult: valid.map(r => r.dtbConsult).filter(Boolean).join(','),
    lsDtb: valid
      .flatMap(r => r.lsDtb)
      .sort((a, b) => a.dtb - b.dtb),
    __raw: valid.map(r => r.__raw),
  };
  return merged;
}
