import { CedenteDetail } from '@/pages/CedenteConsulta';
import { DadosEmpresa } from './DadosEmpresa';
import { ResumoExpandido } from './ResumoExpandido';
import { LimitesCard } from './LimitesCard';
import { TaxaConfirmacao } from './TaxaConfirmacao';
import { LiquidezSection } from './LiquidezSection';
import { ConcentracaoSacados } from './ConcentracaoSacados';
import { ComportamentoPagamento90Dias } from './ComportamentoPagamento90Dias';
import { OperacoesRecentes } from './OperacoesRecentes';
import { SuspeitaFraude } from './SuspeitaFraude';
import { PdfReportButton } from './PdfReportButton';
import { TitulosHistorico } from './TitulosHistorico';

interface CedenteInfoPanelProps {
  data: CedenteDetail;
}

export function CedenteInfoPanel({ data }: CedenteInfoPanelProps) {
  const qtdSuspeitasFraude = data.suspeitasFraude?.length || 0;
  const hasFraude = qtdSuspeitasFraude > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com botão de exportar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Relatório de {data.cedente.nome || 'Cedente'}
        </h2>
        <PdfReportButton data={data} />
      </div>
      {/* Indicador de Suspeita de Fraude no topo */}
      {hasFraude ? (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-destructive/10 border border-destructive/30">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/20">
            <span className="text-lg">⚠️</span>
          </div>
          <div>
            <p className="text-destructive text-sm font-semibold">
              {qtdSuspeitasFraude} {qtdSuspeitasFraude === 1 ? 'título com suspeita de fraude' : 'títulos com suspeita de fraude'}
            </p>
            <p className="text-destructive/70 text-xs">Verifique a seção de fraudes abaixo</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-success/10 border border-success/30">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success/20">
            <span className="text-lg">✓</span>
          </div>
          <div>
            <p className="text-success text-sm font-semibold">Nenhuma suspeita de fraude</p>
            <p className="text-success/70 text-xs">Cedente sem alertas de fraude</p>
          </div>
        </div>
      )}

      {/* Seção 1: Dados da Empresa */}
      <DadosEmpresa 
        cedente={data.cedente} 
        resumo={data.resumo} 
      />

      {/* Seção 2: Resumo Financeiro Expandido */}
      {data.resumoExpandido && (
        <ResumoExpandido 
          resumoExpandido={data.resumoExpandido} 
          limites={data.limites}
        />
      )}

      {/* Seção 3: Limites e Disponibilidade */}
      <LimitesCard limites={data.limites} />

      {/* Seção 4: Taxa de Confirmação */}
      <TaxaConfirmacao confirmacao={data.confirmacao} />

      {/* Seção 5 e 6: Liquidez e Concentração (lado a lado) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LiquidezSection liquidez={data.liquidez} />
        <ConcentracaoSacados sacados={data.concentracaoSacados} total={data.carteira.total} />
      </div>

      {/* Seção 7: Comportamento de Pagamentos nos Últimos 90 Dias */}
      {data.comportamento90Dias && (
        <ComportamentoPagamento90Dias comportamento={data.comportamento90Dias} />
      )}

      {/* Seção 8: Histórico de Títulos (Abertos e Quitados) */}
      <TitulosHistorico 
        titulosAberto={data.titulosAberto} 
        titulosQuitados={data.titulosQuitados} 
      />

      {/* Seção 9: Últimas Operações */}
      <OperacoesRecentes operacoes={data.ultimasOperacoes} />

      {/* Seção 10: Suspeita de Fraude (detalhado) */}
      <SuspeitaFraude suspeitasFraude={data.suspeitasFraude} />
    </div>
  );
}
