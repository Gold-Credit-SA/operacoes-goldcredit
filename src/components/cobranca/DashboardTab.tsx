import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Wallet, TrendingDown, Send, Calendar, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { fmtBRL, formatCpfCnpj } from "./utils";
import { toast } from "sonner";

type Dash = {
  totalAberto: number; totalAtraso: number;
  qtdAberto: number; qtdAtraso: number;
  aging: { faixa: string; qtd: number; valor: number }[];
  topDevedores: { sacado_nome: string; sacado_cpf_cnpj: string; total: number; qtd: number; max_atraso: number }[];
  enviosUlt7: number;
  promessasProximas: { id: string; data_prometida: string; valor_prometido: number; sacado_cpf_cnpj: string }[];
};

const COLORS = ["hsl(var(--primary))", "hsl(45 90% 55%)", "hsl(25 85% 55%)", "hsl(0 75% 55%)"];

export default function DashboardTab({ onCobrarAgora }: { onCobrarAgora: () => void }) {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("cobranca-whatsapp", {
        body: { action: "dashboard" },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res.data);
    } catch (e: any) {
      toast.error("Falha ao carregar dashboard: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Visão geral da inadimplência</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
          <Button size="sm" onClick={onCobrarAgora}><Send className="h-4 w-4 mr-2" />Cobrar agora</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI icon={<Wallet className="h-5 w-5" />} label="Total em aberto" value={fmtBRL(data.totalAberto)} sub={`${data.qtdAberto} títulos`} />
        <KPI icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label="Em atraso" value={fmtBRL(data.totalAtraso)} sub={`${data.qtdAtraso} títulos`} highlight />
        <KPI icon={<TrendingDown className="h-5 w-5" />} label="% inadimplência" value={data.totalAberto > 0 ? `${((data.totalAtraso / data.totalAberto) * 100).toFixed(1)}%` : "0%"} sub="sobre carteira aberta" />
        <KPI icon={<Send className="h-5 w-5" />} label="Envios (7d)" value={String(data.enviosUlt7)} sub="cobranças disparadas" />
      </div>

      {/* Aging + Promessas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Aging da inadimplência</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.aging}>
                <XAxis dataKey="faixa" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Bar dataKey="valor">
                  {data.aging.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-4 text-center text-xs text-muted-foreground mt-2">
              {data.aging.map(a => <div key={a.faixa}>{a.qtd} títulos</div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Promessas próximas (7 dias)</CardTitle></CardHeader>
          <CardContent>
            {data.promessasProximas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma promessa vencendo</p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-auto">
                {data.promessasProximas.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                    <div>
                      <div className="font-mono text-xs">{formatCpfCnpj(p.sacado_cpf_cnpj)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(p.data_prometida).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div className="font-semibold">{fmtBRL(p.valor_prometido)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top devedores */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 devedores</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">#</th>
                  <th>Sacado</th>
                  <th>CPF/CNPJ</th>
                  <th className="text-right">Títulos</th>
                  <th className="text-right">Atraso máx.</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topDevedores.map((d, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-2">{i + 1}</td>
                    <td className="font-medium">{d.sacado_nome}</td>
                    <td className="font-mono text-xs">{formatCpfCnpj(d.sacado_cpf_cnpj)}</td>
                    <td className="text-right">{d.qtd}</td>
                    <td className="text-right"><Badge variant={d.max_atraso > 90 ? "destructive" : "secondary"}>{d.max_atraso}d</Badge></td>
                    <td className="text-right font-semibold">{fmtBRL(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive/40" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
