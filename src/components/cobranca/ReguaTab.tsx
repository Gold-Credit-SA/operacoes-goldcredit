import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import type { Regua, Template } from "./utils";
import SmartUrlsSettings from "./SmartUrlsSettings";

export default function ReguaTab() {
  const [regua, setRegua] = useState<Regua[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reguaDlg, setReguaDlg] = useState<Partial<Regua> | null>(null);
  const [tplDlg, setTplDlg] = useState<Partial<Template> | null>(null);

  const load = async () => {
    const [r, t] = await Promise.all([
      supabase.from("cobranca_regua").select("*").order("ordem"),
      supabase.from("cobranca_templates").select("*").order("nome"),
    ]);
    setRegua((r.data ?? []) as Regua[]);
    setTemplates((t.data ?? []) as Template[]);
  };
  useEffect(() => { load(); }, []);

  const saveRegua = async () => {
    if (!reguaDlg?.nome || reguaDlg.dias_min == null) { toast.error("Preencha nome e dias mínimos"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      nome: reguaDlg.nome,
      dias_min: Number(reguaDlg.dias_min),
      dias_max: reguaDlg.dias_max != null ? Number(reguaDlg.dias_max) : null,
      canal: reguaDlg.canal ?? "whatsapp",
      template_id: reguaDlg.template_id ?? null,
      ordem: reguaDlg.ordem ?? 0,
      ativo: reguaDlg.ativo ?? true,
      created_by: u.user.id,
    };
    const res = reguaDlg.id
      ? await supabase.from("cobranca_regua").update(payload).eq("id", reguaDlg.id)
      : await supabase.from("cobranca_regua").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("Faixa salva"); setReguaDlg(null); load(); }
  };

  const delRegua = async (id: string) => {
    if (!confirm("Excluir faixa?")) return;
    const { error } = await supabase.from("cobranca_regua").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  };

  const saveTpl = async () => {
    if (!tplDlg?.nome || !tplDlg.mensagem) { toast.error("Preencha nome e mensagem"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      nome: tplDlg.nome,
      mensagem: tplDlg.mensagem,
      canal: tplDlg.canal ?? "whatsapp",
      assunto: tplDlg.assunto ?? null,
      created_by: u.user.id,
    };
    const res = tplDlg.id
      ? await supabase.from("cobranca_templates").update(payload).eq("id", tplDlg.id)
      : await supabase.from("cobranca_templates").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("Template salvo"); setTplDlg(null); load(); }
  };

  const delTpl = async (id: string) => {
    if (!confirm("Excluir template?")) return;
    const { error } = await supabase.from("cobranca_templates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  return (
    <div className="space-y-6">
      <SmartUrlsSettings />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Régua */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Faixas de cobrança</CardTitle>
          <Button size="sm" onClick={() => setReguaDlg({ canal: "whatsapp", ativo: true, ordem: regua.length })}>
            <Plus className="h-4 w-4 mr-1" />Nova faixa
          </Button>
        </CardHeader>
        <CardContent>
          {regua.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma faixa cadastrada.</p> : (
            <div className="space-y-2">
              {regua.map(r => {
                const tpl = templates.find(t => t.id === r.template_id);
                return (
                  <div key={r.id} className="flex items-center justify-between border rounded p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.nome}</span>
                        {r.canal === "email" ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                        {!r.ativo && <Badge variant="outline">inativo</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.dias_min}{r.dias_max != null ? `–${r.dias_max}` : "+"} dias · {tpl ? `template: ${tpl.nome}` : "sem template"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setReguaDlg(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => delRegua(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Templates de mensagem</CardTitle>
          <Button size="sm" onClick={() => setTplDlg({ canal: "whatsapp" })}>
            <Plus className="h-4 w-4 mr-1" />Novo template
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum template.</p> : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-start justify-between border rounded p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.nome}</span>
                      {t.canal === "email" ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.mensagem}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setTplDlg(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => delTpl(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Régua */}
      <Dialog open={!!reguaDlg} onOpenChange={(o) => !o && setReguaDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reguaDlg?.id ? "Editar faixa" : "Nova faixa"}</DialogTitle></DialogHeader>
          {reguaDlg && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={reguaDlg.nome ?? ""} onChange={(e) => setReguaDlg({ ...reguaDlg, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dias mín.</Label><Input type="number" value={reguaDlg.dias_min ?? ""} onChange={(e) => setReguaDlg({ ...reguaDlg, dias_min: Number(e.target.value) })} /></div>
                <div><Label>Dias máx. (vazio = sem limite)</Label><Input type="number" value={reguaDlg.dias_max ?? ""} onChange={(e) => setReguaDlg({ ...reguaDlg, dias_max: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={reguaDlg.canal ?? "whatsapp"} onValueChange={(v) => setReguaDlg({ ...reguaDlg, canal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={reguaDlg.template_id ?? "none"} onValueChange={(v) => setReguaDlg({ ...reguaDlg, template_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(nenhum)</SelectItem>
                    {templates.filter(t => !t.canal || t.canal === (reguaDlg?.canal ?? "whatsapp")).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={reguaDlg.ativo ?? true} onCheckedChange={(v) => setReguaDlg({ ...reguaDlg, ativo: v })} />
                <Label>Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveRegua}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Template */}
      <Dialog open={!!tplDlg} onOpenChange={(o) => !o && setTplDlg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{tplDlg?.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
          {tplDlg && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={tplDlg.nome ?? ""} onChange={(e) => setTplDlg({ ...tplDlg, nome: e.target.value })} /></div>
              <div>
                <Label>Canal</Label>
                <Select value={tplDlg.canal ?? "whatsapp"} onValueChange={(v) => setTplDlg({ ...tplDlg, canal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent>
                </Select>
              </div>
              {tplDlg.canal === "email" && (
                <div><Label>Assunto</Label><Input value={tplDlg.assunto ?? ""} onChange={(e) => setTplDlg({ ...tplDlg, assunto: e.target.value })} /></div>
              )}
              <div>
                <Label>Mensagem</Label>
                <Textarea rows={8} value={tplDlg.mensagem ?? ""} onChange={(e) => setTplDlg({ ...tplDlg, mensagem: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {`{{sacado_nome}} {{valor}} {{vencimento}} {{dias_atraso}} {{numero_titulo}} {{cedente_nome}}`}</p>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveTpl}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
