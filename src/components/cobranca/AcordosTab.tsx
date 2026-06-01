import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDate, formatCpfCnpj } from "./utils";

type Acordo = {
  id: string;
  sacado_cpf_cnpj: string; sacado_nome: string | null;
  cedente_cpf_cnpj: string | null; cedente_nome: string | null;
  titulos_originais: any[];
  valor_original: number; valor_acordo: number; desconto: number;
  qtd_parcelas: number; primeiro_vencimento: string;
  parcelas: { numero: number; vencimento: string; valor: number; pago: boolean }[];
  status: string;
  observacao: string | null;
  created_at: string; created_by_name: string | null;
};

const calcParcelas = (valor: number, qtd: number, primeiro: string) => {
  const base = +(valor / qtd).toFixed(2);
  const arr: any[] = [];
  let resto = +(valor - base * qtd).toFixed(2);
  const d0 = new Date(primeiro + "T00:00:00");
  for (let i = 0; i < qtd; i++) {
    const d = new Date(d0); d.setMonth(d.getMonth() + i);
    const v = i === qtd - 1 ? +(base + resto).toFixed(2) : base;
    arr.push({ numero: i + 1, vencimento: d.toISOString().slice(0, 10), valor: v, pago: false });
  }
  return arr;
};

export default function AcordosTab() {
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [filter, setFilter] = useState<"todos" | "ativo" | "concluido" | "cancelado">("todos");
  const [dlg, setDlg] = useState<Partial<Acordo> | null>(null);

  const load = async () => {
    let q = supabase.from("cobranca_acordos").select("*").order("created_at", { ascending: false });
    if (filter !== "todos") q = q.eq("status", filter);
    const { data } = await q;
    setAcordos((data ?? []) as Acordo[]);
  };
  useEffect(() => { load(); }, [filter]);

  const novo = () => setDlg({
    sacado_cpf_cnpj: "", sacado_nome: "", cedente_cpf_cnpj: "", cedente_nome: "",
    valor_original: 0, valor_acordo: 0, desconto: 0,
    qtd_parcelas: 1, primeiro_vencimento: new Date().toISOString().slice(0, 10),
    titulos_originais: [], status: "ativo",
  });

  const parcelasPreview = useMemo(() => {
    if (!dlg?.valor_acordo || !dlg?.qtd_parcelas || !dlg?.primeiro_vencimento) return [];
    return calcParcelas(Number(dlg.valor_acordo), Number(dlg.qtd_parcelas), dlg.primeiro_vencimento as string);
  }, [dlg?.valor_acordo, dlg?.qtd_parcelas, dlg?.primeiro_vencimento]);

  const salvar = async () => {
    if (!dlg?.sacado_cpf_cnpj || !dlg?.valor_acordo || !dlg?.primeiro_vencimento) { toast.error("Preencha sacado, valor e 1º vencimento"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", u.user.id).maybeSingle();
    const payload = {
      sacado_cpf_cnpj: dlg.sacado_cpf_cnpj,
      sacado_nome: dlg.sacado_nome ?? null,
      cedente_cpf_cnpj: dlg.cedente_cpf_cnpj ?? null,
      cedente_nome: dlg.cedente_nome ?? null,
      titulos_originais: dlg.titulos_originais ?? [],
      valor_original: Number(dlg.valor_original ?? dlg.valor_acordo),
      valor_acordo: Number(dlg.valor_acordo),
      desconto: Number(dlg.desconto ?? 0),
      qtd_parcelas: Number(dlg.qtd_parcelas ?? 1),
      primeiro_vencimento: dlg.primeiro_vencimento,
      parcelas: parcelasPreview,
      status: dlg.status ?? "ativo",
      observacao: dlg.observacao ?? null,
      created_by: u.user.id,
      created_by_name: profile?.name ?? u.user.email,
    };
    const res = dlg.id
      ? await supabase.from("cobranca_acordos").update(payload).eq("id", dlg.id)
      : await supabase.from("cobranca_acordos").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("Acordo salvo"); setDlg(null); load(); }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir acordo?")) return;
    const { error } = await supabase.from("cobranca_acordos").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("cobranca_acordos").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Acordos ({acordos.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={novo}><Plus className="h-4 w-4 mr-1" />Novo acordo</Button>
          </div>
        </CardHeader>
        <CardContent>
          {acordos.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum acordo.</p> : (
            <div className="space-y-3">
              {acordos.map(a => (
                <div key={a.id} className="border rounded p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{a.sacado_nome ?? formatCpfCnpj(a.sacado_cpf_cnpj)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(a.sacado_cpf_cnpj)} · {a.cedente_nome}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "ativo" ? "default" : a.status === "concluido" ? "secondary" : "outline"}>{a.status}</Badge>
                      <Select value={a.status} onValueChange={(v) => mudarStatus(a.id, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => excluir(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                    <div><div className="text-xs text-muted-foreground">Valor original</div><div className="font-semibold">{fmtBRL(a.valor_original)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Valor acordo</div><div className="font-semibold">{fmtBRL(a.valor_acordo)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Desconto</div><div className="font-semibold">{fmtBRL(a.desconto)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Parcelas</div><div className="font-semibold">{a.qtd_parcelas}x</div></div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">Parcelas:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {a.parcelas?.map(p => (
                      <div key={p.numero} className={`text-xs border rounded px-2 py-1 ${p.pago ? "bg-green-50 dark:bg-green-950/20" : ""}`}>
                        #{p.numero} · {fmtDate(p.vencimento)} · {fmtBRL(p.valor)} {p.pago && <Badge variant="outline" className="ml-1">pago</Badge>}
                      </div>
                    ))}
                  </div>
                  {a.observacao && <p className="text-xs mt-2 italic text-muted-foreground">{a.observacao}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dlg?.id ? "Editar acordo" : "Novo acordo"}</DialogTitle></DialogHeader>
          {dlg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sacado CPF/CNPJ</Label><Input value={dlg.sacado_cpf_cnpj ?? ""} onChange={(e) => setDlg({ ...dlg, sacado_cpf_cnpj: e.target.value.replace(/\D/g, "") })} /></div>
                <div><Label>Sacado nome</Label><Input value={dlg.sacado_nome ?? ""} onChange={(e) => setDlg({ ...dlg, sacado_nome: e.target.value })} /></div>
                <div><Label>Cedente CPF/CNPJ</Label><Input value={dlg.cedente_cpf_cnpj ?? ""} onChange={(e) => setDlg({ ...dlg, cedente_cpf_cnpj: e.target.value.replace(/\D/g, "") })} /></div>
                <div><Label>Cedente nome</Label><Input value={dlg.cedente_nome ?? ""} onChange={(e) => setDlg({ ...dlg, cedente_nome: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Valor original</Label><Input type="number" step="0.01" value={dlg.valor_original ?? ""} onChange={(e) => setDlg({ ...dlg, valor_original: Number(e.target.value) })} /></div>
                <div><Label>Valor acordo</Label><Input type="number" step="0.01" value={dlg.valor_acordo ?? ""} onChange={(e) => setDlg({ ...dlg, valor_acordo: Number(e.target.value), desconto: Number(dlg.valor_original ?? 0) - Number(e.target.value) })} /></div>
                <div><Label>Desconto</Label><Input type="number" step="0.01" value={dlg.desconto ?? 0} readOnly /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nº parcelas</Label><Input type="number" min="1" value={dlg.qtd_parcelas ?? 1} onChange={(e) => setDlg({ ...dlg, qtd_parcelas: Number(e.target.value) })} /></div>
                <div><Label>1º vencimento</Label><Input type="date" value={dlg.primeiro_vencimento as string ?? ""} onChange={(e) => setDlg({ ...dlg, primeiro_vencimento: e.target.value })} /></div>
              </div>
              {parcelasPreview.length > 0 && (
                <div className="border rounded p-2 max-h-40 overflow-y-auto text-xs space-y-1 bg-muted/30">
                  {parcelasPreview.map(p => <div key={p.numero} className="flex justify-between"><span>#{p.numero} · {fmtDate(p.vencimento)}</span><span className="font-semibold">{fmtBRL(p.valor)}</span></div>)}
                </div>
              )}
              <div><Label>Observação</Label><Textarea rows={2} value={dlg.observacao ?? ""} onChange={(e) => setDlg({ ...dlg, observacao: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={salvar}>Salvar acordo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
