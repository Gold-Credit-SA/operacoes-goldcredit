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
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const maxContentHeight = pdfHeight - margin * 2;

      const doc = new jsPDF('p', 'mm', 'a4');

      // Header on first page
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pdfWidth - margin, margin + 3, { align: 'right' });

      let currentY = margin + 6;
      let isFirstPage = true;

      // Capture each direct child section separately to avoid cutting
      const children = Array.from(contentRef.current.children) as HTMLElement[];

      for (const child of children) {
        const canvas = await html2canvas(child, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: -window.scrollY,
        });

        const renderedHeight = (canvas.height * contentWidth) / canvas.width;

        // If this section doesn't fit on current page, start a new page
        if (!isFirstPage || currentY + renderedHeight > maxContentHeight + margin) {
          if (currentY > margin + 6) {
            // Only add new page if we already have content
            if (currentY + renderedHeight > maxContentHeight + margin) {
              doc.addPage();
              currentY = margin;
            }
          }
        }

        // If a single section is taller than a full page, we need to slice it
        if (renderedHeight > maxContentHeight) {
          // Slice this tall section across multiple pages
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const pagePixelHeight = (maxContentHeight * imgWidth) / contentWidth;
          const totalSlices = Math.ceil(imgHeight / pagePixelHeight);

          for (let s = 0; s < totalSlices; s++) {
            if (s > 0 || currentY !== margin) {
              if (s > 0) {
                doc.addPage();
                currentY = margin;
              }
            }

            const srcY = s * pagePixelHeight;
            const srcH = Math.min(pagePixelHeight, imgHeight - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = Math.ceil(srcH);
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(canvas, 0, Math.floor(srcY), imgWidth, Math.ceil(srcH), 0, 0, imgWidth, Math.ceil(srcH));
            }

            const sliceHeight = (srcH * contentWidth) / imgWidth;
            doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, currentY, contentWidth, sliceHeight);
            currentY += sliceHeight;
          }
        } else {
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', margin, currentY, contentWidth, renderedHeight);
          currentY += renderedHeight + 2; // small gap between sections
        }

        isFirstPage = false;
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
