import { getAdminClient } from './supabase-admin.ts';

export interface CacheGetResult<T = unknown> {
  hit: boolean;
  payload: T | null;
  ageSeconds: number | null;
}

export async function cacheGet<T = unknown>(hash: string): Promise<CacheGetResult<T>> {
  try {
    const client = getAdminClient();
    const { data, error } = await client
      .from('integration_cache')
      .select('payload, created_at, expires_at')
      .eq('hash', hash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return { hit: false, payload: null, ageSeconds: null };

    // Bump hit_count em paralelo, sem bloquear o retorno.
    client
      .from('integration_cache')
      .update({ hit_count: (((data as Record<string, unknown>).hit_count as number) ?? 0) + 1 })
      .eq('hash', hash)
      .then(() => undefined);

    const ageSeconds = Math.round((Date.now() - new Date(data.created_at).getTime()) / 1000);
    return { hit: true, payload: data.payload as T, ageSeconds };
  } catch (err) {
    console.error('[cache] cacheGet error:', err);
    return { hit: false, payload: null, ageSeconds: null };
  }
}

export interface CacheSetOptions {
  hash: string;
  provider: string;
  action: string;
  docId?: string | null;
  payload: unknown;
  ttlSeconds: number;
}

export async function cacheSet(opts: CacheSetOptions): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000).toISOString();
    await getAdminClient()
      .from('integration_cache')
      .upsert(
        {
          hash: opts.hash,
          provider: opts.provider,
          action: opts.action,
          doc_id: opts.docId ?? null,
          payload: opts.payload,
          expires_at: expiresAt,
        },
        { onConflict: 'hash' },
      );
  } catch (err) {
    console.error('[cache] cacheSet error:', err);
  }
}
