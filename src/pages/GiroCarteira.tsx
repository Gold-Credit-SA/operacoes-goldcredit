import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Building2,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';

interface CedenteInativo {
  cpf_cnpj: string;
  nome?: string;
  razao_social?: string;
  limite_global?: number;
  limite_disponivel?: number;
  risco_atual?: number;
  bloqueado?: string;
  ultima_operacao?: string;
  setor?: string;
  uf?: string;
  cidade?: string;
  categoria?: '7dias' | '15dias' | '30dias';
}

interface AnaliseIA {
  cpf_cnpj: string;
  saudavel: boolean;
  motivo: string;
  score: number;
}

type FiltroCategoria = 'todos' | '7dias' | '15dias' | '30dias';

export default function GiroCarteira() {
  const [cedentes, setCedentes] = useState<CedenteInativo[]>([]);
  const [analises, setAnalises] = useState<Record<string, AnaliseIA>>({});
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroCategoria>('todos');
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCpfCnpj = (value: string | undefined) => {
    if (!value) return '-';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  const calcularDiasInativo = (ultimaOp: string | undefined) => {
    if (!ultimaOp) return 999;
    const dias = Math.floor((new Date().getTime() - new Date(ultimaOp).getTime()) / (1000 * 60 * 60 * 24));
    return dias;
  };

  const buscarCedentesInativos = async () => {
    setIsLoadingList(true);
    setAnalises({});
    
    try {
      const { data, error } = await supabase.functions.invoke('giro-carteira', {
        body: { action: 'list-inativos' }
      });

      if (error) throw error;

      if (data.success) {
        setCedentes(data.cedentes);
        
        const count7 = data.cedentes.filter((c: CedenteInativo) => c.categoria === '7dias').length;
        const count15 = data.cedentes.filter((c: CedenteInativo) => c.categoria === '15dias').length;
        const count30 = data.cedentes.filter((c: CedenteInativo) => c.categoria === '30dias').length;
        
        toast({
          title: "Cedentes encontrados",
          description: `${data.cedentes.length} cedentes inativos: ${count7} (7d), ${count15} (15d), ${count30} (30d+)`
        });
      }
    } catch (error) {
      console.error("Erro ao buscar cedentes:", error);
      toast({
        title: "Erro ao buscar cedentes",
        description: "Não foi possível carregar a lista de cedentes inativos.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingList(false);
    }
  };

  const analisarComIA = async () => {
    const cedentesFiltrados = filtroAtivo === 'todos' 
      ? cedentes 
      : cedentes.filter(c => c.categoria === filtroAtivo);

    if (cedentesFiltrados.length === 0) {
      toast({
        title: "Nenhum cedente",
        description: "Busque cedentes inativos primeiro.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('giro-carteira', {
        body: { action: 'analyze-batch', cedentes: cedentesFiltrados }
      });

      if (error) throw error;

      if (data.success && data.analises) {
        const analisesMap: Record<string, AnaliseIA> = {};
        for (const analise of data.analises) {
          analisesMap[analise.cpf_cnpj] = analise;
        }
        setAnalises(prev => ({ ...prev, ...analisesMap }));
        
        const saudaveis = data.analises.filter((a: AnaliseIA) => a.saudavel).length;
        toast({
          title: "Análise concluída",
          description: `${saudaveis} de ${data.analises.length} cedentes estão saudáveis para operar.`
        });
      }
    } catch (error: any) {
      console.error("Erro na análise:", error);
      toast({
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar os cedentes.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const irParaConsulta = (cpfCnpj: string) => {
    navigate(`/consulta?cpf_cnpj=${cpfCnpj}`);
  };

  // Contadores por categoria
  const contadores = {
    todos: cedentes.length,
    '7dias': cedentes.filter(c => c.categoria === '7dias').length,
    '15dias': cedentes.filter(c => c.categoria === '15dias').length,
    '30dias': cedentes.filter(c => c.categoria === '30dias').length,
  };

  // Filtrar cedentes pela categoria selecionada
  const cedentesFiltrados = filtroAtivo === 'todos' 
    ? cedentes 
    : cedentes.filter(c => c.categoria === filtroAtivo);

  // Ordenar: saudáveis primeiro, depois por score
  const cedentesOrdenados = [...cedentesFiltrados].sort((a, b) => {
    const analiseA = analises[a.cpf_cnpj];
    const analiseB = analises[b.cpf_cnpj];
    
    if (analiseA?.saudavel && !analiseB?.saudavel) return -1;
    if (!analiseA?.saudavel && analiseB?.saudavel) return 1;
    
    if (analiseA && analiseB) {
      return (analiseB.score || 0) - (analiseA.score || 0);
    }
    
    return 0;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giro de Carteira</h1>
          <p className="text-muted-foreground">
            Identifique cedentes inativos e analise quais estão prontos para operar novamente
          </p>
        </div>

        {/* Ações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Buscar Cedentes Inativos
            </CardTitle>
            <CardDescription>
              Encontre cedentes que não operam há 7, 15 ou 30+ dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={buscarCedentesInativos} disabled={isLoadingList}>
                {isLoadingList ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Inativos
                  </>
                )}
              </Button>
              {cedentes.length > 0 && (
                <Button 
                  onClick={analisarComIA} 
                  disabled={isAnalyzing}
                  variant="secondary"
                  className="bg-primary/10 hover:bg-primary/20 text-primary"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analisar com IA ({cedentesFiltrados.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Período */}
        {cedentes.length > 0 && (
          <Tabs value={filtroAtivo} onValueChange={(v) => setFiltroAtivo(v as FiltroCategoria)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="todos" className="flex items-center gap-2">
                Todos
                <Badge variant="secondary" className="ml-1">{contadores.todos}</Badge>
              </TabsTrigger>
              <TabsTrigger value="7dias" className="flex items-center gap-2">
                7 dias
                <Badge variant="secondary" className="ml-1">{contadores['7dias']}</Badge>
              </TabsTrigger>
              <TabsTrigger value="15dias" className="flex items-center gap-2">
                15 dias
                <Badge variant="secondary" className="ml-1">{contadores['15dias']}</Badge>
              </TabsTrigger>
              <TabsTrigger value="30dias" className="flex items-center gap-2">
                30+ dias
                <Badge variant="secondary" className="ml-1">{contadores['30dias']}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Resumo da Análise */}
        {Object.keys(analises).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {Object.values(analises).filter(a => a.saudavel).length}
                  </p>
                  <p className="text-sm text-emerald-600/80">Saudáveis para operar</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {Object.values(analises).filter(a => !a.saudavel).length}
                  </p>
                  <p className="text-sm text-red-600/80">Não recomendados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {Object.keys(analises).length}
                  </p>
                  <p className="text-sm text-primary/80">Total analisados</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {isLoadingList && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-4" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Lista de Cedentes */}
        {!isLoadingList && cedentesFiltrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cedentesOrdenados.map((cedente) => {
              const analise = analises[cedente.cpf_cnpj];
              const diasInativo = calcularDiasInativo(cedente.ultima_operacao);
              const utilizacao = cedente.limite_global && cedente.limite_global > 0
                ? ((cedente.risco_atual || 0) / cedente.limite_global) * 100
                : 0;
              
              return (
                <Card 
                  key={cedente.cpf_cnpj}
                  className={`transition-all duration-300 ${
                    analise 
                      ? analise.saudavel 
                        ? 'border-emerald-500/50 bg-emerald-500/5' 
                        : 'border-red-500/50 bg-red-500/5'
                      : ''
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatCpfCnpj(cedente.cpf_cnpj)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {cedente.categoria === '7dias' && '7d'}
                          {cedente.categoria === '15dias' && '15d'}
                          {cedente.categoria === '30dias' && '30d+'}
                        </Badge>
                        {analise && (
                          <Badge 
                            variant={analise.saudavel ? "default" : "destructive"}
                            className={analise.saudavel 
                              ? "bg-emerald-500 hover:bg-emerald-600" 
                              : ""
                            }
                          >
                            {analise.saudavel ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Saudável</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Risco</>
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Nome */}
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                      {cedente.nome || cedente.razao_social || 'Nome não informado'}
                    </h3>

                    {/* Métricas */}
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Limite Global:</span>
                        <span className="font-medium">{formatCurrency(cedente.limite_global)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Disponível:</span>
                        <span className={`font-medium ${
                          (cedente.limite_disponivel || 0) <= 0 ? 'text-red-500' : 'text-emerald-500'
                        }`}>
                          {formatCurrency(cedente.limite_disponivel)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Utilização:</span>
                        <span className={`font-medium ${
                          utilizacao > 100 ? 'text-red-500' : utilizacao > 80 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {utilizacao.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dias inativo:</span>
                        <span className="font-medium text-amber-500">{diasInativo} dias</span>
                      </div>
                    </div>

                    {/* Análise IA */}
                    {analise && (
                      <div className={`p-3 rounded-lg mb-3 ${
                        analise.saudavel 
                          ? 'bg-emerald-500/10 border border-emerald-500/20' 
                          : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {analise.saudavel ? (
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={`text-xs font-semibold ${
                            analise.saudavel ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            Score: {analise.score}/100
                          </span>
                        </div>
                        <p className={`text-xs ${
                          analise.saudavel ? 'text-emerald-600/90' : 'text-red-600/90'
                        }`}>
                          {analise.motivo}
                        </p>
                      </div>
                    )}

                    {/* Botão Consultar */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => irParaConsulta(cedente.cpf_cnpj)}
                    >
                      Ver Consulta Completa
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingList && cedentes.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Buscar cedentes inativos</h3>
              <p className="text-muted-foreground">
                Clique em "Buscar Inativos" para encontrar cedentes que não operam há 7, 15 ou 30+ dias
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State para filtro */}
        {!isLoadingList && cedentes.length > 0 && cedentesFiltrados.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum cedente neste período</h3>
              <p className="text-muted-foreground">
                Não há cedentes inativos no período de {filtroAtivo === '7dias' ? '7 dias' : filtroAtivo === '15dias' ? '15 dias' : '30+ dias'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
