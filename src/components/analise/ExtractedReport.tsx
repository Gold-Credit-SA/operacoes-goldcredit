import { Building2, User, Calendar, MapPin, Wallet, Users, FileText, Download, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreCard } from './ScoreCard';
import { RestricaoCard } from './RestricaoCard';
import type { DadosExtraidos, ModalidadeCredito, ParticipacaoSocietaria } from '@/types/analise';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExtractedReportProps {
  dados: DadosExtraidos;
  nomeArquivo: string;
}

function InfoItem({ label, value, icon: Icon }: { label: string; value?: string | number; icon?: React.ElementType }) {
  if (!value) return null;
  
  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function CarteiraCard({ carteira }: { carteira: NonNullable<DadosExtraidos['comportamentoFinanceiro']>['carteira'] }) {
  if (!carteira) return null;

  const items = [
    { label: 'A Vencer', value: carteira.aVencer, color: 'text-emerald-500' },
    { label: 'Vencido', value: carteira.vencido, color: 'text-amber-500' },
    { label: 'Prejuízo', value: carteira.prejuizo, color: 'text-destructive' },
    { label: 'Total', value: carteira.total, color: 'text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.label} className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className={`text-lg font-bold ${item.color}`}>
            R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      ))}
    </div>
  );
}

function ModalidadesTable({ modalidades }: { modalidades: ModalidadeCredito[] }) {
  if (!modalidades || modalidades.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Modalidade</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">A Vencer</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Vencido</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Prejuízo</th>
          </tr>
        </thead>
        <tbody>
          {modalidades.map((mod, idx) => (
            <tr key={idx} className="border-b border-border/50">
              <td className="py-2 px-3 font-medium">{mod.nome}</td>
              <td className="text-right py-2 px-3 text-emerald-600">
                R$ {mod.aVencer.toLocaleString('pt-BR')}
              </td>
              <td className="text-right py-2 px-3 text-amber-600">
                R$ {mod.vencido.toLocaleString('pt-BR')}
              </td>
              <td className="text-right py-2 px-3 text-destructive">
                R$ {mod.prejuizo.toLocaleString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParticipacoesList({ participacoes }: { participacoes: ParticipacaoSocietaria[] }) {
  if (!participacoes || participacoes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Nenhuma participação societária encontrada</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {participacoes.map((part, idx) => (
        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{part.razaoSocial}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>CNPJ: {part.cnpj}</span>
            {part.participacao && <span>Participação: {part.participacao}%</span>}
            {part.situacao && <span>Situação: {part.situacao}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExtractedReport({ dados, nomeArquivo }: ExtractedReportProps) {
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text('Relatório de Análise de Crédito', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Documento: ${nomeArquivo}`, 14, 30);
    doc.text(`Data da Consulta: ${dados.dataConsulta}`, 14, 36);
    doc.text(`Tipo: ${dados.tipoDocumento}`, 14, 42);

    // Identificação
    doc.setFontSize(14);
    doc.setTextColor(33);
    doc.text('Identificação', 14, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Campo', 'Valor']],
      body: [
        ['CPF/CNPJ', dados.identificacao.cpfCnpj],
        ['Nome/Razão Social', dados.identificacao.nome],
        ['Situação Receita', dados.identificacao.situacaoReceita || 'N/A'],
        ['Data Abertura/Nascimento', dados.identificacao.dataAbertura || dados.identificacao.dataNascimento || 'N/A'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [212, 175, 55] },
    });

    // Score
    if (dados.score) {
      const currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Score de Crédito', 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Métrica', 'Valor']],
        body: [
          ['Score', dados.score.valor.toString()],
          ['Classificação', dados.score.descricao || 'N/A'],
          ['Probabilidade Pagamento', dados.score.probabilidadePagamento ? `${dados.score.probabilidadePagamento}%` : 'N/A'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [212, 175, 55] },
      });
    }

    // Restrições
    const restY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Restrições', 14, restY);
    
    autoTable(doc, {
      startY: restY + 5,
      head: [['Tipo', 'Quantidade', 'Valor Total']],
      body: [
        ['Protestos', dados.restricoes.protestos.length.toString(), `R$ ${dados.restricoes.protestos.reduce((a, b) => a + b.valor, 0).toLocaleString('pt-BR')}`],
        ['Cheques sem Fundo', dados.restricoes.chequesSemFundo.length.toString(), `R$ ${dados.restricoes.chequesSemFundo.reduce((a, b) => a + b.valor, 0).toLocaleString('pt-BR')}`],
        ['Anotações Negativas', dados.restricoes.anotacoesNegativas.length.toString(), `R$ ${dados.restricoes.anotacoesNegativas.reduce((a, b) => a + b.valor, 0).toLocaleString('pt-BR')}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [212, 175, 55] },
    });

    doc.save(`analise-${dados.identificacao.cpfCnpj.replace(/\D/g, '')}.pdf`);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analise-${dados.identificacao.cpfCnpj.replace(/\D/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPJ = dados.identificacao.cpfCnpj.length > 14;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header com Identificação */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                {isPJ ? (
                  <Building2 className="h-6 w-6 text-primary" />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl">{dados.identificacao.nome}</CardTitle>
                <p className="text-sm text-muted-foreground">{dados.identificacao.cpfCnpj}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4" />
                JSON
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoItem 
              label="Situação Receita" 
              value={dados.identificacao.situacaoReceita} 
              icon={FileText}
            />
            <InfoItem 
              label={isPJ ? "Data Abertura" : "Data Nascimento"} 
              value={dados.identificacao.dataAbertura || dados.identificacao.dataNascimento} 
              icon={Calendar}
            />
            <InfoItem 
              label="Endereço" 
              value={dados.identificacao.endereco} 
              icon={MapPin}
            />
            {isPJ && dados.identificacao.capitalSocial && (
              <InfoItem 
                label="Capital Social" 
                value={`R$ ${dados.identificacao.capitalSocial.toLocaleString('pt-BR')}`}
                icon={Wallet}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="restricoes">Restrições</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="societario">Societário</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dados.score && (
              <ScoreCard
                valor={dados.score.valor}
                faixa={dados.score.faixa}
                descricao={dados.score.descricao}
                probabilidadePagamento={dados.score.probabilidadePagamento}
                fonte={dados.score.fonte}
              />
            )}
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consulta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoItem label="Tipo Documento" value={dados.tipoDocumento} icon={FileText} />
                <InfoItem label="Data Consulta" value={dados.dataConsulta} icon={Calendar} />
                {dados.sancoes && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Sanções</p>
                    <div className="flex gap-4 mt-1">
                      <span className={`text-sm font-medium ${dados.sancoes.nacionais ? 'text-destructive' : 'text-emerald-500'}`}>
                        Nacionais: {dados.sancoes.nacionais ? 'SIM' : 'NÃO'}
                      </span>
                      <span className={`text-sm font-medium ${dados.sancoes.internacionais ? 'text-destructive' : 'text-emerald-500'}`}>
                        Internacionais: {dados.sancoes.internacionais ? 'SIM' : 'NÃO'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="restricoes">
          <Card>
            <CardContent className="pt-6">
              <RestricaoCard restricoes={dados.restricoes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6">
          {dados.comportamentoFinanceiro?.carteira && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Carteira de Crédito</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CarteiraCard carteira={dados.comportamentoFinanceiro.carteira} />
              </CardContent>
            </Card>
          )}

          {dados.comportamentoFinanceiro?.modalidades && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modalidades de Crédito</CardTitle>
              </CardHeader>
              <CardContent>
                <ModalidadesTable modalidades={dados.comportamentoFinanceiro.modalidades} />
              </CardContent>
            </Card>
          )}

          {dados.comportamentoFinanceiro?.classificacaoRisco && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Classificação de Risco SCR</span>
                  <span className="text-lg font-bold text-primary">
                    {dados.comportamentoFinanceiro.classificacaoRisco}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="societario">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Participações Societárias</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ParticipacoesList participacoes={dados.participacoesSocietarias || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
