import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Plus, Eye, Trash2, Bell, RefreshCw, Upload, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { parseMultipleXmls } from "@/lib/xml-nfe-parser";

interface Monitoramento {
  id: string;
  chave_acesso: string;
  descricao: string | null;
  status: string;
  ultima_consulta_em: string | null;
  ultimo_resultado: any;
  solicitacao_id: string | null;
  created_at: string;
}

interface NfeEvento {
  id: string;
  chave_acesso: string;
  tipo_evento: string | null;
  descricao: string | null;
  data_evento: string | null;
  created_at: string;
}

function fmtChave(c: string) {
  return c.replace(/(\d{4})/g, "$1 ").trim();
}

function fmtMoeda(v?: number) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MonitoramentoNFe() {
  const [items, setItems] = useState<Monitoramento[]>([]);
  const [eventos, setEventos] = useState<NfeEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaveInput, setChaveInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [consultando, setConsultando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Monitoramento | null>(null);
  const [danfePdf, setDanfePdf] = useState<string | null>(null);
  const [danfeLoading, setDanfeLoading] = useState(false);
  const [urlNotif, setUrlNotif] = useState("");
  const [pushUrlConfigurada, setPushUrlConfigurada] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: ev }] = await Promise.all([
      (supabase as any).from("nfe_monitoramento").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("nfe_eventos").select("*").order("data_evento", { ascending: false }).limit(50),
    ]);
    setItems((m as Monitoramento[]) ?? []);
    setEventos((ev as NfeEvento[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function adicionar() {
    const chave = chaveInput.replace(/\D/g, "");
    if (chave.length !== 44) {
      toast.error("Chave deve ter 44 dígitos");
      return;
    }
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdding(false); return; }
    const { error } = await (supabase as any).from("nfe_monitoramento").insert({
      user_id: user.id,
      chave_acesso: chave,
      descricao: descInput || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "Chave já cadastrada" : error.message);
      return;
    }
    setChaveInput(""); setDescInput("");
    toast.success("Chave adicionada");
    load();
  }

  async function importarXmls(files: File[]) {
    const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith(".xml"));
    if (!xmlFiles.length) { toast.error("Selecione arquivos .xml"); return; }
    setAdding(true);
    const contents = await Promise.all(xmlFiles.map(async f => ({ name: f.name, content: await f.text() })));
    const { notas, erros } = parseMultipleXmls(contents);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdding(false); return; }

    let inseridas = 0, duplicadas = 0, falhas = erros.length;
    let primeira: Monitoramento | null = null;

    for (const n of notas) {
      const chave = n.chaveAcesso.replace(/\D/g, "");
      if (chave.length !== 44) { falhas++; continue; }
      const descricao = `NF ${n.numero}${n.serie ? "/" + n.serie : ""} · ${n.emitente.nome}`.slice(0, 200);
      const { data, error } = await (supabase as any)
        .from("nfe_monitoramento")
        .insert({ user_id: user.id, chave_acesso: chave, descricao })
        .select()
        .maybeSingle();
      if (error) {
        if (error.message?.includes("unique") || error.code === "23505") duplicadas++;
        else falhas++;
      } else {
        inseridas++;
        if (!primeira && data) primeira = data as Monitoramento;
      }
    }
    setAdding(false);
    toast.success(`${inseridas} importada(s)${duplicadas ? `, ${duplicadas} já cadastrada(s)` : ""}${falhas ? `, ${falhas} falha(s)` : ""}`);
    await load();
    if (primeira) abrirDetalhes(primeira);
  }

  async function abrirDetalhes(item: Monitoramento) {
    setConsultando(item.id);
    setDetalhe(item);
    setDanfePdf(null);

    // Consulta JSON
    const { data, error } = await supabase.functions.invoke("serpro-nfe", {
      body: { action: "consultar", chave: item.chave_acesso },
    });
    setConsultando(null);
    if (error) { toast.error(error.message); return; }
    if (!data?.ok) {
      toast.error(`Serpro retornou ${data?.status}: ${typeof data?.data === "string" ? data.data : JSON.stringify(data?.data ?? {}).slice(0, 200)}`);
      return;
    }
    setDetalhe({ ...item, ultimo_resultado: data.data });
    load();

    // DANFE em paralelo (best effort)
    setDanfeLoading(true);
    const { data: pdfData } = await supabase.functions.invoke("serpro-nfe", {
      body: { action: "danfe", chave: item.chave_acesso },
    });
    setDanfeLoading(false);
    const b64 = pdfData?.data?.pdf_base64 ?? pdfData?.data?.pdfBase64 ?? pdfData?.data?.danfe ?? null;
    if (pdfData?.ok && b64) setDanfePdf(b64);
  }

  async function excluir(id: string) {
    if (!confirm("Remover esta chave do monitoramento?")) return;
    const { error } = await (supabase as any).from("nfe_monitoramento").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removida");
    load();
  }

  async function configurarPush() {
    if (!urlNotif) { toast.error("Informe a URL"); return; }
    const { data, error } = await supabase.functions.invoke("serpro-nfe", {
      body: { action: "push_set_cliente", urlNotificacao: urlNotif },
    });
    if (error || !data?.ok) {
      toast.error(`Falhou: ${error?.message ?? JSON.stringify(data?.data)}`);
      return;
    }
    toast.success("URL de notificação configurada");
  }

  async function criarSolicitacao() {
    const chaves = items.filter(i => !i.solicitacao_id).map(i => i.chave_acesso);
    if (!chaves.length) { toast.error("Nenhuma chave nova para monitorar"); return; }

    // 1) Garante que a URL de callback está cadastrada na SERPRO (webhook desta plataforma)
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpro-nfe`;
    const setRes = await supabase.functions.invoke("serpro-nfe", {
      body: { action: "push_set_cliente", urlNotificacao: webhookUrl },
    });
    if (setRes.error || !setRes.data?.ok) {
      toast.error(`Falha ao cadastrar URL de callback: ${setRes.error?.message ?? JSON.stringify(setRes.data?.data)}`);
      return;
    }

    // 2) Inscreve as chaves
    const { data, error } = await supabase.functions.invoke("serpro-nfe", {
      body: { action: "push_criar", chaves },
    });
    if (error || !data?.ok) {
      toast.error(`Falhou: ${error?.message ?? JSON.stringify(data?.data)}`);
      return;
    }
    toast.success(`${chaves.length} chave(s) inscritas no PUSH`);
    load();
  }

  const nfe = detalhe?.ultimo_resultado?.nfeProc?.NFe?.infNFe;
  const total = nfe?.total?.ICMSTot;

  return (
    <div className="container max-w-7xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento de NF-e</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consulta e monitoramento de notas fiscais via API SERPRO.
        </p>
      </div>

      <Tabs defaultValue="chaves">
        <TabsList>
          <TabsTrigger value="chaves">Chaves ({items.length})</TabsTrigger>
          <TabsTrigger value="eventos">Eventos ({eventos.length})</TabsTrigger>
          <TabsTrigger value="push">Configurar PUSH</TabsTrigger>
        </TabsList>

        <TabsContent value="chaves" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Adicionar chave</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Chave de acesso (44 dígitos)"
                  value={chaveInput}
                  onChange={(e) => setChaveInput(e.target.value)}
                  className="flex-1 min-w-[300px] font-mono"
                  maxLength={60}
                />
                <Input
                  placeholder="Descrição (opcional)"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-64"
                />
                <Button onClick={adicionar} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>

              <div className="relative border-2 border-dashed rounded-lg p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors">
                <input
                  type="file"
                  accept=".xml"
                  multiple
                  disabled={adding}
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    if (files.length) importarXmls(files);
                    e.target.value = "";
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span>
                    {adding ? "Processando..." : "Importar XMLs de NF-e (chave extraída automaticamente)"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Chaves monitoradas</CardTitle>
              <Button size="sm" variant="outline" onClick={criarSolicitacao}>
                <Bell className="h-4 w-4 mr-1" /> Inscrever no PUSH
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const semInscricao = items.some(i => !i.solicitacao_id);
                const tudoOk = items.length > 0 && !semInscricao;
                if (items.length === 0) return null;
                if (tudoOk) {
                  return (
                    <Alert className="border-emerald-500/40 bg-emerald-500/5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-xs">
                        Todas as chaves estão <strong>inscritas no PUSH</strong>. Você receberá notificação por e-mail a cada evento (autorização, cancelamento, CC-e, manifestação).
                      </AlertDescription>
                    </Alert>
                  );
                }
                return (
                  <Alert variant="destructive" className="bg-amber-500/5 border-amber-500/40 text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Algumas chaves ainda <strong>não estão inscritas no PUSH</strong> — sem isso, a Receita não envia notificações. Clique em <strong>"Inscrever no PUSH"</strong> acima.
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma chave cadastrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chave</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Notificações</TableHead>
                      <TableHead>Última consulta</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{fmtChave(it.chave_acesso)}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{it.descricao || "—"}</TableCell>
                        <TableCell>
                          {it.solicitacao_id ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Ativa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-500/50">
                              <AlertCircle className="h-3 w-3" /> Inativa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {it.ultima_consulta_em ? new Date(it.ultima_consulta_em).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirDetalhes(it)}
                            disabled={consultando === it.id}
                            title="Abrir nota"
                          >
                            {consultando === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => excluir(it.id)} title="Remover">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <DetalheDialog
            item={detalhe}
            onClose={() => { setDetalhe(null); setDanfePdf(null); }}
            nfe={nfe}
            total={total}
            danfePdf={danfePdf}
            danfeLoading={danfeLoading}
            consultando={consultando === detalhe?.id}
            eventos={eventos.filter(e => detalhe && e.chave_acesso === detalhe.chave_acesso)}
          />
        </TabsContent>

        <TabsContent value="eventos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Eventos recebidos via PUSH</CardTitle>
              <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento recebido ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{e.data_evento ? new Date(e.data_evento).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{fmtChave(e.chave_acesso)}</TableCell>
                        <TableCell>{e.tipo_evento || "—"}</TableCell>
                        <TableCell>{e.descricao || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="push">
          <Card>
            <CardHeader><CardTitle className="text-base">URL de notificação</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                A SERPRO enviará POST para esta URL sempre que houver evento numa chave inscrita.
                Use o webhook desta plataforma:
              </p>
              <code className="block p-3 bg-muted rounded text-xs break-all">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpro-nfe`}
              </code>
              <p className="text-xs text-muted-foreground">
                (envie no body <code>{`{ "action": "webhook", "chaveNFe": "...", "dataHoraEnvio": "..." }`}</code>)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://seu-endpoint.com/notificacao"
                  value={urlNotif}
                  onChange={(e) => setUrlNotif(e.target.value)}
                />
                <Button onClick={configurarPush}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}

function DetalheDialog({
  item, onClose, nfe, total, danfePdf, danfeLoading, consultando, eventos,
}: {
  item: Monitoramento | null;
  onClose: () => void;
  nfe: any;
  total: any;
  danfePdf: string | null;
  danfeLoading: boolean;
  consultando: boolean;
  eventos: NfeEvento[];
}) {
  const pdfUrl = useMemo(() => {
    if (!danfePdf) return null;
    const bin = atob(danfePdf);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
  }, [danfePdf]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            NF-e {nfe?.ide?.nNF ?? "—"}{nfe?.ide?.serie ? `/${nfe.ide.serie}` : ""}
            {item?.solicitacao_id ? (
              <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600 text-white">Notificações ativas</Badge>
            ) : (
              <Badge variant="outline" className="ml-2 text-amber-700 border-amber-500/50">Sem notificação</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {consultando ? (
          <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Consultando SERPRO...
          </div>
        ) : !item?.ultimo_resultado ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados ainda.</p>
        ) : (
          <div className="space-y-6 mt-2">
            {/* Section 1: PDF da nota */}
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">DANFE</h3>
              {danfeLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground border rounded">
                  <Loader2 className="h-5 w-5 animate-spin" /> Gerando PDF...
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-[70vh] border rounded" title="DANFE" />
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    PDF da DANFE indisponível para esta nota.
                  </AlertDescription>
                </Alert>
              )}
            </section>

            {/* Section 2: Movimentações */}
            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Movimentações ({eventos.length})
              </h3>
              {eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded">
                  Nenhuma movimentação recebida para esta chave ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">{e.data_evento ? new Date(e.data_evento).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell>{e.tipo_evento || "—"}</TableCell>
                        <TableCell>{e.descricao || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
