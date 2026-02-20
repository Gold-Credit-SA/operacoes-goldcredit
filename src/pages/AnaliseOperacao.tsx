import { useState, useCallback } from 'react';
import { ClipboardList, ArrowRight, ArrowLeft, RotateCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { XmlUpload } from '@/components/operacao/XmlUpload';
import { NotasImportadas } from '@/components/operacao/NotasImportadas';
import { SacadosList, type SacadoComStatus } from '@/components/operacao/SacadosList';
import { SacadoFormDialog, type SacadoFormData } from '@/components/operacao/SacadoFormDialog';
import type { NotaFiscalXml } from '@/lib/xml-nfe-parser';

type Step = 'xml' | 'sacados';

interface CedenteFromXml {
  cpfCnpj: string;
  nome: string;
}

export default function AnaliseOperacao() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('xml');

  // Notas & Cedente (extracted from XML)
  const [notas, setNotas] = useState<(NotaFiscalXml & { fileName: string })[]>([]);
  const [cedente, setCedente] = useState<CedenteFromXml | null>(null);

  // Sacados
  const [sacados, setSacados] = useState<SacadoComStatus[]>([]);
  const [loadingSacados, setLoadingSacados] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<Partial<SacadoFormData> | undefined>();
  const [savingSacado, setSavingSacado] = useState(false);

  const checkSacadosExistentes = useCallback(async (notasList: (NotaFiscalXml & { fileName: string })[]) => {
    setLoadingSacados(true);
    const sacadoMap = new Map<string, NotaFiscalXml['sacado']>();
    for (const n of notasList) {
      if (!sacadoMap.has(n.sacado.cpfCnpj)) {
        sacadoMap.set(n.sacado.cpfCnpj, n.sacado);
      }
    }

    const cpfCnpjs = Array.from(sacadoMap.keys());
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
    setNotas(prev => {
      const all = [...prev, ...parsed];
      // Extract cedente from first nota if not set
      if (!cedente && parsed.length > 0) {
        setCedente(parsed[0].emitente);
      }
      checkSacadosExistentes(all);
      return all;
    });
  }, [cedente, checkSacadosExistentes]);

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

      setSacados(prev =>
        prev.map(s =>
          s.cpfCnpj === data.cpf_cnpj
            ? { ...s, cadastrado: true, sacadoId: inserted.id }
            : s
        )
      );

      if (cedente && inserted) {
        const notasDoSacado = notas.filter(n => n.sacado.cpfCnpj === data.cpf_cnpj);
        if (notasDoSacado.length > 0) {
          await supabase.from('operacao_notas').insert(
            notasDoSacado.map(n => ({
              cedente_cpf_cnpj: cedente.cpfCnpj,
              cedente_nome: cedente.nome,
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
  }, [user, cedente, notas, toast]);

  const handleReset = () => {
    setStep('xml');
    setNotas([]);
    setCedente(null);
    setSacados([]);
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
                  Importe NF-e para identificar cedente e sacados automaticamente
                </p>
              </div>
            </div>
            {notas.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Recomeçar
              </Button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['xml', 'sacados'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ((['xml', 'sacados'] as Step[]).indexOf(step) > i
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground')
                }`}>
                  {s === 'xml' ? '1. Importar NF-e' : '2. Sacados'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Step 1: XML Upload */}
          {step === 'xml' && (
            <div className="space-y-4">
              <XmlUpload onNotasParsed={handleNotasParsed} />

              {cedente && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Cedente identificado:</span>
                    <span className="font-medium text-foreground">{cedente.nome}</span>
                    <Badge variant="outline" className="font-mono text-xs">{cedente.cpfCnpj}</Badge>
                  </div>
                </Card>
              )}

              {notas.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <NotasImportadas notas={notas} />
                  </CardContent>
                </Card>
              )}

              {notas.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => { checkSacadosExistentes(notas); setStep('sacados'); }}>
                    Ver Sacados
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Sacados */}
          {step === 'sacados' && (
            <div className="space-y-4">
              {cedente && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{cedente.nome}</span>
                    <span>·</span>
                    <span>{notas.length} nota{notas.length !== 1 ? 's' : ''}</span>
                  </div>
                </Card>
              )}

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
