import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SMART_BASE_URL = 'https://api.smartsecurities.com.br';

/** Cache token in memory to avoid re-auth on every request */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Cache API responses (Smart has 10-minute rate limit per endpoint) */
let cachedResponse: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get('SMART_CLIENT_ID');
  const clientSecret = Deno.env.get('SMART_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da API Smart não configuradas');
  }

  const res = await fetch(`${SMART_BASE_URL}/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Smart OAuth error:', res.status, body);
    throw new Error(`Erro ao autenticar na API Smart: ${res.status}`);
  }

  const data = await res.json();
  const token = data.access_token;
  const expiresIn = data.expires_in || 3600;

  cachedToken = {
    value: token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return token;
}

function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function todayBR(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

function ninetyDaysAgoBR(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeStage(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, filters } = await req.json();

    switch (action) {
      case 'operacoes-formalizacao': {
        const token = await getAccessToken();

        const dataIni = filters?.dataInicio
          ? formatDateBR(filters.dataInicio)
          : ninetyDaysAgoBR();
        const dataFim = filters?.dataFim
          ? formatDateBR(filters.dataFim)
          : todayBR();

        // Fetch all pages of operations
        let allOperacoes: Record<string, unknown>[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const url = new URL(`${SMART_BASE_URL}/smartsecurities/operacao`);
          url.searchParams.set('tipo', 'individualizado');
          url.searchParams.set('tipoSaida', 'json');
          url.searchParams.set('dataIniOperacao', dataIni);
          url.searchParams.set('dataFimOperacao', dataFim);
          if (page > 1) url.searchParams.set('page', String(page));

          const res = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            const body = await res.text();
            console.error(`Smart API error page ${page}:`, res.status, body);
            throw new Error(`Erro na API Smart: ${res.status}`);
          }

          const data = await res.json();
          const ops = data?._embedded?.operacao || [];
          allOperacoes = allOperacoes.concat(ops);

          // Check pagination
          const totalPages = data?.page_count || 1;
          if (page >= totalPages) {
            hasMore = false;
          } else {
            page++;
          }

          // Safety: max 20 pages (500 records)
          if (page > 20) break;
        }

        // Filter only formalization operations
        const formalizacao = allOperacoes.filter((op) => {
          const etapa = normalizeStage(String(op.ETAPA || ''));
          return etapa.includes('formalizacao');
        });

        // Optionally filter by cedente
        let filtered = formalizacao;
        if (filters?.cedente) {
          const search = filters.cedente.toLowerCase();
          filtered = filtered.filter((op) =>
            String(op.CEDENTE || '').toLowerCase().includes(search)
          );
        }

        // Map to consistent format
        const mapped = filtered.map((op, idx) => ({
          id: idx + 1,
          operacao: op.OPERACAO,
          etapa: op.ETAPA,
          data: op.DATA,
          cedente: op.CEDENTE,
          cpf_cnpj_cedente: op.CPF_CNPJ_CEDENTE,
          prazo_medio: op.PRAZO_MEDIO,
          valor_bruto: op.VALOR_BRUTO,
          valor_liquido: op.VALOR_LIQUIDO,
          valor_desagio: op.VALOR_DESAGIO,
          valor_saldo: op.VALOR_SALDO,
          finalizacao: op.FINALIZACAO,
          operador: op.OPERADOR,
          captador: op.CAPTADOR,
          pagamento_operacao: op.PAGAMENTO_OPERACAO,
          inicio: op.INICIO,
          tipo_operacao: op.TIPO_OPERACAO,
          precisaFormalizacao: true,
          sinalizacaoGoldsign: 'Enviar documentos para assinatura',
        }));

        return new Response(
          JSON.stringify({
            success: true,
            data: mapped,
            meta: {
              totalOperacoes: allOperacoes.length,
              totalFormalizacao: mapped.length,
              periodo: { inicio: dataIni, fim: dataFim },
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Smart API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
