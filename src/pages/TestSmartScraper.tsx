import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SmartPdfButtons } from "@/components/cobranca/SmartPdfButtons";
import { Loader2, ExternalLink, Copy, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// Página de teste do sistema smart-scraper.
// URL: /test-smart-scraper (acesso autenticado).
// Permite disparar boleto/NF com inputs visíveis e ver a resposta crua da edge.

interface ScraperResponse {
  success: boolean;
  signed_url?: string;
  expires_at?: string;
  from_cache?: boolean;
  error_code?: string;
  message?: string;
  trace_id?: string;
  latency_ms?: number;
}

export default function TestSmartScraper() {
  // Valores padrão vindos da documentação do dev (título de teste real).
  const [tituloId, setTituloId] = useState("83280");
  const [checks, setChecks] = useState("21467,");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState<"boleto" | "nf" | null>(null);
  const [rawResponse, setRawResponse] = useState<ScraperResponse | null>(null);

  async function rawInvoke(tipo: "boleto" | "nf") {
    setLoading(tipo);
    setRawResponse(null);
    try {
      const body: Record<string, unknown> = {
        titulo_id: tituloId.trim(),
        tipo,
        force_refresh: forceRefresh,
      };
      if (tipo === "boleto") {
        body.extra = { checks: checks.trim() };
      }
      const { data, error } = await supabase.functions.invoke<ScraperResponse>(
        "smart-scraper",
        { body },
      );
      if (error) {
        setRawResponse({ success: false, error_code: "INVOKE_ERROR", message: error.message });
        toast.error(`Erro: ${error.message}`);
        return;
      }
      setRawResponse(data ?? null);
      if (data?.success) {
        toast.success(
          data.from_cache ? "Cache hit" : "PDF gerado",
          { description: `${data.latency_ms ?? 0} ms` },
        );
      } else {
        toast.error(data?.message ?? "Falha");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRawResponse({ success: false, error_code: "EXCEPTION", message: msg });
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teste — Smart Scraper</h1>
        <p className="text-muted-foreground">
          Página interna de validação do worker de scraping. Não exposta no menu.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros do título</CardTitle>
          <CardDescription>
            Valores pré-preenchidos correspondem ao título de teste validado
            pelo dev na documentação (titulo_id=83280, checks=21467,).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="titulo">titulo_id</Label>
              <Input
                id="titulo"
                value={tituloId}
                onChange={(e) => setTituloId(e.target.value)}
                placeholder="ex: 83280"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado pra NF/DANFE e como referência no log.
              </p>
            </div>
            <div>
              <Label htmlFor="checks">extra.checks (boleto)</Label>
              <Input
                id="checks"
                value={checks}
                onChange={(e) => setChecks(e.target.value)}
                placeholder="ex: 21467,"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obrigatório pra boleto. Veio do clique "2ª via" no portal Smart.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="force"
              checked={forceRefresh}
              onCheckedChange={setForceRefresh}
            />
            <Label htmlFor="force" className="cursor-pointer">
              <span className="font-normal">force_refresh</span>
              <span className="text-xs text-muted-foreground ml-2">
                ignora cache, sempre chama o worker
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Teste via componente reusável</CardTitle>
          <CardDescription>
            Esses dois botões usam o componente <code>SmartPdfButtons</code> —
            o mesmo que será plugado em outras telas. Abre o PDF em nova aba.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmartPdfButtons tituloId={tituloId} checks={checks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Teste com resposta crua</CardTitle>
          <CardDescription>
            Dispara a edge function e mostra o JSON completo da resposta —
            útil pra debug.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => void rawInvoke("boleto")}
              disabled={loading !== null || !tituloId.trim() || !checks.trim()}
              variant="default"
            >
              {loading === "boleto" ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Gerando boleto...</>
              ) : (
                "Disparar boleto (raw)"
              )}
            </Button>
            <Button
              onClick={() => void rawInvoke("nf")}
              disabled={loading !== null || !tituloId.trim()}
              variant="default"
            >
              {loading === "nf" ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Gerando NF...</>
              ) : (
                "Disparar NF (raw)"
              )}
            </Button>
          </div>

          {rawResponse && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {rawResponse.success ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="size-3 mr-1" /> success
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="size-3 mr-1" /> {rawResponse.error_code ?? "error"}
                    </Badge>
                  )}
                  {rawResponse.from_cache !== undefined && (
                    <Badge variant="outline">
                      {rawResponse.from_cache ? "cache hit" : "cache miss"}
                    </Badge>
                  )}
                  {rawResponse.latency_ms !== undefined && (
                    <Badge variant="outline">{rawResponse.latency_ms} ms</Badge>
                  )}
                  {rawResponse.trace_id && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {rawResponse.trace_id.slice(0, 8)}
                    </Badge>
                  )}
                </div>

                {rawResponse.signed_url && (
                  <div className="space-y-2">
                    <Label>signed_url</Label>
                    <div className="flex gap-2">
                      <Input
                        value={rawResponse.signed_url}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copy(rawResponse.signed_url!)}
                        title="Copiar"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          window.open(rawResponse.signed_url, "_blank", "noopener,noreferrer")
                        }
                        title="Abrir em nova aba"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    </div>
                    {rawResponse.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Expira em {new Date(rawResponse.expires_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}

                {rawResponse.message && !rawResponse.success && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {rawResponse.message}
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    JSON completo
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                </details>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O que cada erro significa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>UNAUTHORIZED</strong> — você não está logado ou JWT expirou. Faça login novamente.</p>
          <p><strong>BAD_REQUEST</strong> — payload inválido (faltou checks pra boleto, ou tipo errado).</p>
          <p><strong>TITULO_NAO_ENCONTRADO</strong> — título não existe no banco externo Smart.</p>
          <p><strong>WORKER_NOT_CONFIGURED</strong> — secret SMART_SCRAPER_URL ou SMART_SCRAPER_TOKEN ausente.</p>
          <p><strong>WORKER_UNREACHABLE</strong> — edge não conseguiu falar com VPS. Cloudflare Tunnel caiu?</p>
          <p><strong>LOGIN_FAILED</strong> — worker conseguiu falar com Smart mas sessão expirou. Renovar via noVNC.</p>
          <p><strong>PDF_INVALID</strong> — Smart retornou algo que não é PDF (página HTML de erro, vazio).</p>
          <p><strong>TIMEOUT</strong> — Smart demorou demais (&gt;30s). Tentar de novo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
