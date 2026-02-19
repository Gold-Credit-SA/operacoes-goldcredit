import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProximosAniversariantesCard } from '@/components/painel/ProximosAniversariantesCard';
import { SaldosCard } from '@/components/painel/SaldosCard';
import { ChequesDevolvidosCard } from '@/components/painel/ChequesDevolvidosCard';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function GestorDashboard() {
  const { profile } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gestor-dashboard'],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'gestor-dashboard' },
      });
      if (error) throw error;
      return result as {
        proximosAniversariantes: Array<{ nome: string; empresa: string; data_nascimento: string; dias_faltam: number; dia: number; mes: number; na_carteira: boolean }>;
        saldoTrustee: Array<{ cpf_cnpj: string; nome: string; saldo_trustee: number }>;
        chequesDevolvidos: Array<{ cpf_cnpj: string; nome: string; qtd_cheques: number; valor_total: number }>;
      };
    },
  });

  const anivHoje = data?.proximosAniversariantes?.filter(a => a.dias_faltam === 0).length || 0;
  const chequesCount = data?.chequesDevolvidos?.length || 0;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-primary/10">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{saudacao}, {profile?.name?.split(' ')[0] || 'Gestor'}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Quick alerts */}
      {!isLoading && (anivHoje > 0 || chequesCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {anivHoje > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm">
              🎂 <span className="font-medium">{anivHoje}</span> aniversariante(s) hoje
            </div>
          )}
          {chequesCount > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              ⚠️ <span className="font-medium">{chequesCount}</span> cedente(s) com cheques devolvidos
            </div>
          )}
        </div>
      )}

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProximosAniversariantesCard
          aniversariantes={data?.proximosAniversariantes || []}
          loading={isLoading}
        />
        <SaldosCard
          saldoTrustee={data?.saldoTrustee || []}
          loading={isLoading}
        />
        <ChequesDevolvidosCard
          chequesDevolvidos={data?.chequesDevolvidos || []}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
