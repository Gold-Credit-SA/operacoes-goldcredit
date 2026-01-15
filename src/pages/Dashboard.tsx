import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { OperacoesTable } from '@/components/dashboard/OperacoesTable';
import { ReceitasTable } from '@/components/dashboard/ReceitasTable';
import { TitulosAbertoTable } from '@/components/dashboard/TitulosAbertoTable';
import { CedentesCompletoTable } from '@/components/dashboard/CedentesCompletoTable';
import { ResumoPeriodo } from '@/components/dashboard/ResumoPeriodo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export interface DashboardFiltersState {
  cedente: string;
  dataInicio: string;
  dataFim: string;
  ano: string;
  uf: string;
}

interface DashboardStatsData {
  counts: {
    cedentes: number;
    operacoes: number;
    receitas: number;
    titulosAberto: number;
    titulosQuitados: number;
    titulosProrrogados: number;
    titulosRecomprados: number;
  };
  totals: {
    receita: number;
    operacoesBruto: number;
    operacoesLiquido: number;
    operacoesReceita: number;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<DashboardFiltersState>({
    cedente: '',
    dataInicio: '',
    dataFim: '',
    ano: '',
    uf: '',
  });

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dashboard-data', {
        body: { action: 'stats' }
      });

      if (error) throw error;
      if (data?.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFilterChange = (newFilters: Partial<DashboardFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleClearFilters = () => {
    setFilters({
      cedente: '',
      dataInicio: '',
      dataFim: '',
      ano: '',
      uf: '',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container-app py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral dos dados importados com filtros avançados
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            <DashboardStats stats={stats} />
            
            <div className="mt-8">
              <DashboardFilters 
                filters={filters} 
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>

            <div className="mt-8">
              <Tabs defaultValue="operacoes" className="w-full">
                <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
                  <TabsTrigger value="operacoes">Operações</TabsTrigger>
                  <TabsTrigger value="receitas">Receitas</TabsTrigger>
                  <TabsTrigger value="titulos">Títulos Aberto</TabsTrigger>
                  <TabsTrigger value="cedentes">Cedentes</TabsTrigger>
                  <TabsTrigger value="resumo">Resumo Mensal</TabsTrigger>
                </TabsList>

                <TabsContent value="operacoes" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Operações Individualizadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <OperacoesTable filters={filters} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="receitas" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Receita por Cedente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReceitasTable filters={filters} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="titulos" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Títulos em Aberto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TitulosAbertoTable filters={filters} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cedentes" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cedentes Completo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CedentesCompletoTable filters={filters} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="resumo" className="mt-6">
                  <ResumoPeriodo />
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum dado disponível</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
