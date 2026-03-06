import { useState, useCallback, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SCRPdfExportProps {
  contentRef: RefObject<HTMLDivElement>;
  cdCli: string;
}

export function SCRPdfExport({ contentRef, cdCli }: SCRPdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = useCallback(async () => {
    if (!contentRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: -window.scrollY,
        windowWidth: contentRef.current.scrollWidth,
      });

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const headerHeight = 6;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2 - headerHeight;

      const scaledHeight = (imgHeight * contentWidth) / imgWidth;
      const totalPages = Math.ceil(scaledHeight / contentHeight);

      const doc = new jsPDF('p', 'mm', 'a4');

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();

        // Small header on first page
        if (page === 0) {
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pdfWidth - margin, margin + 3, { align: 'right' });
        }

        const yOffset = page === 0 ? headerHeight : 0;
        const pageContentHeight = page === 0 ? contentHeight : contentHeight + headerHeight;

        const srcY = page === 0
          ? 0
          : ((contentHeight + (page - 1) * (contentHeight + headerHeight)) * imgWidth) / contentWidth;

        const actualSrcY = page === 0
          ? 0
          : (contentHeight * imgWidth) / contentWidth + (page - 1) * ((contentHeight + headerHeight) * imgWidth) / contentWidth;

        const simpleSrcY = (page * pageContentHeight * imgWidth) / contentWidth;
        const useSrcY = page === 0 ? 0 : ((contentHeight + headerHeight) * page - headerHeight) * imgWidth / contentWidth;

        const srcHeight = Math.min(
          (pageContentHeight * imgWidth) / contentWidth,
          imgHeight - useSrcY
        );

        if (useSrcY >= imgHeight) break;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = Math.ceil(srcHeight);
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, Math.floor(useSrcY), imgWidth, Math.ceil(srcHeight),
            0, 0, imgWidth, Math.ceil(srcHeight)
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const renderedHeight = (srcHeight * contentWidth) / imgWidth;

        doc.addImage(pageImgData, 'PNG', margin, margin + yOffset, contentWidth, renderedHeight);
      }

      const fileName = `SCR-${cdCli.replace(/\D/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating SCR PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [contentRef, cdCli]);

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
