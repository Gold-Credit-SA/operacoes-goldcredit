import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SmartPdfButtons } from "@/components/cobranca/SmartPdfButtons";
import {
  User, Building2, Phone, Mail, MessageSquare, MapPin, Calendar,
  DollarSign, AlertCircle, Loader2, Copy, ExternalLink, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Card completo de título: chama smart-titulo-info, mostra todos os dados
// (título + sacado com contatos + cedente) e oferece ações de cobrança.
// Reusável em qualquer página.

interface TituloInfoResponse {
  success: boolean;
  titulo?: {
    id_titulo: string;
    documento?: string | null;
    nosso_numero?: string | null;
    tipo?: string | null;
    sacado_nome?: string | null;
    cedente_nome?: string | null;
    vencimento?: string | null;
    valor?: string | null;
    valor_total?: string | null;
    valor_juros?: string | null;
    valor_multa?: string | null;
    situacao?: string | null;
    fonte?: "em_aberto" | "quitado";
    dias_vencimento?: number | null;
  };
  sacado?: {
    nome?: string | null;
    cpf_cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    sms?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
    grupo_economico?: string | null;
  } | null;
  cedente?: {
    nome?: string | null;
    cpf_cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    gerente?: string | null;
    responsavel_cobranca?: string | null;
    bloqueado?: string | null;
  } | null;
  error_code?: string;
  message?: string;
}

interface Props {
  tituloId: string | number;
  /** Inicialmente expandido — útil pra modals/detail pages */
  defaultOpen?: boolean;
}

function formatBRL(s?: string | null): string {
  if (!s) return "R$ 0,00";
  const n = parseFloat(s);
  if (Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function buildWhatsAppLink(phone: string, message: string): string {
  const num = onlyDigits(phone);
  // Adiciona código BR se vier sem
  const fullNum = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${fullNum}?text=${encodeURIComponent(message)}`;
}

function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function copyToClipboard(text: string, label = "Copiado"): void {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

export function TituloCard({ tituloId }: Props) {
  const [data, setData] = useState<TituloInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke<TituloInfoResponse>(
        "smart-titulo-info",
        { body: { titulo_id: String(tituloId) } },
      );

      let parsed: TituloInfoResponse | null = resp ?? null;
      if (error) {
        try {
          const ctx = (error as { context?: unknown }).context;
          if (ctx instanceof Response) parsed = (await ctx.clone().json()) as TituloInfoResponse;
        } catch { /* ignora */ }
      }
      if (!parsed?.success) {
        setErr(parsed?.message ?? error?.message ?? "Falha ao carregar título");
        setData(null);
        return;
      }
      setData(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tituloId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Carregando título {String(tituloId)}...
        </CardContent>
      </Card>
    );
  }

  if (err) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <span>{err}</span>
            </div>
            <Button onClick={fetch} variant="outline" size="sm">
              <RefreshCw className="size-4 mr-2" /> Tentar de novo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const t = data?.titulo;
  const s = data?.sacado;
  const c = data?.cedente;
  if (!t) return null;

  const vencido = (t.dias_vencimento ?? 0) > 0;
  const mensagemPadrao =
    `Olá ${s?.nome ?? ""}, ` +
    `referente ao título ${t.documento ?? t.id_titulo} ` +
    `com vencimento em ${formatDate(t.vencimento)} ` +
    `e valor de ${formatBRL(t.valor_total ?? t.valor)}.`;

  return (
    <Card>
      {/* Header — overview */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              Título {t.documento ?? t.id_titulo}
              {t.tipo && <Badge variant="outline">{t.tipo}</Badge>}
              <Badge variant={vencido ? "destructive" : "secondary"}>
                {vencido
                  ? `vencido há ${t.dias_vencimento}d`
                  : t.dias_vencimento !== null && t.dias_vencimento !== undefined
                  ? `vence em ${Math.abs(t.dias_vencimento)}d`
                  : t.situacao ?? ""}
              </Badge>
              {c?.bloqueado === "Sim" && (
                <Badge variant="destructive">cedente bloqueado</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t.sacado_nome} — {formatDate(t.vencimento)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatBRL(t.valor_total ?? t.valor)}</p>
            {t.valor_juros && parseFloat(t.valor_juros) > 0 && (
              <p className="text-xs text-muted-foreground">
                inclui juros {formatBRL(t.valor_juros)}
                {t.valor_multa && parseFloat(t.valor_multa) > 0 && ` + multa ${formatBRL(t.valor_multa)}`}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* PDFs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">PDFs:</span>
          <SmartPdfButtons tituloId={t.id_titulo} />
        </div>

        <Separator />

        {/* Sacado */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <User className="size-4" />
            Sacado (devedor)
          </h3>
          {s ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.nome}</span>
                <Badge variant="outline" className="font-mono text-xs">{s.cpf_cnpj}</Badge>
                {s.grupo_economico && (
                  <Badge variant="secondary" className="text-xs">{s.grupo_economico}</Badge>
                )}
              </div>

              {(s.endereco || s.cidade) && (
                <div className="flex items-start gap-2 text-muted-foreground text-xs">
                  <MapPin className="size-3 mt-0.5 shrink-0" />
                  <span>
                    {[s.endereco, s.cidade, s.uf].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* Contatos com botões de ação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                {/* Telefone / WhatsApp */}
                <div className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="size-4 text-green-600 shrink-0" />
                    <span className="text-sm truncate">{s.telefone ?? "—"}</span>
                  </div>
                  {s.telefone && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        onClick={() => copyToClipboard(s.telefone!, "Telefone copiado")}
                        title="Copiar"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        onClick={() =>
                          window.open(buildWhatsAppLink(s.telefone!, mensagemPadrao), "_blank")
                        }
                        title="WhatsApp"
                      >
                        <MessageSquare className="size-3 text-green-600" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="size-4 text-blue-600 shrink-0" />
                    <span className="text-sm truncate">{s.email ?? "—"}</span>
                  </div>
                  {s.email && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        onClick={() => copyToClipboard(s.email!, "Email copiado")}
                        title="Copiar"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        onClick={() =>
                          window.open(
                            buildMailto(
                              s.email!,
                              `Cobrança título ${t.documento ?? t.id_titulo}`,
                              mensagemPadrao,
                            ),
                            "_blank",
                          )
                        }
                        title="Compor email"
                      >
                        <ExternalLink className="size-3 text-blue-600" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* SMS */}
                <div className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="size-4 text-orange-600 shrink-0" />
                    <span className="text-sm truncate">{s.sms ?? "—"}</span>
                  </div>
                  {s.sms && (
                    <Button
                      size="icon" variant="ghost" className="size-7"
                      onClick={() => copyToClipboard(s.sms!, "SMS copiado")}
                      title="Copiar"
                    >
                      <Copy className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sacado não encontrado no banco (CPF/CNPJ não cadastrado em smartsecurities_sacados).
            </p>
          )}
        </div>

        <Separator />

        {/* Cedente */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Building2 className="size-4" />
            Cedente (credor)
          </h3>
          {c ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.nome}</span>
                <Badge variant="outline" className="font-mono text-xs">{c.cpf_cnpj}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                {c.responsavel_cobranca && (
                  <div>Resp. cobrança: <span className="text-foreground">{c.responsavel_cobranca}</span></div>
                )}
                {c.gerente && (
                  <div>Gerente: <span className="text-foreground">{c.gerente}</span></div>
                )}
                {c.email && <div>Email: <span className="text-foreground">{c.email}</span></div>}
                {c.telefone && <div>Tel: <span className="text-foreground">{c.telefone}</span></div>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cedente não encontrado.</p>
          )}
        </div>

        {/* Metadados extras */}
        <div className="text-xs text-muted-foreground border-t pt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span>id_titulo: <span className="font-mono">{t.id_titulo}</span></span>
          {t.nosso_numero && <span>nosso_numero: <span className="font-mono">{t.nosso_numero}</span></span>}
          {t.fonte && <span>fonte: <span className="font-mono">{t.fonte}</span></span>}
          <span className="ml-auto">
            <Calendar className="size-3 inline mr-1" />
            Emissão {formatDate(t.vencimento)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
