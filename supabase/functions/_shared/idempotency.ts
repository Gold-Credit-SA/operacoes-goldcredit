// Gera hash determinístico de uma chamada paga.
// Mesmo hash em janela curta = candidato a dedupe (evita pagar 2x
// por dois cliques rápidos no mesmo botão).

export async function hashRequest(parts: Array<string | number | undefined | null>): Promise<string> {
  const normalized = parts.map(p => (p == null ? '' : String(p)).trim().toLowerCase()).join('|');
  const enc = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
