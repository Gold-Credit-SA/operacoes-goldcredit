import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SCRResponse, DtbEntry, Operacao } from './scr-types';
import {
  MODALIDADE_MAP, VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP, VENCIMENTO_LIMITE_MAP,
  CATEGORY_LABELS, CategoryKey, getModalidadeCategory, getModalidadeLabel,
} from './scr-constants';
import {
  formatCurrency, formatCnpj, getRaizDocumento, formatDate,
  formatDtb, calcTotalVenc, calcTotalAVencer, separateVencBuckets, isLimiteOp,
} from './scr-utils';

interface SCRPdfExportProps {
  data: Record<string, unknown>;
}

function extractResponse(data: Record<string, unknown>): SCRResponse | null {
  const resp = (data as any)?.response || (data as any)?.data?.response || data;
  if (resp?.lsDtb) return resp as SCRResponse;
  if ((data as any)?.data?.lsDtb) return (data as any).data as SCRResponse;
  return null;
}

export function SCRPdfExport({ data }: SCRPdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = async () => {
    setIsGenerating(true);
    try {
      const response = extractResponse(data);
      if (!response || !response.lsDtb?.length) return;

      const latestDtb = response.lsDtb[response.lsDtb.length - 1];
      const entityName = (data as any)?.data?.name || (data as any)?.name || response.name || '';

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      const checkPage = (needed: number) => {
        if (y + needed > 270) { doc.addPage(); y = 20; }
      };

      const sectionTitle = (title: string) => {
        checkPage(20);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, y);
        y += 8;
      };

      // ===== HEADER =====
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SCR - Sistema de Informações de Crédito', pageWidth / 2, y, { align: 'center' });
      y += 8;

      if (entityName) {
        doc.setFontSize(12);
        doc.text(entityName, pageWidth / 2, y, { align: 'center' });
        y += 7;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // ===== DADOS GERAIS =====
      sectionTitle('Dados Gerais');

      const headerData = [
        ['CPF/CNPJ', formatCnpj(response.cdCli)],
        ['Raiz do documento', getRaizDocumento(response.cdCli)],
        ['Período consultado', response.dtbConsult],
        ['Início do relacionamento', formatDate(latestDtb.dtbIniRel)],
        ['Total de operações', String(latestDtb.lsOp.length)],
        ['Total de instituições', String(latestDtb.qtdIfs)],
        ['Op. em discordância', String(latestDtb.coobAss)],
        ['Op. sub judice', String(latestDtb.coobRec)],
        ['Doc. processados', `${latestDtb.docProc}%`],
        ['Vol. processado', `${latestDtb.volProc}%`],
      ];

      autoTable(doc, {
        startY: y,
        head: [],
        body: headerData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ===== CRÉDITOS A VENCER =====
      const aVencerBuckets: Record<string, number> = {};
      const vencidoBuckets: Record<string, number> = {};

      latestDtb.lsOp.filter(op => !isLimiteOp(op)).forEach(op => {
        const { vencidos, aVencer } = separateVencBuckets(op.resVenc);
        Object.entries(aVencer).forEach(([k, v]) => { aVencerBuckets[k] = (aVencerBuckets[k] || 0) + v; });
        Object.entries(vencidos).forEach(([k, v]) => { vencidoBuckets[k] = (vencidoBuckets[k] || 0) + v; });
      });

      const totalAVencer = Object.values(aVencerBuckets).reduce((s, v) => s + v, 0);
      const totalVencido = Object.values(vencidoBuckets).reduce((s, v) => s + v, 0);

      sectionTitle(`Créditos a Vencer - ${formatCurrency(totalAVencer)}`);

      const sortEntries = (entries: [string, number][]) =>
        entries.sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

      const aVencerRows = sortEntries(Object.entries(aVencerBuckets)).map(([k, v]) => [
        VENCIMENTO_AVENCER_MAP[k] || k,
        formatCurrency(v),
        totalAVencer > 0 ? `${((v / totalAVencer) * 100).toFixed(2)}%` : '0%',
      ]);
      aVencerRows.push(['Total', formatCurrency(totalAVencer), '100%']);

      autoTable(doc, {
        startY: y,
        head: [['Prazo', 'Valor', '%']],
        body: aVencerRows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ===== CRÉDITOS VENCIDOS =====
      sectionTitle(`Créditos Vencidos - ${formatCurrency(totalVencido)}`);

      if (totalVencido === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(34, 197, 94);
        doc.text('✓ Não possui créditos vencidos', 14, y);
        doc.setTextColor(0, 0, 0);
        y += 10;
      } else {
        const vencidoRows = sortEntries(Object.entries(vencidoBuckets)).map(([k, v]) => [
          VENCIMENTO_VENCIDO_MAP[k] || k,
          formatCurrency(v),
          totalVencido > 0 ? `${((v / totalVencido) * 100).toFixed(2)}%` : '0%',
        ]);
        vencidoRows.push(['Total', formatCurrency(totalVencido), '100%']);

        autoTable(doc, {
          startY: y,
          head: [['Prazo', 'Valor', '%']],
          body: vencidoRows,
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [220, 38, 38] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ===== LIMITES =====
      const limiteOps = latestDtb.lsOp.filter(isLimiteOp);
      if (limiteOps.length > 0) {
        const totalLimite = limiteOps.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);
        sectionTitle(`Limites de Crédito - ${formatCurrency(totalLimite)}`);

        const limiteRows = limiteOps.map(op => [
          getModalidadeLabel(op.mod),
          formatCurrency(calcTotalVenc(op.resVenc)),
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Modalidade', 'Limite']],
          body: limiteRows,
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ===== DETALHAMENTO POR CATEGORIA =====
      const opsByCategory: Record<CategoryKey, { ops: Operacao[]; total: number }> = {
        emprestimos: { ops: [], total: 0 },
        titulos_descontados: { ops: [], total: 0 },
        financiamentos: { ops: [], total: 0 },
        outros_creditos: { ops: [], total: 0 },
        limite: { ops: [], total: 0 },
      };

      latestDtb.lsOp.forEach(op => {
        const cat = getModalidadeCategory(op.mod);
        opsByCategory[cat].ops.push(op);
        opsByCategory[cat].total += calcTotalVenc(op.resVenc);
      });

      const activeCats = (Object.entries(opsByCategory) as [CategoryKey, { ops: Operacao[]; total: number }][])
        .filter(([, { ops }]) => ops.length > 0);

      sectionTitle(`Detalhamento das Operações - ${formatDtb(latestDtb.dtb)}`);

      for (const [catKey, { ops, total }] of activeCats) {
        checkPage(30);

        // Category sub-header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${CATEGORY_LABELS[catKey]} — ${formatCurrency(total)}`, 14, y);
        y += 6;

        const isLimiteCat = catKey === 'limite';
        const opRows = ops.map(op => {
          const vencStr = Object.entries(op.resVenc)
            .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')))
            .map(([k, v]) => `${isLimiteCat ? (VENCIMENTO_LIMITE_MAP[k] || k) : (VENCIMENTO_AVENCER_MAP[k] || VENCIMENTO_VENCIDO_MAP[k] || k)}: ${formatCurrency(v)}`)
            .join(' | ');
          return [
            getModalidadeLabel(op.mod),
            formatCurrency(calcTotalVenc(op.resVenc)),
            vencStr,
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Modalidade', 'Valor', 'Vencimentos']],
          body: opRows,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [100, 116, 139] },
          columnStyles: { 2: { cellWidth: 80 } },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ===== HISTÓRICO MENSAL =====
      if (response.lsDtb.length > 1) {
        sectionTitle('Histórico Mensal');

        const histRows = response.lsDtb.map(dtb => [
          formatDtb(dtb.dtb),
          formatCurrency(calcTotalAVencer(dtb)),
          String(dtb.qtdIfs),
          `${dtb.docProc}%`,
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Mês', 'Total', 'Instituições', 'Doc. Proc.']],
          body: histRows,
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235] },
        });
      }

      // Save
      const fileName = `SCR-${response.cdCli.replace(/\D/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating SCR PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button onClick={generatePdf} disabled={isGenerating} variant="outline" className="gap-2">
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando PDF...
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
