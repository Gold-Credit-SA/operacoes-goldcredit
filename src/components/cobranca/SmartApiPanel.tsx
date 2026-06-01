import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type TestResult =
  | { kind: "ok"; tokenPreview: string }
  | { kind: "fail"; message: string }
  | null;

export default function SmartApiPanel() {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<TestResult>(null);
  const [syncSummary, setSyncSummary] = useState<{ total: number; page: number; pages: number } | null>(null);

  const testConn = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("smart-api", { body: { action: "test" } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao autenticar");
      setResult({ kind: "ok", tokenPreview: data.data?.token_preview ?? "" });
      toast.success("Conectado à API do Smart");
    } catch (e: any) {
      setResult({ kind: "fail", message: e.message ?? String(e) });
      toast.error("Falha: " + (e.message ?? e));
    } finally { setTesting(false); }
  };

  const sync = async () => {
    setSyncing(true);
    setSyncSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke("smart-api", {
        body: { action: "titulos-aberto", params: { page: 1 } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha");
      const d = data.data;
      setSyncSummary({ total: d.total_items ?? 0, page: d.page ?? 1, pages: d.page_count ?? 1 });
      toast.success(`API Smart respondeu: ${d.total_items ?? 0} títulos em aberto`);
    } catch (e: any) {
      toast.error("Erro sync: " + (e.message ?? e));
    } finally { setSyncing(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" /> Smart API v2
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Integração OAuth2 com <code className="text-xs">api.smartsecurities.com.br</code>.
          Permite puxar títulos direto da API oficial (dados sempre atualizados).
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={testConn} disabled={testing} variant="outline" size="sm">
            <Plug className={`h-4 w-4 mr-2 ${testing ? "animate-pulse" : ""}`} />
            Testar conexão
          </Button>
          <Button onClick={sync} disabled={syncing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Buscar títulos em aberto
          </Button>
        </div>

        {result?.kind === "ok" && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
            <CheckCircle2 className="h-4 w-4" />
            Autenticado. Token: <code className="text-xs">{result.tokenPreview}</code>
          </div>
        )}
        {result?.kind === "fail" && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
            <XCircle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">Falha na autenticação</div>
              <div className="text-xs">{result.message}</div>
              <div className="text-xs mt-1">Verifique os secrets <code>SMART_CLIENT_ID</code> e <code>SMART_CLIENT_SECRET</code>.</div>
            </div>
          </div>
        )}

        {syncSummary && (
          <div className="text-sm bg-muted/40 px-3 py-2 rounded space-y-1">
            <div>Total de títulos em aberto: <Badge variant="secondary">{syncSummary.total}</Badge></div>
            <div className="text-xs text-muted-foreground">Página {syncSummary.page} de {syncSummary.pages}</div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>PDF de boleto/NF:</strong> a API v2 publicada não expõe download de boleto/NF por título.
            Mantenha as URLs configuradas acima como fallback. Quando a Smart liberar esses endpoints,
            ativamos automaticamente sem mudança no front.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
