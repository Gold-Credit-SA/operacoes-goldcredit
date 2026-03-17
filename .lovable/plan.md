

## Diagnóstico

O erro `405 Method Not Allowed` com filename `supabase/functions/criar/index.ts` indica que a edge function `goldsign-proxy` **não está deployada**. O Supabase está interpretando o path `/goldsign-proxy?path=/api/assinatura/criar` como uma tentativa de chamar uma function chamada "criar" (que não existe), retornando 405.

Confirmei isso testando a function via curl — retorna 404 (NOT_FOUND).

O código da function e a config no `config.toml` estão corretos. O problema é apenas que a function precisa ser re-deployada.

## Plano

1. **Deployar a edge function `goldsign-proxy`** — é a única ação necessária. O código já está correto e o `config.toml` já tem `verify_jwt = false`.

2. **Verificar** que o endpoint responde corretamente após o deploy testando `/api/health` via proxy.

Nenhuma alteração de código é necessária — apenas o deploy da function.

