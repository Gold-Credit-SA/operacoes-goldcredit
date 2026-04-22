import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { CedenteDetail } from '@/pages/CedenteConsulta';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR } from '@/lib/utils';

interface PdfReportButtonProps {
  data: CedenteDetail;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  return formatDateBR(dateStr, '-');
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}

export function PdfReportButton({ data }: PdfReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório do Cedente', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Dados da Empresa
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados da Empresa', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const empresaData = [
        ['Nome', data.cedente.nome || '-'],
        ['CPF/CNPJ', data.cedente.cpf_cnpj || '-'],
        ['Endereço', `${data.cedente.endereco || ''}, ${data.cedente.cidade || ''} - ${data.cedente.uf || ''}`],
        ['CEP', data.cedente.cep || '-'],
        ['Email', data.cedente.email || '-'],
        ['Telefone', data.cedente.telefone || '-'],
        ['Gerente', data.cedente.gerente || '-'],
        ['Operador', data.cedente.operador || '-'],
        ['Captador', data.cedente.captador || '-'],
        ['Setor', data.cedente.setor || '-'],
        ['Grupo Econômico', data.cedente.grupo_economico || '-'],
        ['Data Cadastro', formatDate(data.cedente.data_cadastro)],
        ['Status', data.cedente.bloqueado === 'S' ? 'Bloqueado' : 'Ativo'],
      ];

      autoTable(doc, {
        startY: y,
        head: [],
        body: empresaData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Resumo Financeiro
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Financeiro', 14, y);
      y += 8;

      const resumoData = [
        ['Primeira Operação', formatDate(data.resumo.primeiraOperacao)],
        ['Última Operação', formatDate(data.resumo.ultimaOperacao)],
        ['Total de Operações', data.resumo.totalOperacoes.toString()],
        ['Valor Bruto Total', formatCurrency(data.resumo.valorBrutoTotal)],
        ['Valor Líquido Total', formatCurrency(data.resumo.valorLiquidoTotal)],
        ['Receita Total', formatCurrency(data.resumo.receitaTotal)],
      ];

      autoTable(doc, {
        startY: y,
        head: [],
        body: resumoData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Limites
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Limites e Disponibilidade', 14, y);
      y += 8;

      const limitesData = [
        ['Limite Global', formatCurrency(data.limites.global)],
        ['Disponível', formatCurrency(data.limites.disponivel)],
        ['Risco Atual', formatCurrency(data.limites.risco)],
        ['Saldo', formatCurrency(data.limites.saldo)],
      ];

      autoTable(doc, {
        startY: y,
        head: [],
        body: limitesData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Taxa de Confirmação
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Taxa de Confirmação', 14, y);
      y += 8;

      const confirmacaoData = [
        ['Status', 'Qtd', 'Valor', '%'],
        ['Confirmado', data.confirmacao.confirmado.qtd.toString(), formatCurrency(data.confirmacao.confirmado.valor), formatPercent(data.confirmacao.confirmado.percentual)],
        ['Parcial', data.confirmacao.parcial.qtd.toString(), formatCurrency(data.confirmacao.parcial.valor), formatPercent(data.confirmacao.parcial.percentual)],
        ['Pendente', data.confirmacao.pendente.qtd.toString(), formatCurrency(data.confirmacao.pendente.valor), formatPercent(data.confirmacao.pendente.percentual)],
        ['Sem Confirmação', data.confirmacao.semConfirmacao.qtd.toString(), formatCurrency(data.confirmacao.semConfirmacao.valor), formatPercent(data.confirmacao.semConfirmacao.percentual)],
        ['Total', data.confirmacao.total.qtd.toString(), formatCurrency(data.confirmacao.total.valor), '100%'],
      ];

      autoTable(doc, {
        startY: y,
        head: [confirmacaoData[0]],
        body: confirmacaoData.slice(1),
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Check if we need a new page
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      // Liquidez
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Liquidez', 14, y);
      y += 8;

      const liquidezData = [
        ['Total Quitados', data.liquidez.totalQuitados.toString()],
        ['Valor Quitado', formatCurrency(data.liquidez.valorQuitado)],
        ['Total Recomprados', data.liquidez.totalRecomprados.toString()],
        ['Valor Recomprado', formatCurrency(data.liquidez.valorRecomprado)],
        ['% Pontual', formatPercent(data.liquidez.percentualPontual)],
        ['% Atraso', formatPercent(data.liquidez.percentualAtraso)],
        ['% Recompra', formatPercent(data.liquidez.percentualRecompra)],
        ['% Liquidado', formatPercent(data.liquidez.percentualLiquidado)],
      ];

      autoTable(doc, {
        startY: y,
        head: [],
        body: liquidezData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Check if we need a new page
      if (y > 200) {
        doc.addPage();
        y = 20;
      }

      // Concentração de Sacados
      if (data.concentracaoSacados && data.concentracaoSacados.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Concentração de Sacados (Top 5)', 14, y);
        y += 8;

        const sacadosData = data.concentracaoSacados.slice(0, 5).map(s => [
          s.nome || '-',
          s.cpf_cnpj || '-',
          formatCurrency(s.risco),
          formatPercent(s.concentracao),
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Nome', 'CPF/CNPJ', 'Risco', 'Concentração']],
          body: sacadosData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246] },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Check if we need a new page
      if (y > 180) {
        doc.addPage();
        y = 20;
      }

      // Últimas Operações
      if (data.ultimasOperacoes && data.ultimasOperacoes.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Últimas Operações', 14, y);
        y += 8;

        const operacoesData = data.ultimasOperacoes.slice(0, 10).map(op => [
          op.operacao || '-',
          formatDate(op.data),
          formatCurrency(op.valor_bruto),
          formatCurrency(op.valor_liquido),
          op.etapa || '-',
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Operação', 'Data', 'Valor Bruto', 'Valor Líquido', 'Etapa']],
          body: operacoesData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246] },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Check if we need a new page for fraud section
      if (y > 150) {
        doc.addPage();
        y = 20;
      }

      // Suspeitas de Fraude
      const qtdFraude = data.suspeitasFraude?.length || 0;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Suspeitas de Fraude', 14, y);
      y += 8;

      if (qtdFraude === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(34, 197, 94);
        doc.text('✓ Nenhuma suspeita de fraude identificada', 14, y);
        doc.setTextColor(0, 0, 0);
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`⚠ ${qtdFraude} título(s) com suspeita de fraude`, 14, y);
        doc.setTextColor(0, 0, 0);
        y += 8;

        const fraudeData = data.suspeitasFraude.map(f => [
          f.sacado || '-',
          f.numero_documento || '-',
          formatCurrency(f.valor),
          formatDate(f.vencimento),
          formatDate(f.data_quitacao),
          f.criticas || '-',
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Sacado', 'Documento', 'Valor', 'Vencimento', 'Quitação', 'Críticas']],
          body: fraudeData,
          theme: 'striped',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [220, 38, 38] },
        });
      }

      // Save PDF
      const fileName = `relatorio-cedente-${(data.cedente.cpf_cnpj || 'sem-cnpj').replace(/[^\d]/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePdf}
      disabled={isGenerating}
      variant="outline"
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </>
      )}
    </Button>
  );
}
