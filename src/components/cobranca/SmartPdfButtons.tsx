import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tituloId: string | number;
  /**
   * `checks` é o identificador específico do portal Smart pra gerar boleto
   * (ex: "21467,"). Quando vier preenchido, o botão de boleto fica ativo sem
   * abrir diálogo. Quando vier undefined, o diálogo pede que o usuário cole
   * o valor manualmente — solução temporária até descobrirmos de onde vem
   * automaticamente.
   */
  checks?: string;
  /** Esconde o botão de NF (alguns contextos só baixam boleto). */
  hideNfButton?: boolean;
  /** Esconde o botão de Boleto. */
  hideBoletoButton?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
}

type Loading = "boleto" | "nf" | null;

interface ScraperResponse {
  success: boolean;
  signed_url?: string;
  expires_at?: string;
  from_cache?: boolean;
  error_code?: string;
  message?: string;
}

export function SmartPdfButtons({
  tituloId,
  checks,
  hideNfButton = false,
  hideBoletoButton = false,
  className,
  size = "sm",
  variant = "outline",
}: Props) {
  const [loading, setLoading] = useState<Loading>(null);
  const [askChecksOpen, setAskChecksOpen] = useState(false);
  const [checksInput, setChecksInput] = useState("");

  async function fetchPdf(tipo: "boleto" | "nf", checksValue?: string): Promise<void> {
    setLoading(tipo);
    try {
      const body: Record<string, unknown> = {
        titulo_id: String(tituloId),
        tipo,
      };
      if (tipo === "boleto") {
        const c = checksValue ?? checks;
        if (!c) {
          toast.error("Falta o `checks` do Smart pra gerar o boleto.");
          return;
        }
        body.extra = { checks: c };
      }

      const { data, error } = await supabase.functions.invoke<ScraperResponse>(
        "smart-scraper",
        { body },
      );

      if (error) {
        toast.error(error.message ?? "Falha ao chamar smart-scraper");
        return;
      }
      if (!data?.success || !data.signed_url) {
        toast.error(data?.message ?? `Erro ${data?.error_code ?? ""}`.trim());
        return;
      }

      window.open(data.signed_url, "_blank", "noopener,noreferrer");
      toast.success(
        data.from_cache ? "PDF recuperado do cache" : "PDF gerado pelo Smart",
        { duration: 2000 },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(null);
    }
  }

  function handleBoletoClick() {
    if (checks) {
      void fetchPdf("boleto");
    } else {
      // Sem checks pré-preenchido — pede o valor.
      setChecksInput("");
      setAskChecksOpen(true);
    }
  }

  function handleAskChecksSubmit() {
    const trimmed = checksInput.trim();
    if (!trimmed) {
      toast.error("Cole o checks (ex: 21467,)");
      return;
    }
    setAskChecksOpen(false);
    void fetchPdf("boleto", trimmed);
  }

  return (
    <div className={className ?? "flex gap-2"}>
      {!hideBoletoButton && (
        <Button
          size={size}
          variant={variant}
          onClick={handleBoletoClick}
          disabled={loading !== null}
          title="Baixa o PDF do boleto via portal Smart"
        >
          {loading === "boleto" ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Receipt className="size-4 mr-2" />
          )}
          {loading === "boleto" ? "Gerando..." : "Boleto"}
        </Button>
      )}

      {!hideNfButton && (
        <Button
          size={size}
          variant={variant}
          onClick={() => void fetchPdf("nf")}
          disabled={loading !== null}
          title="Baixa o PDF da nota fiscal via portal Smart"
        >
          {loading === "nf" ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <FileText className="size-4 mr-2" />
          )}
          {loading === "nf" ? "Gerando..." : "NF"}
        </Button>
      )}

      <Dialog open={askChecksOpen} onOpenChange={setAskChecksOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informe o `checks` do Smart</DialogTitle>
            <DialogDescription>
              O portal Smart usa um identificador chamado <code>checks</code>{" "}
              (diferente do título) pra gerar boleto. Você consegue ver na URL
              quando clica em "2ª via" no portal — algo como{" "}
              <code>Checks=21467,</code> (com vírgula no final). Cole o valor
              abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="checks-input">Checks</Label>
            <Input
              id="checks-input"
              value={checksInput}
              onChange={(e) => setChecksInput(e.target.value)}
              placeholder="ex: 21467,"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskChecksSubmit();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskChecksOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAskChecksSubmit}>Baixar boleto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
