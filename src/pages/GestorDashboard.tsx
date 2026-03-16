import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProximosAniversariantesCard } from '@/components/painel/ProximosAniversariantesCard';
import { SaldosCard } from '@/components/painel/SaldosCard';
import { ChequesDevolvidosCard } from '@/components/painel/ChequesDevolvidosCard';
import { DashboardSkeleton } from '@/components/painel/DashboardSkeleton';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

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
        proximosAniversariantes: Array<{
          nome: string;
          empresa: string;
          data_nascimento: string;
          dias_faltam: number;
          dia: number;
          mes: number;
          na_carteira: boolean;
        }>;
        saldoTrustee: Array<{ cpf_cnpj: string; nome: string; saldo_trustee: number }>;
        chequesDevolvidos: Array<{ cpf_cnpj: string; nome: string; qtd_cheques: number; valor_total: number }>;
      };
    },
  });

  const aniversariantes = data?.proximosAniversariantes || [];
  const saldoTrustee = data?.saldoTrustee || [];
  const chequesDevolvidos = data?.chequesDevolvidos || [];

  const anivHoje = aniversariantes.filter((item) => item.dias_faltam === 0).length;
  const chequesCount = chequesDevolvidos.length;
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = profile?.name?.split(' ')[0] || 'Gestor';
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-700">Painel geral</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {saudacao}, {firstName}
                </h1>
                <p className="mt-1 text-sm capitalize text-muted-foreground">{dataHoje}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 rounded-xl border-amber-200/80 bg-white/70 px-4 text-amber-900 backdrop-blur"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-12">
          <SaldosCard
            saldoTrustee={saldoTrustee}
            loading={isLoading}
            className="xl:col-span-7"
          />
          <div className="grid gap-6 xl:col-span-5">
            <ProximosAniversariantesCard
              aniversariantes={aniversariantes}
              loading={isLoading}
            />
            <ChequesDevolvidosCard
              chequesDevolvidos={chequesDevolvidos}
              loading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
