import { AlertTriangle, Check } from 'lucide-react';
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
import { AnaliseIA } from './AnaliseIA';
import { EntityNotes } from '@/components/notes/EntityNotes';

interface CedenteInfoPanelProps {
  data: CedenteDetail;
}

export function CedenteInfoPanel({ data }: CedenteInfoPanelProps) {
  const qtdSuspeitasFraude = data.suspeitasFraude?.length || 0;
  const hasFraude = qtdSuspeitasFraude > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Relatorio de {data.cedente.nome || 'Cedente'}
        </h2>
        <PdfReportButton data={data} />
      </div>

      {hasFraude ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/12 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive">
              {qtdSuspeitasFraude} {qtdSuspeitasFraude === 1 ? 'titulo com suspeita de fraude' : 'titulos com suspeita de fraude'}
            </p>
            <p className="text-xs text-destructive/70">Verifique a secao de fraudes abaixo</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/12 text-success">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-success">Nenhuma suspeita de fraude</p>
            <p className="text-xs text-success/70">Cedente sem alertas de fraude</p>
          </div>
        </div>
      )}

      <DadosEmpresa cedente={data.cedente} resumo={data.resumo} />

      {data.resumoExpandido && (
        <ResumoExpandido resumoExpandido={data.resumoExpandido} limites={data.limites} />
      )}

      <LimitesCard limites={data.limites} />

      <TaxaConfirmacao confirmacao={data.confirmacao} />

      <div className="grid gap-6 lg:grid-cols-2">
        <LiquidezSection liquidez={data.liquidez} />
        <ConcentracaoSacados sacados={data.concentracaoSacados} total={data.carteira.total} />
      </div>

      {data.comportamento90Dias && (
        <ComportamentoPagamento90Dias comportamento={data.comportamento90Dias} />
      )}

      <TitulosHistorico
        titulosAberto={data.titulosAberto}
        titulosQuitados={data.titulosQuitados}
      />

      <OperacoesRecentes operacoes={data.ultimasOperacoes} />

      <SuspeitaFraude suspeitasFraude={data.suspeitasFraude} />

      <AnaliseIA data={data} />

      {data.cedente?.cpf_cnpj && (
        <EntityNotes
          entityType="cedente"
          entityCpfCnpj={String(data.cedente.cpf_cnpj)}
          entityName={data.cedente.nome || undefined}
        />
      )}
    </div>
  );
}
