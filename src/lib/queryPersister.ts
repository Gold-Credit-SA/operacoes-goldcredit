import { get, set, del, createStore } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

/**
 * Cache persistente usando IndexedDB (idb-keyval).
 *
 * Vantagens vs localStorage:
 * - Capacidade maior (centenas de MB vs 5MB)
 * - Async, não bloqueia a thread principal
 * - Suporta objetos complexos sem JSON.stringify manual
 *
 * Estratégia de invalidação segura:
 * - Chave do cache inclui a versão do app (CACHE_VERSION).
 * - Ao subir uma nova versão, o cache antigo é descartado automaticamente
 *   e nenhum dado obsoleto vaza para a nova versão (sem precisar pedir
 *   ao usuário para "limpar o cache").
 * - O cache é particionado por usuário (definido após login) para evitar
 *   que dados de um usuário apareçam para outro na mesma máquina.
 */

// Suba este número quando houver mudança incompatível na forma dos dados.
export const CACHE_VERSION = 'v1';

const DB_NAME = 'goldcredit-cache';
const STORE_NAME = 'react-query';

const idbStore = createStore(DB_NAME, STORE_NAME);

let cacheKey = `rq-cache::${CACHE_VERSION}::anon`;

export function setCacheUserScope(userId: string | null) {
  cacheKey = `rq-cache::${CACHE_VERSION}::${userId ?? 'anon'}`;
}

export function getCacheBuster() {
  return CACHE_VERSION;
}

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(cacheKey, client, idbStore);
      } catch (err) {
        console.warn('[cache] persistClient failed', err);
      }
    },
    restoreClient: async () => {
      try {
        const value = await get<PersistedClient>(cacheKey, idbStore);
        return value;
      } catch (err) {
        console.warn('[cache] restoreClient failed', err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(cacheKey, idbStore);
      } catch (err) {
        console.warn('[cache] removeClient failed', err);
      }
    },
  };
}

/** Limpa todo o cache persistido (usar no logout). */
export async function clearPersistedCache() {
  try {
    await del(cacheKey, idbStore);
  } catch (err) {
    console.warn('[cache] clearPersistedCache failed', err);
  }
}
