import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
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
    <MainLayout title="Dashboard" subtitle="Visão geral dos dados importados">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="text-muted-foreground font-medium">Carregando...</span>
          </div>
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
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="operacoes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Operações</TabsTrigger>
                <TabsTrigger value="receitas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Receitas</TabsTrigger>
                <TabsTrigger value="titulos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Títulos</TabsTrigger>
                <TabsTrigger value="cedentes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cedentes</TabsTrigger>
                <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Resumo</TabsTrigger>
              </TabsList>

              <TabsContent value="operacoes" className="mt-6">
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-base font-semibold">Operações Individualizadas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <OperacoesTable filters={filters} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="receitas" className="mt-6">
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-base font-semibold">Receita por Cedente</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ReceitasTable filters={filters} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="titulos" className="mt-6">
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-base font-semibold">Títulos em Aberto</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <TitulosAbertoTable filters={filters} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cedentes" className="mt-6">
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-base font-semibold">Cedentes Completo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
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
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Nenhum dado disponível</p>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
