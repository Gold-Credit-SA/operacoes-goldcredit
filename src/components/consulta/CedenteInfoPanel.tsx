import { CedenteDetail } from '@/pages/CedenteConsulta';
import { DadosEmpresa } from './DadosEmpresa';
import { CarteiraSection } from './CarteiraSection';
import { ConcentracaoSacados } from './ConcentracaoSacados';
import { LiquidezSection } from './LiquidezSection';
import { OperacoesRecentes } from './OperacoesRecentes';
import { ReceitaChart } from './ReceitaChart';

interface CedenteInfoPanelProps {
  data: CedenteDetail;
}

export function CedenteInfoPanel({ data }: CedenteInfoPanelProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <DadosEmpresa 
        cedente={data.cedente} 
        resumo={data.resumo} 
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CarteiraSection carteira={data.carteira} />
        <ConcentracaoSacados sacados={data.concentracaoSacados} total={data.carteira.total} />
      </div>

      <LiquidezSection liquidez={data.liquidez} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ReceitaChart receitaMensal={data.receitaMensal} />
        <OperacoesRecentes operacoes={data.ultimasOperacoes} />
      </div>
    </div>
  );
}
