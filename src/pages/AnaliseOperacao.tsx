import { useState, useCallback, useEffect } from 'react';
import { ClipboardList, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CedenteSelector, type CedenteOption } from '@/components/operacao/CedenteSelector';
import { XmlUpload } from '@/components/operacao/XmlUpload';
import { NotasImportadas } from '@/components/operacao/NotasImportadas';
import { SacadosList, type SacadoComStatus } from '@/components/operacao/SacadosList';
import { SacadoFormDialog, type SacadoFormData } from '@/components/operacao/SacadoFormDialog';
import type { NotaFiscalXml } from '@/lib/xml-nfe-parser';

type Step = 'cedente' | 'xml' | 'sacados';

export default function AnaliseOperacao() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Step management
  const [step, setStep] = useState<Step>('cedente');

  // Step 1 - Cedente
  const [cedentes, setCedentes] = useState<CedenteOption[]>([]);
  const [loadingCedentes, setLoadingCedentes] = useState(true);
  const [selectedCedente, setSelectedCedente] = useState<CedenteOption | null>(null);

  // Step 2 - XML
  const [notas, setNotas] = useState<(NotaFiscalXml & { fileName: string })[]>([]);

  // Step 3 - Sacados
  const [sacados, setSacados] = useState<SacadoComStatus[]>([]);
  const [loadingSacados, setLoadingSacados] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<Partial<SacadoFormData> | undefined>();
  const [savingSacado, setSavingSacado] = useState(false);

  // Load cedentes from external DB
  useEffect(() => {
    async function load() {
      setLoadingCedentes(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) return;

        // Get all cedentes from external DB
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-data`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ action: 'list-cedentes-all' }),
          }
        );
        const result = await res.json();
        if (result.success) {
          setCedentes(result.cedentes || []);
        }
      } catch (e) {
        console.error('Error loading cedentes:', e);
      } finally {
        setLoadingCedentes(false);
      }
    }
    load();
  }, []);

  // After XML parsed, check which sacados exist
  const checkSacadosExistentes = useCallback(async (notasList: (NotaFiscalXml & { fileName: string })[]) => {
    setLoadingSacados(true);

    // Deduplicate sacados by cpfCnpj
    const sacadoMap = new Map<string, NotaFiscalXml['sacado']>();
    for (const n of notasList) {
      if (!sacadoMap.has(n.sacado.cpfCnpj)) {
        sacadoMap.set(n.sacado.cpfCnpj, n.sacado);
      }
    }

    const cpfCnpjs = Array.from(sacadoMap.keys());

    // Check existing in DB
    const { data: existing } = await supabase
      .from('sacados')
      .select('id, cpf_cnpj')
      .in('cpf_cnpj', cpfCnpjs);

    const existingMap = new Map((existing || []).map(e => [e.cpf_cnpj, e.id]));

    const result: SacadoComStatus[] = cpfCnpjs.map(cpf => {
      const s = sacadoMap.get(cpf)!;
      return {
        ...s,
        cadastrado: existingMap.has(cpf),
        sacadoId: existingMap.get(cpf),
      };
    });

    setSacados(result);
    setLoadingSacados(false);
  }, []);

  const handleNotasParsed = useCallback((parsed: (NotaFiscalXml & { fileName: string })[]) => {
    setNotas(prev => [...prev, ...parsed]);
    const all = [...notas, ...parsed];
    checkSacadosExistentes(all);
    setStep('sacados');
  }, [notas, checkSacadosExistentes]);

  const handleCadastrar = useCallback((sacado: NotaFiscalXml['sacado']) => {
    setDialogInitial({
      cpf_cnpj: sacado.cpfCnpj,
      nome: sacado.nome,
      endereco: sacado.endereco || '',
      cidade: sacado.cidade || '',
      estado: sacado.estado || '',
      cep: sacado.cep || '',
      email: sacado.email || '',
      telefone: sacado.telefone || '',
    });
    setDialogOpen(true);
  }, []);

  const handleCadastroManual = useCallback(() => {
    setDialogInitial(undefined);
    setDialogOpen(true);
  }, []);

  const handleSaveSacado = useCallback(async (data: SacadoFormData) => {
    if (!user) return;
    setSavingSacado(true);
    try {
      const { data: inserted, error } = await supabase
        .from('sacados')
        .insert({
          cpf_cnpj: data.cpf_cnpj.trim(),
          nome: data.nome.trim(),
          endereco: data.endereco || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          cep: data.cep || null,
          email: data.email || null,
          telefone: data.telefone || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Sacado já cadastrado', description: 'Este CPF/CNPJ já existe.', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }

      // Update sacados list
      setSacados(prev =>
        prev.map(s =>
          s.cpfCnpj === data.cpf_cnpj
            ? { ...s, cadastrado: true, sacadoId: inserted.id }
            : s
        )
      );

      // Save notas for this sacado
      if (selectedCedente && inserted) {
        const notasDoSacado = notas.filter(n => n.sacado.cpfCnpj === data.cpf_cnpj);
        if (notasDoSacado.length > 0) {
          await supabase.from('operacao_notas').insert(
            notasDoSacado.map(n => ({
              cedente_cpf_cnpj: selectedCedente.cpf_cnpj,
              cedente_nome: selectedCedente.nome,
              sacado_id: inserted.id,
              sacado_cpf_cnpj: data.cpf_cnpj,
              sacado_nome: data.nome,
              numero_nota: n.numero,
              serie: n.serie,
              chave_acesso: n.chaveAcesso,
              valor: n.valor,
              data_emissao: n.dataEmissao || null,
              xml_filename: n.fileName,
              created_by: user.id,
            }))
          );
        }
      }

      toast({ title: 'Sacado cadastrado', description: `${data.nome} registrado com sucesso.` });
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Erro ao cadastrar sacado.', variant: 'destructive' });
    } finally {
      setSavingSacado(false);
    }
  }, [user, selectedCedente, notas, toast]);

  const handleReset = () => {
    setStep('cedente');
    setSelectedCedente(null);
    setNotas([]);
    setSacados([]);
  };

  const stepLabels: Record<Step, string> = {
    cedente: '1. Selecionar Cedente',
    xml: '2. Importar NF-e',
    sacados: '3. Sacados',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Análise de Operação</h1>
                <p className="text-sm text-muted-foreground">
                  Selecione um cedente, importe NF-e e gerencie sacados
                </p>
              </div>
            </div>
            {step !== 'cedente' && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Recomeçar
              </Button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['cedente', 'xml', 'sacados'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ((['cedente', 'xml', 'sacados'] as Step[]).indexOf(step) > i
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground')
                }`}>
                  {stepLabels[s]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Step 1: Cedente Selection */}
          {step === 'cedente' && (
            <Card>
              <CardContent className="pt-6">
                <CedenteSelector
                  cedentes={cedentes}
                  loading={loadingCedentes}
                  selected={selectedCedente}
                  onSelect={setSelectedCedente}
                />
                <div className="flex justify-end mt-4">
                  <Button
                    disabled={!selectedCedente}
                    onClick={() => setStep('xml')}
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: XML Upload */}
          {step === 'xml' && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{selectedCedente?.nome}</span>
                  <span>·</span>
                  <span className="font-mono">{selectedCedente?.cpf_cnpj}</span>
                </div>
              </Card>

              <XmlUpload onNotasParsed={handleNotasParsed} />

              {notas.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <NotasImportadas notas={notas} />
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('cedente')}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Voltar
                </Button>
                {notas.length > 0 && (
                  <Button onClick={() => { checkSacadosExistentes(notas); setStep('sacados'); }}>
                    Ver Sacados
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Sacados */}
          {step === 'sacados' && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{selectedCedente?.nome}</span>
                  <span>·</span>
                  <span>{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
                </div>
              </Card>

              {notas.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <NotasImportadas notas={notas} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6">
                  {loadingSacados ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Verificando sacados...</p>
                  ) : (
                    <SacadosList
                      sacados={sacados}
                      onCadastrar={handleCadastrar}
                      onCadastroManual={handleCadastroManual}
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep('xml')}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Importar mais XMLs
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SacadoFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSaveSacado}
        initialData={dialogInitial}
        loading={savingSacado}
      />
    </div>
  );
}
