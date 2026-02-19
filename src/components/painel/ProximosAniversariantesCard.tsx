import { useState, useRef } from 'react';
import { Cake, Plus, Upload, Loader2, ChevronRight, Gift, PartyPopper, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Aniversariante {
  cpf_cnpj: string;
  nome: string;
  data_nascimento: string;
  dias_faltam: number;
  dia: number;
  mes: number;
}

interface Props {
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
  for (let i = 1; i < rows.length; i++) {
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

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function ProximosAniversariantesCard({ aniversariantes, onAddBirthday, onImportSuccess, loading }: Props) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  const filtered = aniversariantes.filter(a => {
    if (periodo === 'semana') return a.dias_faltam <= 7;
    return a.dias_faltam <= 30;
  });

  const hoje = filtered.filter(a => a.dias_faltam === 0);
  const proximos = filtered.filter(a => a.dias_faltam > 0);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
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

  const getDiasFaltamLabel = (dias: number) => {
    if (dias === 0) return 'Hoje! 🎉';
    if (dias === 1) return 'Amanhã';
    return `em ${dias} dias`;
  };

  const getDiasFaltamColor = (dias: number) => {
    if (dias === 0) return 'bg-primary/20 text-primary border-primary/30';
    if (dias <= 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Cake className="h-4 w-4 text-primary" />
            </div>
            Próximos Aniversários
            {filtered.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filtered.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1.5">
            <input ref={fileInputRef} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleImport} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} disabled={importing} title="Importar planilha">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddBirthday} title="Cadastrar aniversário">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as 'semana' | 'mes')} className="mt-2">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="semana" className="text-xs flex-1">Próximos 7 dias</TabsTrigger>
            <TabsTrigger value="mes" className="text-xs flex-1">Próximos 30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum aniversário nos próximos {periodo === 'semana' ? '7' : '30'} dias
            </p>
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={onAddBirthday}>
              Cadastrar aniversário
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {hoje.length > 0 && (
              <>
                {hoje.map(a => (
                  <button
                    key={a.cpf_cnpj}
                    onClick={() => navigate(`/consulta?q=${encodeURIComponent(a.cpf_cnpj)}`)}
                    className="flex items-center justify-between w-full p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PartyPopper className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">{a.dia}/{MESES[a.mes]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Hoje! 🎉</Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </>
            )}
            {proximos.map(a => (
              <button
                key={a.cpf_cnpj}
                onClick={() => navigate(`/consulta?q=${encodeURIComponent(a.cpf_cnpj)}`)}
                className="flex items-center justify-between w-full p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Gift className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.dia} de {MESES[a.mes]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${getDiasFaltamColor(a.dias_faltam)}`}>
                    {getDiasFaltamLabel(a.dias_faltam)}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
