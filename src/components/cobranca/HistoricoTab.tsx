import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, RefreshCw, Eye } from "lucide-react";
import { fmtBRL, fmtDateTime, formatCpfCnpj } from "./utils";
import SacadoDrawer from "./SacadoDrawer";

type Envio = {
  id: string; created_at: string; user_name: string | null; canal: string;
  sacado_nome: string | null; sacado_cpf_cnpj: string;
  telefone: string; email_destinatario: string | null;
  numero_titulo: string | null; valor: number | null;
  cedente_nome: string | null;
  status: string; error_message: string | null; mensagem: string;
};

export default function HistoricoTab() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{ cpf: string; nome: string } | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cobranca_envios").select("*").order("created_at", { ascending: false }).limit(500);
    if (search.trim()) {
      const s = search.trim();
      q = q.or(`sacado_nome.ilike.%${s}%,sacado_cpf_cnpj.ilike.%${s}%,numero_titulo.ilike.%${s}%`);
    }
    const { data } = await q;
    setEnvios((data ?? []) as Envio[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Histórico de envios ({envios.length})</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Sacado, CPF, título..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="w-64 h-9" />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {envios.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum envio.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Data</th>
                  <th>Canal</th>
                  <th>Sacado</th>
                  <th>Título</th>
                  <th className="text-right">Valor</th>
                  <th>Destinatário</th>
                  <th>Operador</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {envios.map(e => (
                  <tr key={e.id} className="border-b hover:bg-muted/20">
                    <td className="py-2 text-xs">{fmtDateTime(e.created_at)}</td>
                    <td>{e.canal === "email" ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}</td>
                    <td>
                      <div className="font-medium">{e.sacado_nome}</div>
                      <div className="text-xs font-mono text-muted-foreground">{formatCpfCnpj(e.sacado_cpf_cnpj)}</div>
                    </td>
                    <td className="font-mono text-xs">{e.numero_titulo ?? "—"}</td>
                    <td className="text-right">{fmtBRL(e.valor)}</td>
                    <td className="text-xs">{e.canal === "email" ? e.email_destinatario : e.telefone}</td>
                    <td className="text-xs">{e.user_name ?? "—"}</td>
                    <td>
                      <Badge variant={e.status === "enviado" ? "default" : "destructive"}>{e.status}</Badge>
                      {e.error_message && <div className="text-[10px] text-destructive mt-0.5">{e.error_message}</div>}
                    </td>
                    <td>
                      <Button variant="ghost" size="icon" onClick={() => setDrawer({ cpf: e.sacado_cpf_cnpj, nome: e.sacado_nome ?? "" })}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {drawer && <SacadoDrawer sacadoCpfCnpj={drawer.cpf} sacadoNome={drawer.nome} onClose={() => setDrawer(null)} />}
    </Card>
  );
}
