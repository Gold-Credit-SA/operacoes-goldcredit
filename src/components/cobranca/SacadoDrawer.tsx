import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, FileText, MessageSquare, Calendar, Handshake, Plus, Trash2 } from "lucide-react";
import { fmtBRL, fmtDate, fmtDateTime, formatCpfCnpj } from "./utils";
import { toast } from "sonner";

interface Props {
  sacadoCpfCnpj: string;
  sacadoNome?: string;
  onClose: () => void;
}

export default function SacadoDrawer({ sacadoCpfCnpj, sacadoNome, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [novaNota, setNovaNota] = useState("");
  const [novaPromessa, setNovaPromessa] = useState<{ data_prometida: string; valor_prometido: string; observacao: string }>({ data_prometida: "", valor_prometido: "", observacao: "" });

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("cobranca-whatsapp", {
      body: { action: "timeline", sacadoCpfCnpj },
    });
    if (error) toast.error(error.message); else setData(res?.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [sacadoCpfCnpj]);

  const addNota = async () => {
    if (!novaNota.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles").select("name").eq("user_id", u.user.id).maybeSingle();
    const { error } = await supabase.from("cobranca_notas").insert({
      sacado_cpf_cnpj: sacadoCpfCnpj, conteudo: novaNota,
      created_by: u.user.id, created_by_name: p?.name ?? u.user.email,
    });
    if (error) toast.error(error.message); else { setNovaNota(""); toast.success("Nota adicionada"); load(); }
  };

  const delNota = async (id: string) => {
    const { error } = await supabase.from("cobranca_notas").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const addPromessa = async () => {
    if (!novaPromessa.data_prometida) { toast.error("Data obrigatória"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles").select("name").eq("user_id", u.user.id).maybeSingle();
    const { error } = await supabase.from("cobranca_promessas").insert({
      sacado_cpf_cnpj: sacadoCpfCnpj,
      data_prometida: novaPromessa.data_prometida,
      valor_prometido: novaPromessa.valor_prometido ? Number(novaPromessa.valor_prometido) : null,
      observacao: novaPromessa.observacao || null,
      created_by: u.user.id, created_by_name: p?.name ?? u.user.email,
    });
    if (error) toast.error(error.message); else {
      setNovaPromessa({ data_prometida: "", valor_prometido: "", observacao: "" });
      toast.success("Promessa registrada"); load();
    }
  };

  const togglePromessa = async (id: string, cumprida: boolean) => {
    const { error } = await supabase.from("cobranca_promessas").update({ cumprida }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const setStatusTitulo = async (cedente: string, numero: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("cobranca_titulo_status").upsert({
      cedente_cpf_cnpj: cedente, numero_titulo: numero,
      sacado_cpf_cnpj: sacadoCpfCnpj, sacado_nome: sacadoNome,
      status: status as any, updated_by: u.user.id,
    }, { onConflict: "cedente_cpf_cnpj,numero_titulo" });
    if (error) toast.error(error.message); else { toast.success("Status atualizado"); load(); }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sacadoNome || "Sacado"}</SheetTitle>
          <p className="text-xs font-mono text-muted-foreground">{formatCpfCnpj(sacadoCpfCnpj)}</p>
        </SheetHeader>

        {loading ? <Skeleton className="h-96 w-full mt-4" /> : data && (
          <Tabs defaultValue="titulos" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="titulos"><FileText className="h-3.5 w-3.5 mr-1" />Títulos</TabsTrigger>
              <TabsTrigger value="historico"><MessageSquare className="h-3.5 w-3.5 mr-1" />Envios</TabsTrigger>
              <TabsTrigger value="notas"><MessageSquare className="h-3.5 w-3.5 mr-1" />Notas</TabsTrigger>
              <TabsTrigger value="promessas"><Calendar className="h-3.5 w-3.5 mr-1" />Promessas</TabsTrigger>
            </TabsList>

            <TabsContent value="titulos" className="space-y-2 mt-4">
              {data.titulosAbertos?.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum título em aberto</p> :
                data.titulosAbertos?.map((t: any) => (
                  <div key={`${t.cedente_cpf_cnpj}-${t.numero_titulo}`} className="border rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{t.numero_titulo}</div>
                        <div className="text-xs text-muted-foreground">{t.cedente_nome}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmtBRL(t.valor)}</div>
                        <Badge variant={t.dias_atraso > 90 ? "destructive" : t.dias_atraso > 0 ? "secondary" : "outline"}>
                          {t.dias_atraso > 0 ? `${t.dias_atraso}d atraso` : "em dia"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <Select onValueChange={(v) => setStatusTitulo(t.cedente_cpf_cnpj, t.numero_titulo, v)}>
                        <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Definir status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="em_dia">Em dia</SelectItem>
                          <SelectItem value="notificado">Notificado</SelectItem>
                          <SelectItem value="em_negociacao">Em negociação</SelectItem>
                          <SelectItem value="acordo">Acordo</SelectItem>
                          <SelectItem value="protestado">Protestado</SelectItem>
                          <SelectItem value="quitado">Quitado</SelectItem>
                          <SelectItem value="incobravel">Incobrável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="historico" className="space-y-2 mt-4">
              {data.envios?.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum envio</p> :
                data.envios?.map((e: any) => (
                  <div key={e.id} className="border rounded p-3 text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        {e.canal === "email" ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                        <span className="text-xs">{fmtDateTime(e.created_at)}</span>
                        <Badge variant={e.status === "enviado" ? "default" : "destructive"} className="text-[10px]">{e.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{e.user_name}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground line-clamp-3">{e.mensagem}</p>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="notas" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Textarea placeholder="Adicionar nota..." value={novaNota} onChange={(e) => setNovaNota(e.target.value)} rows={2} />
                <Button size="sm" onClick={addNota}><Plus className="h-4 w-4 mr-1" />Adicionar nota</Button>
              </div>
              {data.notas?.map((n: any) => (
                <div key={n.id} className="border rounded p-3 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-muted-foreground">{n.created_by_name} · {fmtDateTime(n.created_at)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => delNota(n.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.conteudo}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="promessas" className="space-y-3 mt-4">
              <div className="border rounded p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Data prometida</Label><Input type="date" value={novaPromessa.data_prometida} onChange={(e) => setNovaPromessa({ ...novaPromessa, data_prometida: e.target.value })} /></div>
                  <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={novaPromessa.valor_prometido} onChange={(e) => setNovaPromessa({ ...novaPromessa, valor_prometido: e.target.value })} /></div>
                </div>
                <Textarea placeholder="Observação" rows={2} value={novaPromessa.observacao} onChange={(e) => setNovaPromessa({ ...novaPromessa, observacao: e.target.value })} />
                <Button size="sm" onClick={addPromessa}><Plus className="h-4 w-4 mr-1" />Registrar promessa</Button>
              </div>
              {data.promessas?.map((p: any) => (
                <div key={p.id} className="border rounded p-3 text-sm flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">{fmtDate(p.data_prometida)}</span>
                      {p.valor_prometido && <span className="font-semibold">{fmtBRL(p.valor_prometido)}</span>}
                      {p.cumprida && <Badge variant="default">cumprida</Badge>}
                    </div>
                    {p.observacao && <p className="text-xs mt-1 text-muted-foreground">{p.observacao}</p>}
                  </div>
                  <Button size="sm" variant={p.cumprida ? "outline" : "default"} onClick={() => togglePromessa(p.id, !p.cumprida)}>
                    {p.cumprida ? "Reabrir" : "Marcar paga"}
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
