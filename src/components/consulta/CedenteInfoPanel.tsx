import { CedenteDetail } from '@/pages/CedenteConsulta';
import { DadosEmpresa } from './DadosEmpresa';
import { LimitesCard } from './LimitesCard';
import { TaxaConfirmacao } from './TaxaConfirmacao';
import { LiquidezSection } from './LiquidezSection';
import { ConcentracaoSacados } from './ConcentracaoSacados';
import { OperacoesRecentes } from './OperacoesRecentes';

interface CedenteInfoPanelProps {
  data: CedenteDetail;
}

export function CedenteInfoPanel({ data }: CedenteInfoPanelProps) {
  return (
    <div className="space-y-6 animate-fade-in">
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
    </div>
  );
}
