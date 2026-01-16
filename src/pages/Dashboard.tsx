import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PowerBIDashboard } from '@/components/dashboard/PowerBIDashboard';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { OperacoesTable } from '@/components/dashboard/OperacoesTable';
import { ReceitasTable } from '@/components/dashboard/ReceitasTable';
import { TitulosAbertoTable } from '@/components/dashboard/TitulosAbertoTable';
import { CedentesCompletoTable } from '@/components/dashboard/CedentesCompletoTable';
import { ResumoPeriodo } from '@/components/dashboard/ResumoPeriodo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface DashboardFiltersState {
  cedente: string;
  dataInicio: string;
  dataFim: string;
  ano: string;
  uf: string;
}

export default function Dashboard() {
  const [filters, setFilters] = useState<DashboardFiltersState>({
    cedente: '',
    dataInicio: '',
    dataFim: '',
    ano: '',
    uf: '',
  });

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
    <MainLayout title="Dashboard" subtitle="Visão geral e análise de performance">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-card border border-border mb-6">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="operacoes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Operações
          </TabsTrigger>
          <TabsTrigger value="receitas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Receitas
          </TabsTrigger>
          <TabsTrigger value="titulos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Títulos
          </TabsTrigger>
          <TabsTrigger value="cedentes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Cedentes
          </TabsTrigger>
          <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Resumo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <PowerBIDashboard />
        </TabsContent>

        <TabsContent value="operacoes" className="mt-0">
          <div className="space-y-6">
            <DashboardFilters 
              filters={filters} 
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base font-semibold">Operações Individualizadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <OperacoesTable filters={filters} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receitas" className="mt-0">
          <div className="space-y-6">
            <DashboardFilters 
              filters={filters} 
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base font-semibold">Receita por Cedente</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ReceitasTable filters={filters} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="titulos" className="mt-0">
          <div className="space-y-6">
            <DashboardFilters 
              filters={filters} 
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base font-semibold">Títulos em Aberto</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TitulosAbertoTable filters={filters} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cedentes" className="mt-0">
          <div className="space-y-6">
            <DashboardFilters 
              filters={filters} 
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base font-semibold">Cedentes Completo</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CedentesCompletoTable filters={filters} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resumo" className="mt-0">
          <ResumoPeriodo />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
