export interface SacadoXml {
  cpfCnpj: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  email?: string;
  telefone?: string;
}

export interface NotaFiscalXml {
  numero: string;
  serie: string;
  chaveAcesso: string;
  valor: number;
  dataEmissao: string;
  sacado: SacadoXml;
}

function getTagText(el: Element, tag: string): string {
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() || '';
}

export function parseNfeXml(xmlString: string, fileName: string): NotaFiscalXml {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML inválido: ${fileName}`);
  }

  // Find infNFe (works with or without namespace)
  let infNFe = doc.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error(`Estrutura NF-e não encontrada em: ${fileName}`);
  }

  // ide - identification
  const ide = infNFe.getElementsByTagName('ide')[0];
  const numero = ide ? getTagText(ide, 'nNF') : '';
  const serie = ide ? getTagText(ide, 'serie') : '';
  const dataEmissao = ide ? (getTagText(ide, 'dhEmi') || getTagText(ide, 'dEmi')) : '';

  // chave de acesso from infNFe Id attribute
  const idAttr = infNFe.getAttribute('Id') || '';
  const chaveAcesso = idAttr.replace('NFe', '');

  // dest - destinatário (sacado)
  const dest = infNFe.getElementsByTagName('dest')[0];
  if (!dest) {
    throw new Error(`Destinatário (sacado) não encontrado em: ${fileName}`);
  }

  const cpfCnpj = getTagText(dest, 'CNPJ') || getTagText(dest, 'CPF');
  const nome = getTagText(dest, 'xNome');

  const enderDest = dest.getElementsByTagName('enderDest')[0];
  let endereco = '';
  let cidade = '';
  let estado = '';
  let cep = '';

  if (enderDest) {
    const logradouro = getTagText(enderDest, 'xLgr');
    const nro = getTagText(enderDest, 'nro');
    const bairro = getTagText(enderDest, 'xBairro');
    endereco = [logradouro, nro, bairro].filter(Boolean).join(', ');
    cidade = getTagText(enderDest, 'xMun');
    estado = getTagText(enderDest, 'UF');
    cep = getTagText(enderDest, 'CEP');
  }

  const email = getTagText(dest, 'email');
  const telefone = enderDest ? getTagText(enderDest, 'fone') : '';

  // Total
  const icmsTot = infNFe.getElementsByTagName('ICMSTot')[0];
  const valorStr = icmsTot ? getTagText(icmsTot, 'vNF') : '0';
  const valor = parseFloat(valorStr) || 0;

  if (!cpfCnpj) {
    throw new Error(`CPF/CNPJ do destinatário não encontrado em: ${fileName}`);
  }

  return {
    numero,
    serie,
    chaveAcesso,
    valor,
    dataEmissao: dataEmissao ? dataEmissao.substring(0, 10) : '',
    sacado: { cpfCnpj, nome, endereco, cidade, estado, cep, email, telefone },
  };
}

export function parseMultipleXmls(files: { name: string; content: string }[]): {
  notas: (NotaFiscalXml & { fileName: string })[];
  erros: { fileName: string; error: string }[];
} {
  const notas: (NotaFiscalXml & { fileName: string })[] = [];
  const erros: { fileName: string; error: string }[] = [];

  for (const file of files) {
    try {
      const nota = parseNfeXml(file.content, file.name);
      notas.push({ ...nota, fileName: file.name });
    } catch (e) {
      erros.push({ fileName: file.name, error: e instanceof Error ? e.message : 'Erro desconhecido' });
    }
  }

  return { notas, erros };
}
