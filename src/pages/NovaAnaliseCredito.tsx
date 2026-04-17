import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Brain, Building2, Check, CreditCard, Loader2,
  Search, Shield, Users, ChevronRight, AlertCircle, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ─── Types ───
interface CedenteResult {
  cpf_cnpj: string;
  nome: string;
  data: Record<string, unknown>;
}

interface ClienteResult {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  created_at: string;
}

interface ConsultaDisponivel {
  platform: string;
  label: string;
  date: string;
  status: string;
  clientCpfCnpj: string;
  clientName: string;
}

type Step = 'cedente' | 'sacado' | 'consultas';

const STEP_CONFIG = [
  { key: 'cedente' as const, label: '1. Cedente', icon: Building2 },
  { key: 'sacado' as const, label: '2. Sacados', icon: Users },
  { key: 'consultas' as const, label: '3. Consultas', icon: Shield },
];

export default function NovaAnaliseCredito() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('cedente');

  // Cedente
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedenteResults, setCedenteResults] = useState<CedenteResult[]>([]);
  const [selectedCedente, setSelectedCedente] = useState<CedenteResult | null>(null);
  const [searchingCedente, setSearchingCedente] = useState(false);
  const [smartData, setSmartData] = useState<Record<string, unknown> | null>(null);

  // Sacados (multi-select)
  const [sacadoSearch, setSacadoSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteResult[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [selectedClientes, setSelectedClientes] = useState<ClienteResult[]>([]);

  // Consultas
  const [consultasDisponiveis, setConsultasDisponiveis] = useState<ConsultaDisponivel[]>([]);
  const [loadingConsultas, setLoadingConsultas] = useState(false);

  const stepIndex = STEP_CONFIG.findIndex(s => s.key === step);

  // ─── Cedente Search ───
  const searchCedente = useCallback(async () => {
    const q = cedenteSearch.trim();
    if (q.length < 3) return;
    setSearchingCedente(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-db', {
        body: { action: 'cedentes-list', filters: { search: q } },
      });
      if (error) throw error;
      const items = data?.data || data?.results || data?.cedentes || [];
      setCedenteResults(items.map((c: any) => ({
        cpf_cnpj: c.cpf_cnpj || c.cnpj || c.cpf || '',
        nome: c.nome || c.razao_social || c.name || '',
        data: c,
      })));
    } catch {
      toast.error('Erro ao buscar cedentes.');
    } finally {
      setSearchingCedente(false);
    }
  }, [cedenteSearch]);

  useEffect(() => {
    if (!selectedCedente) { setSmartData(null); return; }
    setSmartData(selectedCedente.data);
  }, [selectedCedente]);

  // ─── Search Clientes (Sacados) ───
  const searchClientes = useCallback(async () => {
    const q = sacadoSearch.trim();
    setLoadingClientes(true);
    try {
      let query = supabase.from('consulta_clients').select('id, cpf_cnpj, name, created_at').order('created_at', { ascending: false });
      if (q.length >= 2) {
        query = query.or(`name.ilike.%${q}%,cpf_cnpj.ilike.%${q}%`);
      }
      const { data, error } = await query.limit(20);
      if (error) throw error;
      setClientes((data || []) as ClienteResult[]);
    } catch {
      toast.error('Erro ao buscar clientes.');
    } finally {
      setLoadingClientes(false);
    }
  }, [sacadoSearch]);

  useEffect(() => {
    if (step === 'sacado') searchClientes();
  }, [step]);

  // ─── Toggle sacado selection ───
  const toggleCliente = (c: ClienteResult) => {
    setSelectedClientes(prev => {
      const exists = prev.find(s => s.id === c.id);
      if (exists) return prev.filter(s => s.id !== c.id);
      return [...prev, c];
    });
  };

  const removeCliente = (id: string) => {
    setSelectedClientes(prev => prev.filter(s => s.id !== id));
  };

  // ─── Load available consultations for ALL sacados ───
  useEffect(() => {
    if (step !== 'consultas' || selectedClientes.length === 0) return;
    setLoadingConsultas(true);
    (async () => {
      try {
        const cpfList = selectedClientes.map(c => c.cpf_cnpj);
        const { data, error } = await supabase
          .from('consulta_history')
          .select('platform, consulta_label, created_at, status, cnpj')
          .in('cnpj', cpfList)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        const seen = new Map<string, ConsultaDisponivel>();
        (data || []).forEach((row: any) => {
          const key = `${row.cnpj}_${row.platform}`;
          if (!seen.has(key)) {
            const cliente = selectedClientes.find(c => c.cpf_cnpj === row.cnpj);
            seen.set(key, {
              platform: row.platform,
              label: row.consulta_label,
              date: row.created_at,
              status: row.status,
              clientCpfCnpj: row.cnpj,
              clientName: cliente?.name || row.cnpj,
            });
          }
        });
        setConsultasDisponiveis(Array.from(seen.values()));
      } catch {
        toast.error('Erro ao carregar consultas.');
      } finally {
        setLoadingConsultas(false);
      }
    })();
  }, [step, selectedClientes]);

  // ─── Navigate to analysis ───
  const handleProsseguir = () => {
    if (selectedClientes.length === 0 || !selectedCedente) return;
    // Store all sacados + cedente in sessionStorage for the analysis page
    sessionStorage.setItem('analysisClients', JSON.stringify(selectedClientes));
    sessionStorage.setItem('analysisCedente', JSON.stringify(selectedCedente));
    const primary = selectedClientes[0];
    navigate(`/analise-credito/new?clientId=${primary.id}&cpfCnpj=${encodeURIComponent(primary.cpf_cnpj)}&name=${encodeURIComponent(primary.name || '')}`);
  };

  // ─── Smart data summary ───
  const smartSummary = smartData ? {
    limiteGlobal: Number(smartData.limite_global || 0),
    riscoAtual: Number(smartData.risco_atual || 0),
    saldo: Number(smartData.saldo || 0),
    status: String(smartData.bloqueado || ''),
  } : null;

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const platformConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    serasa: { label: 'Serasa', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Shield },
    scr: { label: 'SCR (HBI)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CreditCard },
    smart: { label: 'Smart', color: 'text-red-600 bg-red-50 border-red-200', icon: Building2 },
    agrisk: { label: 'AgRisk', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Search },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Nova Análise de Crédito</h1>
              <p className="text-xs text-muted-foreground">Selecione cedente e sacados para iniciar</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            {STEP_CONFIG.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5",
                  stepIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : stepIndex > i
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {stepIndex > i ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {step === 'cedente' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Selecionar Cedente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCedente ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
                        <Check className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedCedente.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{selectedCedente.cpf_cnpj}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedCedente(null); setCedenteResults([]); setSmartData(null); }}>
                        Alterar
                      </Button>
                    </div>

                    {smartSummary && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border bg-card p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Limite Global</p>
                          <p className="text-sm font-bold text-foreground">{fmtBRL(smartSummary.limiteGlobal)}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Risco Atual</p>
                          <p className="text-sm font-bold text-foreground">{fmtBRL(smartSummary.riscoAtual)}</p>
                        </div>
                        <div className="rounded-lg border bg-card p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo</p>
                          <p className="text-sm font-bold text-foreground">{fmtBRL(smartSummary.saldo)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cedente por nome ou CNPJ..."
                          value={cedenteSearch}
                          onChange={e => setCedenteSearch(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && searchCedente()}
                          className="pl-10"
                        />
                      </div>
                      <Button variant="outline" onClick={searchCedente} disabled={searchingCedente || cedenteSearch.trim().length < 3}>
                        {searchingCedente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    {cedenteResults.length > 0 && (
                      <div className="max-h-[280px] overflow-y-auto space-y-1 border rounded-lg p-2">
                        {cedenteResults.map(c => (
                          <button
                            key={c.cpf_cnpj}
                            onClick={() => { setSelectedCedente(c); setCedenteResults([]); }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/60 transition-colors"
                          >
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.nome}</p>
                              <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setStep('sacado')} disabled={!selectedCedente} className="gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'sacado' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium truncate">{selectedCedente?.nome}</span>
              <span className="text-xs text-muted-foreground font-mono">{selectedCedente?.cpf_cnpj}</span>
            </div>

            {/* Selected sacados chips */}
            {selectedClientes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedClientes.map(c => (
                  <Badge key={c.id} variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                    <span className="text-xs font-medium">{c.name || c.cpf_cnpj}</span>
                    <button onClick={() => removeCliente(c.id)} className="hover:bg-destructive/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground self-center">
                  {selectedClientes.length} sacado(s) selecionado(s)
                </span>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Selecionar Sacados (Clientes)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Selecione um ou mais sacados para a análise</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      value={sacadoSearch}
                      onChange={e => setSacadoSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchClientes()}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={searchClientes} disabled={loadingClientes}>
                    {loadingClientes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {loadingClientes && !clientes.length ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
                    {clientes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado</p>
                    )}
                    {clientes.map(c => {
                      const isSelected = selectedClientes.some(s => s.id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCliente(c)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border hover:border-primary/40 hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {isSelected ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>{c.name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>
                          </div>
                          {isSelected && (
                            <Badge variant="outline" className="text-[10px] shrink-0">Selecionado</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('cedente')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep('consultas')} disabled={selectedClientes.length === 0} className="gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'consultas' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium truncate">{selectedCedente?.nome}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium">{selectedClientes.length} sacado(s)</span>
              </div>
            </div>

            {/* List selected sacados */}
            <div className="flex flex-wrap gap-2">
              {selectedClientes.map(c => (
                <Badge key={c.id} variant="outline" className="text-xs">
                  {c.name || c.cpf_cnpj}
                </Badge>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Consultas Disponíveis
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Consultas já realizadas para os sacados selecionados
                </p>
              </CardHeader>
              <CardContent>
                {loadingConsultas ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : consultasDisponiveis.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Nenhuma consulta realizada para os sacados selecionados.</p>
                    <p className="text-xs text-muted-foreground">
                      Você pode prosseguir e realizar as consultas durante a análise.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {consultasDisponiveis.map(c => {
                      const config = platformConfig[c.platform] || { label: c.platform, color: 'text-muted-foreground bg-muted border-border', icon: Shield };
                      const Icon = config.icon;
                      return (
                        <div key={`${c.clientCpfCnpj}_${c.platform}`} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border", config.color)}>
                          <Icon className="h-5 w-5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{config.label}</p>
                            <p className="text-xs opacity-70">{c.clientName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className="text-[10px]">
                              {format(new Date(c.date), 'dd/MM/yyyy')}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {smartSummary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Dados do Cedente (Smart)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Limite Global</p>
                      <p className="text-sm font-bold">{fmtBRL(smartSummary.limiteGlobal)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Risco Atual</p>
                      <p className="text-sm font-bold">{fmtBRL(smartSummary.riscoAtual)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo</p>
                      <p className="text-sm font-bold">{fmtBRL(smartSummary.saldo)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('sacado')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleProsseguir} className="gap-2 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-primary-foreground hover:opacity-95">
                <Brain className="h-4 w-4" /> Prosseguir para Análise
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
