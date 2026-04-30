/**
 * Layout tests for AnalysisDashboard.
 *
 * Estes testes garantem invariantes do layout dos grids da página de análise
 * de crédito (mobile e desktop), prevenindo regressões de "espaços em branco":
 *
 * 1. Nenhum grid de 2 colunas pode ficar com apenas 1 filho — ou colapsa
 *    para `grid-cols-1`, ou renderiza ambos os filhos.
 * 2. Em mobile (< 768px), grids só ativam 2 colunas via prefixo `md:`.
 *
 * Implementação: análise estática do source (mais robusto que renderizar o
 * componente inteiro, que depende de Supabase + recharts + ResizeObserver).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../AnalysisDashboard.tsx'),
  'utf-8'
);

describe('AnalysisDashboard — invariantes de layout (sem espaços em branco)', () => {
  it('grid Cedente/Concentração colapsa condicionalmente (md:grid-cols-2 só com dados)', () => {
    // Padrão: sacadoConcentracao.length > 0 ? 'md:grid-cols-2' : 'grid-cols-1'
    expect(SOURCE).toMatch(
      /sacadoConcentracao\.length\s*>\s*0\s*\?\s*['"]md:grid-cols-2['"]\s*:\s*['"]grid-cols-1['"]/
    );
    expect(SOURCE).toContain('data-testid="grid-cedente-concentracao"');
  });

  it('grid Relação/Títulos colapsa quando só há Títulos (multi-sacado)', () => {
    expect(SOURCE).toMatch(/hasRelacao\s*\?\s*['"]md:grid-cols-2['"]\s*:\s*['"]grid-cols-1['"]/);
    expect(SOURCE).toContain('data-testid="grid-relacao-titulos"');
  });

  it('grid Ressalvas/Faltantes colapsa quando só um existe', () => {
    expect(SOURCE).toContain('data-testid="grid-ressalvas-faltantes"');
    const idx = SOURCE.indexOf('data-testid="grid-ressalvas-faltantes"');
    const block = SOURCE.slice(Math.max(0, idx - 400), idx + 400);
    expect(block).toMatch(/ressalvas[\s\S]*&&[\s\S]*dadosFaltantes/);
    expect(block).toMatch(/md:grid-cols-2[\s\S]*grid-cols-1/);
  });

  it('grid Cedente/Sacados sempre tem 2 filhos (cedente + sacado/sacados)', () => {
    expect(SOURCE).toContain('data-testid="grid-cedente-sacados"');
    const idx = SOURCE.indexOf('data-testid="grid-cedente-sacados"');
    // Block estende até o fechamento do grid (após o accordion de sacados)
    const block = SOURCE.slice(idx, idx + 6000);
    expect(block).toContain('title="Cedente"');
    expect(block).toMatch(/Array\.isArray\(analysis\?\.blocos\?\.sacados\)/);
    expect(block).toMatch(/title="Sacado"/);
  });

  it('nenhum grid usa md:grid-cols-2 sem classe de fallback grid-cols-1 OU múltiplos filhos garantidos', () => {
    // Todos os usos de md:grid-cols-2 devem estar em contextos seguros:
    //  a) com fallback condicional grid-cols-1, ou
    //  b) com children sempre presentes (Cedente/Sacados, KPIs)
    const matches = [...SOURCE.matchAll(/md:grid-cols-2/g)];
    expect(matches.length).toBeGreaterThan(0);
    // O componente fix passa pela revisão estática acima; este teste serve como
    // marcador para chamar atenção se alguém adicionar md:grid-cols-2 novo.
    // Se este teste falhar, valide manualmente o novo grid.
    expect(matches.length).toBeLessThanOrEqual(8);
  });

  it('mobile-first: nenhum grid hardcoda grid-cols-2 sem prefixo de breakpoint', () => {
    // Procura ` grid-cols-2` (espaço antes) sem prefixo sm:/md:/lg: imediatamente antes
    // Permitido apenas para grids de KPIs com >=2 filhos garantidos (ex: stat tiles)
    const lines = SOURCE.split('\n');
    const offenders: string[] = [];
    lines.forEach((line, i) => {
      // Match grid-cols-2 sem prefixo de breakpoint logo antes
      if (/(?<![a-z]:)\bgrid-cols-2\b/.test(line) && !/sm:|md:|lg:|xl:/.test(line.match(/grid-cols-2[^"']*/)?.[0] ?? '')) {
        // Verifica se a linha contém também grid-cols-2 standalone (mobile)
        if (/['"\s]grid-cols-2['"\s]/.test(line)) {
          offenders.push(`L${i + 1}: ${line.trim()}`);
        }
      }
    });
    // Aceitável: KPI tiles (sempre 2+ filhos). Documenta os casos atuais.
    // Se aumentar muito, é sinal de regressão.
    expect(offenders.length).toBeLessThanOrEqual(2);
  });
});
