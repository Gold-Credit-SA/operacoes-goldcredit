import type { NotaFiscalXml } from './xml-nfe-parser';

/**
 * Parses DANFE PDF extracted text into a structured NotaFiscalXml.
 * The DANFE has a fixed layout — we use regex anchors on known labels.
 * Returns null if the text doesn't look like a DANFE.
 */
export function parseDanfePdfText(text: string): NotaFiscalXml | null {
  // Sanity check — must look like DANFE
  if (!/DANFE|Documento Auxiliar.*Nota Fiscal Eletr/i.test(text)) {
    return null;
  }

  const norm = text.replace(/\s+/g, ' ').trim();

  // Chave de acesso (44 dígitos, podendo vir separados por espaços)
  const chaveMatch = norm.match(/CHAVE DE ACESSO[\s:]*((?:\d[\s.]*){44})/i)
    || norm.match(/(\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/);
  const chaveAcesso = chaveMatch ? chaveMatch[1].replace(/\D/g, '').slice(0, 44) : '';

  // Número e série (Nº 2.447  Série 1)
  const numMatch = norm.match(/N[ºo°]\.?\s*([\d.]+)\s*S[ée]rie\s*(\d+)/i);
  const numero = numMatch ? numMatch[1].replace(/\./g, '') : '';
  const serie = numMatch ? numMatch[2] : '';

  // Data de emissão dd/mm/yyyy próxima a "DATA DA EMISSÃO" ou "DATA DE EMISSÃO"
  const emissaoMatch = norm.match(/DATA D[AE]\s*EMISS[ÃA]O[^0-9]*(\d{2}\/\d{2}\/\d{4})/i)
    || norm.match(/(\d{2}\/\d{2}\/\d{4})\s*DATA DA SA[ÍI]DA/i);
  const dataEmissao = emissaoMatch ? toIsoDate(emissaoMatch[1]) : '';

  // Valor total da nota
  const valor = pickValor(norm);

  // Emitente — bloco entre "IDENTIFICAÇÃO DO EMITENTE" e "DANFE" (cabeçalho) ou "NATUREZA DA OPERAÇÃO"
  const emitBlock = sliceBetween(text, /IDENTIFICA[ÇC][ÃA]O DO EMITENTE/i, /DANFE|NATUREZA DA OPERA[ÇC][ÃA]O/i);
  const emitCnpj = pickDocumento(emitBlock || text, /CNPJ[\s:]*([\d./-]{14,20})/i);
  const emitNome = pickEmitNome(emitBlock || text);

  // Destinatário (sacado)
  const destBlock = sliceBetween(text, /DESTINAT[ÁA]RIO\s*\/\s*REMETENTE/i, /FATURA|DUPLICATA|C[ÁA]LCULO DO IMPOSTO|DADOS DOS PRODUTOS/i);
  if (!destBlock) return null;

  const destDoc = pickDocumento(destBlock, /CNPJ\s*\/\s*CPF[^\d]*([\d./-]{11,20})/i)
    || pickDocumento(destBlock, /\b(\d{2,3}[.\s]\d{3}[.\s]\d{3}[/-]?\d{2,4}[-.\s]?\d{0,2})\b/);

  const destNome = pickDestNome(destBlock);

  if (!destDoc || !destNome) return null;

  return {
    numero,
    serie,
    chaveAcesso,
    valor,
    dataEmissao,
    emitente: {
      cpfCnpj: onlyDigits(emitCnpj),
      nome: emitNome,
    },
    sacado: {
      cpfCnpj: onlyDigits(destDoc),
      nome: destNome,
      endereco: pickAddress(destBlock),
      cidade: pickField(destBlock, /MUNIC[ÍI]PIO[\s\S]{0,80}?\n?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s'.-]{2,40})/i),
      estado: pickField(destBlock, /\bUF\b[\s\S]{0,40}?\b([A-Z]{2})\b/),
      cep: pickField(destBlock, /CEP[\s:]*([\d.-]{8,12})/i),
      email: pickField(destBlock, /e-?mail[\s:]*([^\s,;]+@[^\s,;]+)/i),
      telefone: pickField(destBlock, /FONE\s*\/?\s*FAX?[\s:]*\(?(\d[\d\s().-]{6,20})/i),
    },
  };
}

function toIsoDate(br: string): string {
  const [d, m, y] = br.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

function sliceBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = text.match(start);
  if (!startMatch || startMatch.index === undefined) return '';
  const after = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = after.match(end);
  return endMatch && endMatch.index !== undefined ? after.slice(0, endMatch.index) : after.slice(0, 1500);
}

function pickValor(norm: string): number {
  // Procura "VALOR TOTAL DA NOTA" e captura o próximo número formatado pt-BR
  const m = norm.match(/VALOR\s+TOTAL\s+DA\s+NOTA[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (m) return parseBrlNumber(m[1]);
  // fallback: vNF
  const m2 = norm.match(/vNF[\s:]*(\d+[.,]\d{2})/i);
  if (m2) return parseBrlNumber(m2[1]);
  return 0;
}

function parseBrlNumber(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function pickDocumento(block: string, re: RegExp): string {
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function pickField(block: string, re: RegExp): string {
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function pickEmitNome(block: string): string {
  // Captura primeira linha "longa" em maiúsculas após o cabeçalho
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^[A-ZÀ-Ÿ0-9&.,'\- ]{6,}$/.test(line) && !/IDENTIFICA|EMITENTE|DANFE|CNPJ|INSCRI/i.test(line)) {
      return line;
    }
  }
  return '';
}

function pickDestNome(block: string): string {
  // No DANFE, costuma vir após "NOME / RAZÃO SOCIAL"
  const m = block.match(/NOME\s*\/?\s*RAZ[ÃA]O\s+SOCIAL[\s:]*([^\n\r]{3,120})/i);
  if (m) return m[1].trim();
  // fallback: primeira linha em caixa alta logo após "DESTINATÁRIO"
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^[A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9&.,'\- ]{4,}$/.test(line) && !/CNPJ|CPF|ENDERE|BAIRRO|MUNIC|DESTINAT/i.test(line)) {
      return line;
    }
  }
  return '';
}

function pickAddress(block: string): string {
  const m = block.match(/ENDERE[ÇC]O[\s:]*([^\n\r]{3,200})/i);
  return m ? m[1].trim() : '';
}
