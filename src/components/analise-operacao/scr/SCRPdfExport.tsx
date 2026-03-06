import { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SCRResponse } from './scr-types';
import { SCRHeader } from './SCRHeader';
import { SCRCreditosCharts, SCRCarteiraAtivaTable } from './SCRCarteiraAtiva';
import { SCRLimitesCredito } from './SCRLimitesCredito';
import { SCRDetalhamento } from './SCRDetalhamento';
import { SCRHistorico } from './SCRHistorico';

interface SCRPdfExportProps {
  data: Record<string, unknown>;
}

function extractResponse(data: Record<string, unknown>): SCRResponse | null {
  const resp = (data as any)?.response || (data as any)?.data?.response || data;
  if (resp?.lsDtb) return resp as SCRResponse;
  if ((data as any)?.data?.lsDtb) return (data as any).data as SCRResponse;
  return null;
}

/**
 * Renders the SCR report sections into a hidden container,
 * captures them with html2canvas, and generates a multi-page PDF
 * that looks identical to the on-screen modal.
 */
export function SCRPdfExport({ data }: SCRPdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = extractResponse(data);
      if (!response || !response.lsDtb?.length) return;

      const latestDtb = response.lsDtb[response.lsDtb.length - 1];
      const entityName = (data as any)?.data?.name || (data as any)?.name || response.name || '';
      const totalOperacoes = latestDtb.lsOp.length;
      const riskClassification = (data as any)?.data?.riskClassification || (data as any)?.riskClassification;

      // Create an off-screen container with proper styling
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:white;padding:32px;z-index:-1;';
      document.body.appendChild(container);

      // Copy all stylesheets to the container's context
      const root = createRoot(container);

      // Render the same components used in the modal
      await new Promise<void>((resolve) => {
        root.render(
          <div className="space-y-6 bg-white text-black" style={{ width: '736px', fontFamily: 'system-ui, sans-serif' }}>
            {/* Title header */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <p style={{ fontSize: '10px', color: '#888' }}>
                Gerado em: {new Date().toLocaleString('pt-BR')}
              </p>
            </div>

            <SCRHeader
              cdCli={response.cdCli}
              dtbConsult={response.dtbConsult}
              entityName={entityName}
              latestDtb={latestDtb}
              totalOperacoes={totalOperacoes}
              riskClassification={riskClassification}
            />
            <SCRCreditosCharts latestDtb={latestDtb} />
            <SCRCarteiraAtivaTable latestDtb={latestDtb} />
            <SCRLimitesCredito latestDtb={latestDtb} />
            <SCRDetalhamento latestDtb={latestDtb} />
            <SCRHistorico lsDtb={response.lsDtb} />
          </div>
        );

        // Wait for recharts to render (animations + layout)
        setTimeout(resolve, 1500);
      });

      // Capture the rendered content
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        windowWidth: 800,
      });

      // Clean up
      root.unmount();
      document.body.removeChild(container);

      // Generate multi-page PDF from the canvas
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2;

      const scaledHeight = (imgHeight * contentWidth) / imgWidth;
      const totalPages = Math.ceil(scaledHeight / contentHeight);

      const doc = new jsPDF('p', 'mm', 'a4');

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();

        // Calculate the source region for this page
        const srcY = (page * contentHeight * imgWidth) / contentWidth;
        const srcHeight = Math.min(
          (contentHeight * imgWidth) / contentWidth,
          imgHeight - srcY
        );

        // Create a canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = Math.ceil(srcHeight);
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, Math.floor(srcY), imgWidth, Math.ceil(srcHeight),
            0, 0, imgWidth, Math.ceil(srcHeight)
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const renderedHeight = (srcHeight * contentWidth) / imgWidth;

        doc.addImage(pageImgData, 'PNG', margin, margin, contentWidth, renderedHeight);
      }

      const fileName = `SCR-${response.cdCli.replace(/\D/g, '')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating SCR PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [data]);

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
