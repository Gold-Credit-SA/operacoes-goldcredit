import { useRef, useState } from 'react';
import { Cake, Plus, PartyPopper, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Aniversariante {
  cpf_cnpj: string;
  nome: string;
  data_nascimento: string;
}

interface AniversariantesCardProps {
  aniversariantes: Aniversariante[];
  onAddBirthday: () => void;
  onImportSuccess?: () => void;
  loading?: boolean;
}

function parseXlsHtml(text: string): Array<{ nome: string; nascimento: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const results: Array<{ nome: string; nascimento: string }> = [];

  for (let i = 1; i < rows.length; i++) { // skip header row
    const cells = rows[i].querySelectorAll('td');
    if (cells.length >= 2) {
      const nome = (cells[0]?.textContent || '').trim();
      const nascimento = (cells[1]?.textContent || '').trim();
      if (nome && nascimento && /^\d{2}\/\d{2}\/\d{4}$/.test(nascimento)) {
        results.push({ nome, nascimento });
      }
    }
  }
  return results;
}

function parseCsv(text: string): Array<{ nome: string; nascimento: string }> {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const results: Array<{ nome: string; nascimento: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/);
    const nome = (cols[0] || '').replace(/^["']|["']$/g, '').trim();
    const nascimento = (cols[1] || '').replace(/^["']|["']$/g, '').trim();
    if (nome && nascimento && /^\d{2}\/\d{2}\/\d{4}$/.test(nascimento)) {
      results.push({ nome, nascimento });
    }
  }
  return results;
}

export function AniversariantesCard({ aniversariantes, onAddBirthday, onImportSuccess, loading }: AniversariantesCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();

      // Determine format: XLS from Smart is HTML-table-disguised-as-XLS
      let registros: Array<{ nome: string; nascimento: string }>;
      if (text.includes('<table') || text.includes('<TABLE') || text.includes('<tr') || text.includes('<TR')) {
        registros = parseXlsHtml(text);
      } else {
        registros = parseCsv(text);
      }

      if (registros.length === 0) {
        toast.error('Nenhum registro válido encontrado no arquivo');
        return;
      }

      toast.info(`Processando ${registros.length} registros...`);

      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'import-birthdays', registros },
      });

      if (error) throw error;

      const msg = `✅ ${data.importados} importados de ${data.total_enviados}`;
      if (data.nao_encontrados?.length > 0) {
        toast.warning(`${msg}. ${data.nao_encontrados.length} não encontrados.`, {
          duration: 8000,
          description: data.nao_encontrados.slice(0, 5).join(', ') + (data.nao_encontrados.length > 5 ? '...' : ''),
        });
      } else {
        toast.success(msg);
      }

      onImportSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cake className="h-5 w-5 text-amber-500" />
            Aniversariantes do Dia
            {aniversariantes.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {aniversariantes.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={onAddBirthday} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : aniversariantes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum aniversariante hoje
          </p>
        ) : (
          <div className="space-y-2">
            {aniversariantes.map((a) => (
              <div
                key={a.cpf_cnpj}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900"
              >
                <div className="flex items-center gap-3">
                  <PartyPopper className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.cpf_cnpj}</p>
                  </div>
                </div>
                <span className="text-lg">🎂</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
