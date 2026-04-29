import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Helpers de invalidação de cache.
 *
 * Sempre que uma edição/criação/exclusão acontecer, chame o método
 * correspondente para que os dados em cache sejam atualizados na próxima
 * leitura — sem precisar recarregar a página.
 *
 * Convenção de query keys (use estas em useQuery em todo o sistema):
 *   ['cedente', cpfCnpj]
 *   ['cedentes', filtros?]
 *   ['sacado', cpfCnpj]
 *   ['sacados', filtros?]
 *   ['cliente', cpfCnpj]
 *   ['clientes', filtros?]
 *   ['notes', entityType, cpfCnpj]
 *   ['portfolio', 'my']
 *   ['portfolio', 'overview']
 *   ['portfolio', 'assignments']
 *   ['dashboard', userId]
 *   ['consultas', filtros?]
 */
export function useCacheInvalidation() {
  const qc = useQueryClient();

  const invalidateCedente = useCallback((cpfCnpj?: string) => {
    if (cpfCnpj) qc.invalidateQueries({ queryKey: ['cedente', cpfCnpj] });
    qc.invalidateQueries({ queryKey: ['cedentes'] });
  }, [qc]);

  const invalidateSacado = useCallback((cpfCnpj?: string) => {
    if (cpfCnpj) qc.invalidateQueries({ queryKey: ['sacado', cpfCnpj] });
    qc.invalidateQueries({ queryKey: ['sacados'] });
  }, [qc]);

  const invalidateCliente = useCallback((cpfCnpj?: string) => {
    if (cpfCnpj) qc.invalidateQueries({ queryKey: ['cliente', cpfCnpj] });
    qc.invalidateQueries({ queryKey: ['clientes'] });
  }, [qc]);

  const invalidateNotes = useCallback((entityType: string, cpfCnpj: string) => {
    qc.invalidateQueries({ queryKey: ['notes', entityType, cpfCnpj] });
  }, [qc]);

  const invalidatePortfolio = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['portfolio'] });
  }, [qc]);

  const invalidateDashboard = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }, [qc]);

  const invalidateConsultas = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['consultas'] });
  }, [qc]);

  /** Invalida tudo (uso raro: depois de operações de impacto amplo). */
  const invalidateAll = useCallback(() => {
    qc.invalidateQueries();
  }, [qc]);

  return {
    invalidateCedente,
    invalidateSacado,
    invalidateCliente,
    invalidateNotes,
    invalidatePortfolio,
    invalidateDashboard,
    invalidateConsultas,
    invalidateAll,
  };
}
