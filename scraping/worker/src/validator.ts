// Valida que um buffer é de fato um PDF olhando os magic bytes.
// %PDF-1.x na assinatura. Sem isso, scraper pode retornar página HTML de erro
// como se fosse boleto e cachear lixo.

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

export function isValidPdf(buf: Buffer): boolean {
  if (buf.length < PDF_MAGIC.length) return false;
  return buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

// Sanity check: PDF de boleto típico tem entre 30 KB e 500 KB.
// PDF gigante geralmente é página HTML salva por engano ou anexo errado.
const MIN_BYTES = 1_024;
const MAX_BYTES = 10 * 1024 * 1024;

export function isPdfSizeReasonable(buf: Buffer): boolean {
  return buf.length >= MIN_BYTES && buf.length <= MAX_BYTES;
}
