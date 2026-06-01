import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Send, Phone, RefreshCw, AlertCircle, MessageSquare } from "lucide-react";

type Titulo = {
  numero_titulo: string;
  sacado_cpf_cnpj: string;
  sacado_nome: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string;
  valor: number;
  vencimento: string;
  dias_atraso: number;
  telefone?: string;
  selected?: boolean;
};

type Envio = {
  id: string;
  created_at: string;
  user_name: string | null;
  sacado_nome: string | null;
  sacado_cpf_cnpj: string;
  telefone: string;
  numero_titulo: string | null;
  valor: number | null;
  status: string;
  error_message: string | null;
};

const DEFAULT_TEMPLATE =
  `Olá {{sacado_nome}}, tudo bem?\n\nIdentificamos que o título nº {{numero_titulo}}, no valor de R$ {{valor}}, com vencimento em {{vencimento}}, está em atraso há {{dias_atraso}} dias.\n\nPor favor, entre em contato para regularizar.\n\nObrigado.`;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
};

export default function Cobranca() {
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [minDays, setMinDays] = useState(0);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [envios, setEnvios] = useState<Envio[]>([]);

  async function loadOverdue() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cobranca-whatsapp", {
        body: { action: "list-open", minDays, onlyOverdue },
      });
      if (error) throw error;
      const items: Titulo[] = (data?.data ?? []).map((t: Titulo) => ({ ...t, selected: false }));

      // Lookup telefones em sacados
      const cpfs = Array.from(new Set(items.map((i) => i.sacado_cpf_cnpj).filter(Boolean)));
      if (cpfs.length) {
        const { data: sacados } = await supabase
          .from("sacados")
          .select("cpf_cnpj, telefone")
          .in("cpf_cnpj", cpfs);
        const map = new Map((sacados ?? []).map((s) => [s.cpf_cnpj, s.telefone ?? ""]));
        items.forEach((it) => { it.telefone = map.get(it.sacado_cpf_cnpj) ?? ""; });
      }
      setTitulos(items);
    } catch (e) {
      toast.error("Erro ao carregar títulos", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function loadHistorico() {
    const { data, error } = await supabase
      .from("cobranca_envios")
      .select("id,created_at,user_name,sacado_nome,sacado_cpf_cnpj,telefone,numero_titulo,valor,status,error_message")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Erro ao carregar histórico");
      return;
    }
    setEnvios((data ?? []) as Envio[]);
  }

  useEffect(() => {
    loadOverdue();
    loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return titulos;
    return titulos.filter(
      (t) =>
        t.sacado_nome?.toLowerCase().includes(q) ||
        t.cedente_nome?.toLowerCase().includes(q) ||
        t.sacado_cpf_cnpj?.includes(q) ||
        t.numero_titulo?.toLowerCase().includes(q),
    );
  }, [titulos, search]);

  const selected = filtered.filter((t) => t.selected);
  const allChecked = filtered.length > 0 && selected.length === filtered.length;

  function toggleAll() {
    const next = !allChecked;
    setTitulos((prev) =>
      prev.map((t) => (filtered.includes(t) ? { ...t, selected: next } : t)),
    );
  }

  function toggleOne(idx: number) {
    setTitulos((prev) => {
      const copy = [...prev];
      const real = prev.indexOf(filtered[idx]);
      if (real >= 0) copy[real] = { ...copy[real], selected: !copy[real].selected };
      return copy;
    });
  }

  function updateTelefone(idx: number, value: string) {
    setTitulos((prev) => {
      const copy = [...prev];
      const real = prev.indexOf(filtered[idx]);
      if (real >= 0) copy[real] = { ...copy[real], telefone: value };
      return copy;
    });
  }

  async function handleSend() {
    if (!selected.length) {
      toast.warning("Selecione ao menos 1 título");
      return;
    }
    const semTelefone = selected.filter((t) => !t.telefone?.trim()).length;
    if (semTelefone > 0) {
      toast.error(`${semTelefone} título(s) sem telefone preenchido`);
      return;
    }
    if (!confirm(`Enviar ${selected.length} mensagem(ns) via WhatsApp?`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("cobranca-whatsapp", {
        body: {
          action: "send-batch",
          template,
          items: selected.map((t) => ({
            telefone: t.telefone,
            sacado_cpf_cnpj: t.sacado_cpf_cnpj,
            sacado_nome: t.sacado_nome,
            cedente_cpf_cnpj: t.cedente_cpf_cnpj,
            cedente_nome: t.cedente_nome,
            numero_titulo: t.numero_titulo,
            valor: t.valor,
            vencimento: t.vencimento,
            dias_atraso: t.dias_atraso,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Enviadas: ${data.enviados} • Erros: ${data.erros}`);
      setTitulos((prev) => prev.map((t) => ({ ...t, selected: false })));
      await loadHistorico();
    } catch (e) {
      toast.error("Falha no envio", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobrança</h1>
          <p className="text-sm text-muted-foreground">Títulos em aberto — envio de cobrança via WhatsApp</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Phone className="h-3 w-3" /> Evolution API
        </Badge>
      </div>

      <Tabs defaultValue="enviar">
        <TabsList>
          <TabsTrigger value="enviar">Enviar cobrança</TabsTrigger>
          <TabsTrigger value="historico" onClick={loadHistorico}>Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="enviar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Template da mensagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={6}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: <code>{"{{sacado_nome}}"}</code> <code>{"{{numero_titulo}}"}</code>{" "}
                <code>{"{{valor}}"}</code> <code>{"{{vencimento}}"}</code>{" "}
                <code>{"{{dias_atraso}}"}</code> <code>{"{{cedente_nome}}"}</code>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  placeholder="Buscar sacado, cedente, CPF/CNPJ ou nº título…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-72"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-overdue"
                    checked={onlyOverdue}
                    onCheckedChange={(v) => setOnlyOverdue(!!v)}
                  />
                  <Label htmlFor="only-overdue" className="text-xs cursor-pointer">Só em atraso</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Atraso mín.</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minDays}
                    onChange={(e) => setMinDays(Number(e.target.value))}
                    className="w-20"
                  />
                  <Button size="sm" variant="outline" onClick={loadOverdue} disabled={loading}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Recarregar
                  </Button>
                </div>
              </div>
              <Button onClick={handleSend} disabled={sending || !selected.length}>
                <Send className="h-4 w-4 mr-2" />
                Enviar {selected.length > 0 ? `(${selected.length})` : ""}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando títulos…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum título em atraso.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="px-2 py-2 w-8">
                          <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                        </th>
                        <th className="px-2 py-2 text-left">Sacado</th>
                        <th className="px-2 py-2 text-left">Cedente</th>
                        <th className="px-2 py-2 text-left">Título</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                        <th className="px-2 py-2 text-center">Venc.</th>
                        <th className="px-2 py-2 text-center">Atraso</th>
                        <th className="px-2 py-2 text-left">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t, i) => (
                        <tr key={`${t.numero_titulo}-${t.sacado_cpf_cnpj}-${i}`} className="border-b hover:bg-muted/30">
                          <td className="px-2 py-2">
                            <Checkbox checked={!!t.selected} onCheckedChange={() => toggleOne(i)} />
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{t.sacado_nome}</div>
                            <div className="text-xs text-muted-foreground">{t.sacado_cpf_cnpj}</div>
                          </td>
                          <td className="px-2 py-2 text-xs">{t.cedente_nome}</td>
                          <td className="px-2 py-2 text-xs">{t.numero_titulo}</td>
                          <td className="px-2 py-2 text-right">{fmtBRL(t.valor)}</td>
                          <td className="px-2 py-2 text-center text-xs">{fmtDate(t.vencimento)}</td>
                          <td className="px-2 py-2 text-center">
                            <Badge variant={t.dias_atraso > 30 ? "destructive" : "secondary"}>
                              {t.dias_atraso}d
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              value={t.telefone ?? ""}
                              onChange={(e) => updateTelefone(i, e.target.value)}
                              placeholder="(00) 00000-0000"
                              className={`h-8 w-40 ${!t.telefone ? "border-destructive/50" : ""}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de envios</CardTitle>
            </CardHeader>
            <CardContent>
              {envios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum envio registrado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="px-2 py-2 text-left">Data</th>
                        <th className="px-2 py-2 text-left">Usuário</th>
                        <th className="px-2 py-2 text-left">Sacado</th>
                        <th className="px-2 py-2 text-left">Telefone</th>
                        <th className="px-2 py-2 text-left">Título</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                        <th className="px-2 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envios.map((e) => (
                        <tr key={e.id} className="border-b hover:bg-muted/30">
                          <td className="px-2 py-2 text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-2 py-2 text-xs">{e.user_name ?? "—"}</td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{e.sacado_nome}</div>
                            <div className="text-xs text-muted-foreground">{e.sacado_cpf_cnpj}</div>
                          </td>
                          <td className="px-2 py-2 text-xs">{e.telefone}</td>
                          <td className="px-2 py-2 text-xs">{e.numero_titulo ?? "—"}</td>
                          <td className="px-2 py-2 text-right">{fmtBRL(Number(e.valor ?? 0))}</td>
                          <td className="px-2 py-2 text-center">
                            {e.status === "enviado" ? (
                              <Badge variant="default" className="bg-green-600">enviado</Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {e.error_message ?? "erro"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
