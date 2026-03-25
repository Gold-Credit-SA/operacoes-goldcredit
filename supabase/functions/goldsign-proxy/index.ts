import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BACKEND_URL = Deno.env.get('GOLDSIGN_BACKEND_URL') || 'https://goldsign.onrender.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('target');
    if (!path) {
      return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUrl = `${BACKEND_URL}${path}`;

    // Forward the request as-is (supports FormData, JSON, etc.)
    const headers: Record<string, string> = {};
    const ct = req.headers.get('content-type');
    if (ct) headers['content-type'] = ct;

    const bodyContent = req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.arrayBuffer()
      : undefined;

    let response: Response | null = null;
    let lastError: Error | null = null;

    // Retry up to 2 times for transient errors (e.g. Render cold start)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: bodyContent,
        });
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Attempt ${attempt + 1} failed for ${targetUrl}:`, lastError.message);
        if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: lastError?.message || 'Backend indisponível' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
