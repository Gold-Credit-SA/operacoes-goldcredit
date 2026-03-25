import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { OperacoesTable } from '@/components/dashboard/OperacoesTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileSignature } from 'lucide-react';
import type { DashboardFiltersState } from '@/pages/Dashboard';

export default function OperacoesFormalizacao() {
  const [filters, setFilters] = useState<DashboardFiltersState>({
    cedente: '',
    dataInicio: '',
    dataFim: '',
    ano: '',
    uf: '',
  });

  const handleFilterChange = (newFilters: Partial<DashboardFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
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
    <MainLayout
      title="Operações para Formalização"
      subtitle="Operações do Smart que entraram em formalização e precisam seguir para o envio de documentos de assinatura."
    >
      <div className="space-y-6">
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <FileSignature className="h-4 w-4" />
          <AlertTitle>Fila de formalização do GoldSign</AlertTitle>
          <AlertDescription>
            Esta tela mostra somente as operações que o Smart marcou na etapa de formalização. Use essa fila para priorizar o envio dos documentos para assinatura.
          </AlertDescription>
        </Alert>

        <DashboardFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">Operações aguardando formalização</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OperacoesTable filters={filters} onlyFormalizacao />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
