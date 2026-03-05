import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SCRResponse, DtbEntry, Operacao } from './scr-types';
import {
  VENCIMENTO_AVENCER_MAP, VENCIMENTO_VENCIDO_MAP,
  VENCIMENTO_DETALHE_AVENCER_MAP, VENCIMENTO_LIMITE_MAP, LIMITE_SUB_LABELS,
  CATEGORY_LABELS, CategoryKey, getDisplayCategory, getModalidadeLabel,
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

      // ===== CARTEIRA ATIVA =====
      const aVencerBuckets: Record<string, number> = {};
      const vencidoBuckets: Record<string, number> = {};

      latestDtb.lsOp.filter(op => !isLimiteOp(op)).forEach(op => {
        const { vencidos, aVencer } = separateVencBuckets(op.resVenc);
        Object.entries(aVencer).forEach(([k, v]) => { aVencerBuckets[k] = (aVencerBuckets[k] || 0) + v; });
        Object.entries(vencidos).forEach(([k, v]) => { vencidoBuckets[k] = (vencidoBuckets[k] || 0) + v; });
      });

      const totalAVencer = Object.values(aVencerBuckets).reduce((s, v) => s + v, 0);
      const totalVencido = Object.values(vencidoBuckets).reduce((s, v) => s + v, 0);
      const totalCarteira = totalAVencer + totalVencido;

      sectionTitle('CARTEIRA ATIVA');

      const sortEntries = (entries: [string, number][]) =>
        entries.sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')));

      const carteiraRows: string[][] = [];
      carteiraRows.push(['CARTEIRA ATIVA (A)', formatCurrency(totalCarteira), '100%']);
      carteiraRows.push(['A Vencer', formatCurrency(totalAVencer),
        totalCarteira > 0 ? `${((totalAVencer / totalCarteira) * 100).toFixed(2)}%` : '0%']);
      sortEntries(Object.entries(aVencerBuckets)).forEach(([k, v]) => {
        carteiraRows.push([`  ${VENCIMENTO_AVENCER_MAP[k] || k}`, formatCurrency(v),
          totalCarteira > 0 ? `${((v / totalCarteira) * 100).toFixed(2)}%` : '0%']);
      });

      if (totalVencido === 0) {
        carteiraRows.push(['Vencidos', formatCurrency(0), '0%']);
        carteiraRows.push(['  Não possui créditos vencidos', '', '']);
      } else {
        carteiraRows.push(['Vencidos', formatCurrency(totalVencido),
          totalCarteira > 0 ? `${((totalVencido / totalCarteira) * 100).toFixed(2)}%` : '0%']);
        sortEntries(Object.entries(vencidoBuckets)).forEach(([k, v]) => {
          carteiraRows.push([`  ${VENCIMENTO_VENCIDO_MAP[k] || k}`, formatCurrency(v),
            totalCarteira > 0 ? `${((v / totalCarteira) * 100).toFixed(2)}%` : '0%']);
        });
      }

      autoTable(doc, {
        startY: y,
        head: [['', 'Valor', '%']],
        body: carteiraRows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ===== DETALHAMENTO =====
      sectionTitle('DETALHAMENTO');

      const categoryOrder: CategoryKey[] = ['emprestimos', 'titulos_descontados', 'financiamentos', 'outros_creditos', 'limite'];
      const opsByCategory: Record<CategoryKey, Operacao[]> = {
        emprestimos: [],
        titulos_descontados: [],
        financiamentos: [],
        outros_creditos: [],
        limite: [],
      };

      latestDtb.lsOp.forEach(op => {
        const limite = isLimiteOp(op);
        const cat = getDisplayCategory(op.mod, limite);
        opsByCategory[cat].push(op);
      });

      const totalLimite = opsByCategory.limite.reduce((s, op) => s + calcTotalVenc(op.resVenc), 0);

      const detailRows: (string[])[] = [];

      categoryOrder.forEach(catKey => {
        const ops = opsByCategory[catKey];
        if (ops.length === 0) return;

        const isLimiteCat = catKey === 'limite';

        // Add Limite Total header row
        if (isLimiteCat) {
          detailRows.push(['Limite Total', formatCurrency(totalLimite), 'Não', '']);
        }

        ops.forEach(op => {
          const categoryLabel = isLimiteCat ? 'Limite' : CATEGORY_LABELS[catKey];
          const subLabel = isLimiteCat
            ? (LIMITE_SUB_LABELS[op.mod] || getModalidadeLabel(op.mod))
            : getModalidadeLabel(op.mod);

          const vencStr = Object.entries(op.resVenc)
            .filter(([, v]) => v > 0)
            .sort(([a], [b]) => parseInt(a.replace('v', '')) - parseInt(b.replace('v', '')))
            .map(([k, v]) => {
              const label = isLimiteCat
                ? (VENCIMENTO_LIMITE_MAP[k] || k)
                : (VENCIMENTO_DETALHE_AVENCER_MAP[k] || VENCIMENTO_VENCIDO_MAP[k] || k);
              return `${label}  ${formatCurrency(v)}`;
            })
            .join('\n');

          detailRows.push([
            `${categoryLabel}\n${subLabel}`,
            formatCurrency(calcTotalVenc(op.resVenc)),
            op.varCamb === 'S' ? 'Sim' : 'Não',
            vencStr,
          ]);
        });
      });

      autoTable(doc, {
        startY: y,
        head: [['Modalidade', 'Valor', 'Cambial', 'A vencer']],
        body: detailRows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: { 0: { cellWidth: 45 }, 3: { cellWidth: 80 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

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
