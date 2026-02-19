import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AniversariantesCard } from '@/components/painel/AniversariantesCard';
import { SaldoTrusteeCard } from '@/components/painel/SaldoTrusteeCard';
import { ChequesCard } from '@/components/painel/ChequesCard';
import { CadastrarAniversarioDialog } from '@/components/painel/CadastrarAniversarioDialog';
import { LayoutDashboard } from 'lucide-react';

export default function GestorDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gestor-dashboard'],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'gestor-dashboard' },
      });
      if (error) throw error;
      return result as {
        aniversariantes: Array<{ cpf_cnpj: string; nome: string; data_nascimento: string }>;
        saldoTrustee: Array<{ cpf_cnpj: string; nome: string; saldo_trustee: number }>;
        chequesDevolvidos: Array<{ cpf_cnpj: string; nome: string; qtd_cheques: number; valor_total: number }>;
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Painel do Gestor</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AniversariantesCard
          aniversariantes={data?.aniversariantes || []}
          onAddBirthday={() => setDialogOpen(true)}
          loading={isLoading}
        />
        <SaldoTrusteeCard
          saldoTrustee={data?.saldoTrustee || []}
          loading={isLoading}
        />
        <ChequesCard
          chequesDevolvidos={data?.chequesDevolvidos || []}
          loading={isLoading}
        />
      </div>

      <CadastrarAniversarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
