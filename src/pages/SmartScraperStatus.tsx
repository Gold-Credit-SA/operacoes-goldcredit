import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2, Server, Database, Clock } from "lucide-react";
import { Link } from "react-router-dom";

// Página de observabilidade do sistema smart-scraper.
// Rota: /smart-scraper-status (protegida).
// Não aparece no menu — acesso por URL direta.

interface HealthResponse {
  checked_at: string;
  from_cache?: boolean;
  worker: {
    ok: boolean;
    uptime_s?: number;
    queue?: { pending?: number; waiting?: number; inflight?: number; concurrency?: number };
    error?: string;
    latency_ms?: number;
  };
  cache: {
    total: number;
    por_tipo: Record<string, number>;
    ultimos: Array<{
      titulo_id: string;
      tipo: string;
      bytes: number;
      fetched_at: string;
      expires_at: string;
      hit_count: number;
    }>;
  } | null;
  cache_error?: string;
}

const AUTO_REFRESH_MS = 20_000;

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h${m}min`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `há ${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  return `há ${Math.floor(diff / 86_400_000)}d`;
}

export default function SmartScraperStatus() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke<HealthResponse>(
        "smart-scraper-health",
      );
      if (error) {
        // Lê body real do erro
        let msg = error.message;
        try {
          const ctx = (error as { context?: unknown }).context;
          if (ctx instanceof Response) {
            const j = await ctx.clone().json();
            msg = j.error || j.message || msg;
          }
        } catch { /* ignora */ }
        setErr(msg);
        return;
      }
      setData(resp ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const worker = data?.worker;
  const cache = data?.cache;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Smart Scraper — Status</h1>
          <p className="text-muted-foreground">
            Observabilidade do worker VPS + cache de PDFs. Auto-refresh a cada {AUTO_REFRESH_MS / 1000}s.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/test-smart-scraper">Página de teste</Link>
          </Button>
          <Button onClick={fetchHealth} disabled={loading} size="sm">
            {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      {err && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="size-5" />
              <span className="font-medium">Falha ao consultar status:</span>
              <span>{err}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Worker VPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" />
              Worker VPS
              {worker?.ok ? (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="size-3 mr-1" /> online
                </Badge>
              ) : worker ? (
                <Badge variant="destructive">
                  <AlertTriangle className="size-3 mr-1" /> offline
                </Badge>
              ) : (
                <Badge variant="outline">verificando...</Badge>
              )}
            </CardTitle>
            <CardDescription>scraper.goldcreditcapital.com.br</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {worker?.error ? (
              <div className="text-destructive font-medium">{worker.error}</div>
            ) : worker ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{formatUptime(worker.uptime_s ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latência ping</span>
                  <span className="font-mono">{worker.latency_ms ?? "?"} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Concorrência</span>
                  <span className="font-mono">{worker.queue?.concurrency ?? "?"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Em fila</span>
                  <span className="font-mono">
                    {worker.queue?.pending ?? 0} processando, {worker.queue?.waiting ?? 0} aguardando, {worker.queue?.inflight ?? 0} in-flight
                  </span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Carregando...</div>
            )}
          </CardContent>
        </Card>

        {/* Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" />
              Cache de PDFs
            </CardTitle>
            <CardDescription>Tabela smart_anexos_cache</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data?.cache_error ? (
              <div className="text-destructive font-medium">{data.cache_error}</div>
            ) : cache ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total cacheado</span>
                  <span className="font-mono font-bold">{cache.total}</span>
                </div>
                {Object.entries(cache.por_tipo).map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between">
                    <span className="text-muted-foreground">└ {tipo}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-muted-foreground">Carregando...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimos PDFs cacheados */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos PDFs cacheados</CardTitle>
          <CardDescription>20 mais recentes — útil pra ver atividade</CardDescription>
        </CardHeader>
        <CardContent>
          {cache && cache.ultimos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead className="text-right">Hits</TableHead>
                  <TableHead>Buscado</TableHead>
                  <TableHead>Expira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cache.ultimos.map((r) => (
                  <TableRow key={`${r.tipo}-${r.titulo_id}`}>
                    <TableCell className="font-mono">{r.titulo_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBytes(r.bytes)}</TableCell>
                    <TableCell className="text-right font-mono">{r.hit_count}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <Clock className="size-3 inline mr-1" />
                      {timeAgo(r.fetched_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(r.expires_at).getTime() < Date.now() ? (
                        <span className="text-destructive">expirou</span>
                      ) : (
                        timeAgo(r.expires_at).replace("há", "em")
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-8">
              Cache vazio — nenhum PDF foi baixado ainda. Tente em <Link to="/test-smart-scraper" className="underline">/test-smart-scraper</Link>.
            </div>
          )}
        </CardContent>
      </Card>

      {data?.checked_at && (
        <p className="text-xs text-muted-foreground text-right">
          Última verificação: {timeAgo(data.checked_at)}
          {data.from_cache && " (cache 15s)"}
        </p>
      )}
    </div>
  );
}
