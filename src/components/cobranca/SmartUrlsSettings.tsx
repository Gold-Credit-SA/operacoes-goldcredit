import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Save } from "lucide-react";
import { toast } from "sonner";

export default function SmartUrlsSettings() {
  const [boletoTpl, setBoletoTpl] = useState("");
  const [nfTpl, setNfTpl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("cobranca_settings")
        .select("boleto_url_template, nf_url_template")
        .eq("id", 1)
        .maybeSingle();
      setBoletoTpl(data?.boleto_url_template ?? "");
      setNfTpl(data?.nf_url_template ?? "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("cobranca_settings")
      .upsert({
        id: 1,
        boleto_url_template: boletoTpl.trim() || null,
        nf_url_template: nfTpl.trim() || null,
        updated_by: u.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("URLs salvas");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />Links do Smart (boleto / NF)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cole o padrão de URL do Smart usando as chaves <code>{"{id_titulo}"}</code>, <code>{"{nosso_numero}"}</code> ou <code>{"{documento}"}</code>.
          Depois use <code>{"{{link_boleto}}"}</code> e <code>{"{{link_nf}}"}</code> nos templates de cobrança.
        </p>

        <div>
          <Label className="text-xs">URL do BOLETO</Label>
          <Input
            value={boletoTpl}
            onChange={(e) => setBoletoTpl(e.target.value)}
            placeholder="https://www.smartsecurities.com.br/smart/boleto.php?id={id_titulo}"
            disabled={loading}
          />
        </div>

        <div>
          <Label className="text-xs">URL da NOTA FISCAL</Label>
          <Input
            value={nfTpl}
            onChange={(e) => setNfTpl(e.target.value)}
            placeholder="https://www.smartsecurities.com.br/smart/nf.php?doc={documento}"
            disabled={loading}
          />
        </div>

        <div className="rounded bg-muted/50 p-3 text-xs space-y-1">
          <div className="font-semibold">Chaves disponíveis:</div>
          <div><code>{"{id_titulo}"}</code> · <code>{"{nosso_numero}"}</code> · <code>{"{documento}"}</code> · <code>{"{cedente_cpf_cnpj}"}</code> · <code>{"{sacado_cpf_cnpj}"}</code></div>
          <div className="text-muted-foreground pt-1">⚠ Se a URL exigir login no Smart, o link só funciona internamente — sacado não conseguirá abrir.</div>
        </div>

        <Button onClick={save} disabled={saving || loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar URLs"}
        </Button>
      </CardContent>
    </Card>
  );
}
