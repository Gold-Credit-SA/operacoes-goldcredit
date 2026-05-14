import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(r => r.json())
      .then(j => {
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  async function confirmar() {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error || !data?.success) setState("error"); else setState("done");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Cancelar inscrição</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state === "loading" && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando…</div>}
          {state === "invalid" && <p className="text-destructive">Link inválido ou expirado.</p>}
          {state === "already" && <p>Este e-mail já foi descadastrado anteriormente.</p>}
          {state === "valid" && (
            <>
              <p>Tem certeza que deseja parar de receber e-mails desta plataforma?</p>
              <Button onClick={confirmar} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}
          {state === "done" && <p className="text-primary">Pronto! Você não receberá mais e-mails desta plataforma.</p>}
          {state === "error" && <p className="text-destructive">Erro ao processar. Tente novamente mais tarde.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
