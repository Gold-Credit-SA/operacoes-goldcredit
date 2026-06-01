import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, RefreshCw, Phone, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDate, formatCpfCnpj, type Titulo, type Template } from "./utils";

export default function SugestoesTab() {
  const [titulos, setTitulos] = useState<(Titulo & { selected?: boolean; telefoneEdit?: string; emailEdit?: string })[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [templateId, setTemplateId] = useState<string>("");
  const [assunto, setAssunto] = useState("Aviso de cobrança - título {{numero_titulo}}");
  const [mensagem, setMensagem] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [sug, tpl] = await Promise.all([
        supabase.functions.invoke("cobranca-whatsapp", { body: { action: "suggestions" } }),
        supabase.from("cobranca_templates").select("*").order("nome"),
      ]);
      if (sug.error) throw sug.error;
      setTitulos((sug.data?.data ?? []).map((t: any) => ({ ...t, selected: false, telefoneEdit: t.telefone ?? "", emailEdit: t.email ?? "" })));
      setTemplates((tpl.data ?? []) as Template[]);
    } catch (e: any) {
      toast.error("Erro ao carregar sugestões: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Update mensagem when template changes
  useEffect(() => {
    if (!templateId) return;
    const t = templates.find(x => x.id === templateId);
    if (t) {
      setMensagem(t.mensagem);
      if (t.assunto) setAssunto(t.assunto);
      if (t.canal === "whatsapp" || t.canal === "email") setCanal(t.canal as any);
    }
  }, [templateId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return titulos;
    return titulos.filter(t =>
      t.sacado_nome?.toLowerCase().includes(q) ||
      t.cedente_nome?.toLowerCase().includes(q) ||
      t.sacado_cpf_cnpj?.includes(q) ||
      t.numero_titulo?.toLowerCase().includes(q)
    );
  }, [titulos, search]);

  const selectedItems = titulos.filter(t => t.selected);
  const toggleAll = (v: boolean) => setTitulos(titulos.map(t => ({ ...t, selected: v && filtered.includes(t) })));
  const toggle = (i: number, v: boolean) => setTitulos(titulos.map((t, idx) => idx === i ? { ...t, selected: v } : t));
  const updateContact = (i: number, field: "telefoneEdit" | "emailEdit", v: string) =>
    setTitulos(titulos.map((t, idx) => idx === i ? { ...t, [field]: v } : t));

  const enviar = async () => {
    if (selectedItems.length === 0) { toast.error("Selecione ao menos um título"); return; }
    if (!mensagem.trim()) { toast.error("Escreva a mensagem"); return; }
    if (canal === "email" && !assunto.trim()) { toast.error("Defina o assunto do e-mail"); return; }

    setSending(true);
    try {
      const items = selectedItems.map(t => ({
        telefone: t.telefoneEdit ?? t.telefone ?? "",
        email: t.emailEdit ?? t.email ?? "",
        sacado_cpf_cnpj: t.sacado_cpf_cnpj,
        sacado_nome: t.sacado_nome,
        cedente_cpf_cnpj: t.cedente_cpf_cnpj,
        cedente_nome: t.cedente_nome,
        numero_titulo: t.numero_titulo,
        id_titulo: t.id_titulo ?? null,
        nosso_numero: t.nosso_numero ?? null,
        valor: t.valor,
        vencimento: t.vencimento,
        dias_atraso: t.dias_atraso,
      }));
      const { data, error } = await supabase.functions.invoke("cobranca-whatsapp", {
        body: { action: "send-batch", canal, template: mensagem, assunto, items },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.enviados} enviados, ${data.erros} erros`);
      await load();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    } finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Fila de cobrança ({filtered.length})</CardTitle>
          <div className="flex gap-2 items-center">
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-8" />
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Nenhum título sugerido para cobrança</p>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 w-8"><Checkbox checked={filtered.length > 0 && filtered.every(t => t.selected)} onCheckedChange={(v) => toggleAll(!!v)} /></th>
                    <th>Sacado</th>
                    <th>Cedente</th>
                    <th>Título</th>
                    <th className="text-right">Valor</th>
                    <th>Atraso</th>
                    <th>Faixa</th>
                    <th>{canal === "email" ? "E-mail" : "Telefone"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const idx = titulos.indexOf(t);
                    return (
                      <tr key={`${t.cedente_cpf_cnpj}-${t.numero_titulo}`} className="border-b hover:bg-muted/20">
                        <td className="py-2"><Checkbox checked={!!t.selected} onCheckedChange={(v) => toggle(idx, !!v)} /></td>
                        <td>
                          <div className="font-medium">{t.sacado_nome}</div>
                          <div className="font-mono text-xs text-muted-foreground">{formatCpfCnpj(t.sacado_cpf_cnpj)}</div>
                        </td>
                        <td className="text-xs">{t.cedente_nome}</td>
                        <td className="font-mono text-xs">{t.numero_titulo}</td>
                        <td className="text-right font-semibold">{fmtBRL(t.valor)}</td>
                        <td><Badge variant={t.dias_atraso > 90 ? "destructive" : t.dias_atraso > 30 ? "secondary" : "outline"}>{t.dias_atraso}d</Badge></td>
                        <td className="text-xs">{t.faixa_nome ?? <span className="text-muted-foreground">—</span>}</td>
                        <td>
                          {canal === "email" ? (
                            <Input value={t.emailEdit ?? ""} onChange={(e) => updateContact(idx, "emailEdit", e.target.value)} placeholder="email@..." className="h-7 text-xs w-44" />
                          ) : (
                            <Input value={t.telefoneEdit ?? ""} onChange={(e) => updateContact(idx, "telefoneEdit", e.target.value)} placeholder="(11) 9..." className="h-7 text-xs w-36" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Painel de envio */}
      <Card className="h-fit sticky top-4">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Disparar cobrança</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 p-1 bg-muted rounded">
            <button onClick={() => setCanal("whatsapp")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm rounded ${canal === "whatsapp" ? "bg-background shadow font-medium" : ""}`}>
              <Phone className="h-3.5 w-3.5" />WhatsApp
            </button>
            <button onClick={() => setCanal("email")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm rounded ${canal === "email" ? "bg-background shadow font-medium" : ""}`}>
              <Mail className="h-3.5 w-3.5" />E-mail
            </button>
          </div>

          <div>
            <Label className="text-xs">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Escolher template..." /></SelectTrigger>
              <SelectContent>
                {templates.filter(t => !t.canal || t.canal === canal).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canal === "email" && (
            <div>
              <Label className="text-xs">Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
          )}

          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={8} placeholder="Use {{sacado_nome}}, {{valor}}, {{vencimento}}, {{dias_atraso}}, {{numero_titulo}}, {{cedente_nome}}" />
            <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {`{{sacado_nome}} {{valor}} {{vencimento}} {{dias_atraso}} {{numero_titulo}} {{cedente_nome}}`}</p>
          </div>

          <div className="rounded bg-muted/50 p-2 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>{selectedItems.length} título(s) selecionado(s) — total {fmtBRL(selectedItems.reduce((s, t) => s + t.valor, 0))}</div>
          </div>

          <Button onClick={enviar} disabled={sending || selectedItems.length === 0 || !mensagem.trim()} className="w-full">
            {sending ? "Enviando..." : `Enviar ${selectedItems.length} cobrança(s)`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
