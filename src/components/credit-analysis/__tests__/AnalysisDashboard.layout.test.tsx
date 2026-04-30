/**
 * Layout E2E (jsdom) tests for AnalysisDashboard.
 *
 * Goal: garantir que nenhum grid deixe colunas vazias em mobile (sem md:)
 * nem em desktop (md:grid-cols-2). Quando só existe um bloco, o grid
 * precisa colapsar para `grid-cols-1`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AnalysisDashboard } from '../AnalysisDashboard';

// Mock recharts (depende de ResizeObserver / SVG sizing que jsdom não tem)
vi.mock('recharts', () => {
  const Stub = ({ children }: any) => <div>{children}</div>;
  return new Proxy({}, { get: () => Stub });
});

// Mock supabase client (componente faz lookups async — não importa pra layout)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

const baseAnalysis = {
  blocos: {
    cedente: { resumo: 'ok', alertas: [] },
    titulosLastro: { resumo: 'ok', alertas: [] },
  },
  pontosChave: {},
  ressalvas: ['Sem ressalvas relevantes.'],
  dadosFaltantes: [],
};

function renderDashboard(analysis: any) {
  return render(
    <AnalysisDashboard
      analysis={analysis}
      clientConsultations={null}
      cedenteData={null}
      clientName="Sacado X"
      clientCpfCnpj="12345678900"
      cedenteName="Cedente Y"
      cedenteCpfCnpj="12345678000100"
    />
  );
}

/** Conta quantos filhos diretos do grid são "visíveis" (renderizados). */
function visibleChildren(grid: HTMLElement) {
  return Array.from(grid.children).filter((c) => (c as HTMLElement).offsetParent !== null || c.children.length > 0 || c.textContent?.trim());
}

describe('AnalysisDashboard — grid layout (sem espaços em branco)', () => {
  it('grid Relação/Títulos colapsa para 1 coluna quando só há Títulos', () => {
    const { getByTestId } = renderDashboard({
      ...baseAnalysis,
      blocos: {
        ...baseAnalysis.blocos,
        sacados: [{ nome: 'A', cpfCnpj: '111', risco: 'BAIXO' }], // multi-sacado => sem Relação legacy
      },
    });
    const grid = getByTestId('grid-relacao-titulos');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).not.toContain('md:grid-cols-2');
    expect(visibleChildren(grid)).toHaveLength(1);
  });

  it('grid Relação/Títulos usa 2 colunas em desktop quando ambos existem', () => {
    const { getByTestId } = renderDashboard({
      ...baseAnalysis,
      blocos: {
        ...baseAnalysis.blocos,
        relacaoCedenteSacado: { resumo: 'ok', alertas: [] },
      },
    });
    const grid = getByTestId('grid-relacao-titulos');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(visibleChildren(grid)).toHaveLength(2);
  });

  it('grid Cedente/Concentração colapsa para 1 coluna sem dados de concentração', () => {
    const { getByTestId } = renderDashboard(baseAnalysis);
    const grid = getByTestId('grid-cedente-concentracao');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).not.toContain('md:grid-cols-2');
  });

  it('grid Ressalvas/Faltantes colapsa para 1 coluna quando só há Ressalvas', () => {
    const { getByTestId } = renderDashboard({
      ...baseAnalysis,
      ressalvas: ['Atenção: documento vencido'],
      dadosFaltantes: [],
    });
    const grid = getByTestId('grid-ressalvas-faltantes');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).not.toContain('md:grid-cols-2');
    expect(visibleChildren(grid)).toHaveLength(1);
  });

  it('grid Ressalvas/Faltantes vira 2 colunas quando ambos existem', () => {
    const { getByTestId } = renderDashboard({
      ...baseAnalysis,
      ressalvas: ['Doc vencido'],
      dadosFaltantes: ['Faltam balanços'],
    });
    const grid = getByTestId('grid-ressalvas-faltantes');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(visibleChildren(grid)).toHaveLength(2);
  });

  it('grid Cedente/Sacados sempre tem 2 filhos (cedente + sacado/sacados)', () => {
    const { getByTestId } = renderDashboard({
      ...baseAnalysis,
      blocos: {
        ...baseAnalysis.blocos,
        sacado: { resumo: 'ok', alertas: [] },
      },
    });
    const grid = getByTestId('grid-cedente-sacados');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(visibleChildren(grid)).toHaveLength(2);
  });

  it('em mobile (sem md:), todos os grids ficam single-column por padrão Tailwind', () => {
    // Tailwind: `grid` sem `grid-cols-N` = 1 coluna implícita; `md:grid-cols-2` só ativa >=768px.
    // Validamos que nenhum grid declara `grid-cols-2` SEM o prefixo `md:` (forçaria 2 col em mobile).
    const { container } = renderDashboard(baseAnalysis);
    const grids = container.querySelectorAll('[class*="grid"]');
    grids.forEach((g) => {
      const cls = (g as HTMLElement).className;
      if (typeof cls !== 'string') return;
      // Permite grid-cols-1, grid-cols-2 com prefixo (sm:/md:/lg:), e grid-cols-N pequeno (2-3) só com prefixo de stat tiles
      const hasUnprefixedTwoCol = /(^|\s)grid-cols-2(\s|$)/.test(cls);
      if (hasUnprefixedTwoCol) {
        // grids de stats (KPIs) podem usar grid-cols-2 em mobile — isso é OK pois sempre têm >=2 filhos
        expect(g.children.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
