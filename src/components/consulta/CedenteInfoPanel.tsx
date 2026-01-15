import { CedenteDetail } from '@/pages/CedenteConsulta';
import { DadosEmpresa } from './DadosEmpresa';
import { LimitesCard } from './LimitesCard';
import { TaxaConfirmacao } from './TaxaConfirmacao';
import { LiquidezSection } from './LiquidezSection';
import { ConcentracaoSacados } from './ConcentracaoSacados';
import { OperacoesRecentes } from './OperacoesRecentes';
import { SuspeitaFraude } from './SuspeitaFraude';

interface CedenteInfoPanelProps {
  data: CedenteDetail;
}

export function CedenteInfoPanel({ data }: CedenteInfoPanelProps) {
  const qtdSuspeitasFraude = data.suspeitasFraude?.length || 0;
  const hasFraude = qtdSuspeitasFraude > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Indicador de Suspeita de Fraude no topo */}
      {hasFraude ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-100 border border-red-300 dark:bg-red-950/40 dark:border-red-800">
          <span className="text-red-600 dark:text-red-400 text-sm font-medium">
            ⚠️ {qtdSuspeitasFraude} {qtdSuspeitasFraude === 1 ? 'título com suspeita de fraude' : 'títulos com suspeita de fraude'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-100 border border-green-300 dark:bg-green-950/40 dark:border-green-800">
          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
            ✓ Nenhuma suspeita de fraude
          </span>
        </div>
      )}

      {/* Seção 1: Dados da Empresa */}
      <DadosEmpresa 
        cedente={data.cedente} 
        resumo={data.resumo} 
      />

      {/* Seção 2: Limites e Disponibilidade */}
      <LimitesCard limites={data.limites} />

      {/* Seção 3: Taxa de Confirmação */}
      <TaxaConfirmacao confirmacao={data.confirmacao} />

      {/* Seção 4 e 5: Liquidez e Concentração (lado a lado) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LiquidezSection liquidez={data.liquidez} />
        <ConcentracaoSacados sacados={data.concentracaoSacados} total={data.carteira.total} />
      </div>

      {/* Seção 6: Últimas Operações */}
      <OperacoesRecentes operacoes={data.ultimasOperacoes} />

      {/* Seção 7: Suspeita de Fraude (detalhado) */}
      <SuspeitaFraude suspeitasFraude={data.suspeitasFraude} />
    </div>
  );
}
