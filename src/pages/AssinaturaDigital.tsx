import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Building2, Check, CheckCircle2, ChevronsUpDown, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Loader2, Send, Upload, UserCheck, Users, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { buscarCedentePorDocumento, buscarCedentesCadastrados, type CedenteCadastroResumo } from '@/lib/cedente-api';
import { criarSolicitacao, type CriarSolicitacaoResponse } from '@/lib/assinatura-api';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

type Step = 'dados' | 'posicoes' | 'resultado';
type TipoDocumento = 'contrato_mae' | 'aditivo' | 'carta_cessao' | 'nota_promissoria' | 'duplicata';

interface SignForm {
  nome: string;
  email: string;
  cpfCnpj: string;
}

interface BoxPos {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfBox {
  id: string;
  label: string;
  color: 'blue' | 'amber' | 'emerald';
  pos: BoxPos;
}

interface PdfPositionerProps {
  objectUrl: string;
  boxes: PdfBox[];
  onChange: (id: string, pos: BoxPos) => void;
}

function PdfPositioner({ objectUrl, boxes, onChange }: PdfPositionerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [canvasW, setCanvasW] = useState(0);
  const [canvasH, setCanvasH] = useState(0);
  const [loading, setLoading] = useState(true);

  const renderPage = useCallback(async (pdf: PDFDocumentProxy, pageNum: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    const page = await pdf.getPage(pageNum);
    const containerWidth = container.clientWidth || 640;
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(containerWidth / unscaled.width, 1.8);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setCanvasW(viewport.width);
    setCanvasH(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task as unknown as { cancel: () => void };
    try { await task.promise; } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialPage = boxes[0]?.pos.page || 1;
    setCurrentPage(initialPage);
    setLoading(true);
    pdfjsLib.getDocument(objectUrl).promise.then((pdf) => {
      if (cancelled) return;
      pdfRef.current = pdf;
      setNumPages(pdf.numPages);
      void renderPage(pdf, initialPage);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [boxes, objectUrl, renderPage]);

  useEffect(() => {
    if (!pdfRef.current) return;
    setLoading(true);
    void renderPage(pdfRef.current, currentPage);
  }, [currentPage, renderPage]);

  const toPct = (pos: BoxPos) => ({
    left: `${(pos.x * 100).toFixed(3)}%`,
    top: `${((1 - pos.y - pos.h) * 100).toFixed(3)}%`,
    width: `${(pos.w * 100).toFixed(3)}%`,
    height: `${(pos.h * 100).toFixed(3)}%`,
  });

  const handleDragStart = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    if (!canvasW || !canvasH) return;
    const box = boxes.find((item) => item.id === boxId);
    if (!box) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const { x: ix, y: iy, w, h } = box.pos;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / canvasW;
      const dy = (ev.clientY - startY) / canvasH;
      onChange(boxId, {
        x: Math.max(0, Math.min(1 - w, ix + dx)),
        y: Math.max(0, Math.min(1 - h, iy - dy)),
        w,
        h,
        page: currentPage,
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const boxesOnPage = boxes.filter((box) => box.pos.page === currentPage);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Pagina {currentPage} / {numPages}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Arraste as caixas para o local exato.</p>
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border bg-muted shadow-inner">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <canvas ref={canvasRef} className="block w-full" />
        {canvasW > 0 && boxesOnPage.map((box) => (
          <div
            key={box.id}
            className={cn(
              'absolute flex cursor-grab items-center justify-center rounded border-2 text-xs font-semibold active:cursor-grabbing',
              box.color === 'blue' && 'border-blue-500 bg-blue-500/25 text-blue-900',
              box.color === 'amber' && 'border-amber-500 bg-amber-500/25 text-amber-950',
              box.color === 'emerald' && 'border-emerald-500 bg-emerald-500/25 text-emerald-900',
            )}
            style={toPct(box.pos)}
            onMouseDown={(e) => handleDragStart(e, box.id)}
          >
            <span className="truncate px-2">{box.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DocTypeConfig {
  label: string;
  cedente: BoxPos;
  cessionaria: BoxPos;
  responsavel: BoxPos;
}

const DOC_TYPE_CONFIGS: Record<TipoDocumento, DocTypeConfig> = {
  contrato_mae: {
    label: 'Contrato Mae',
    cedente: { page: 12, x: 0.07, y: 0.67, w: 0.64, h: 0.04 },
    cessionaria: { page: 12, x: 0.07, y: 0.545, w: 0.64, h: 0.04 },
    responsavel: { page: 12, x: 0.07, y: 0.44, w: 0.43, h: 0.04 },
  },
  aditivo: {
    label: 'Aditivo',
    cedente: { page: 2, x: 0.07, y: 0.08, w: 0.64, h: 0.04 },
    cessionaria: { page: 2, x: 0.07, y: 0.62, w: 0.64, h: 0.04 },
    responsavel: { page: 2, x: 0.07, y: 0.35, w: 0.43, h: 0.04 },
  },
  carta_cessao: {
    label: 'Carta de Cessao',
    cedente: { page: 1, x: 0.07, y: 0.30, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.20, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.10, w: 0.43, h: 0.04 },
  },
  nota_promissoria: {
    label: 'Nota Promissoria',
    cedente: { page: 1, x: 0.07, y: 0.35, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.25, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.15, w: 0.43, h: 0.04 },
  },
  duplicata: {
    label: 'Duplicata',
    cedente: { page: 1, x: 0.07, y: 0.30, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.20, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.10, w: 0.43, h: 0.04 },
  },
};

interface DraftDocumento {
  id: string;
  arquivo: File;
  objectUrl: string;
  tipoDocumento: TipoDocumento;
  titulo: string;
  boxCedente: BoxPos;
  boxCessionaria: BoxPos;
  boxResponsavel: BoxPos;
}

interface ResultLink {
  role: 'cedente' | 'responsavel_solidario';
  label: string;
  nome: string;
  link: string;
  token: string;
  status: string;
  totalDocumentos?: number;
}

const EMPTY_FORM: SignForm = { nome: '', email: '', cpfCnpj: '' };

function createDraftDocumento(file: File, tipoDocumento: TipoDocumento = 'contrato_mae'): DraftDocumento {
  const config = DOC_TYPE_CONFIGS[tipoDocumento];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    arquivo: file,
    objectUrl: URL.createObjectURL(file),
    tipoDocumento,
    titulo: file.name.replace(/\.pdf$/i, ''),
    boxCedente: { ...config.cedente },
    boxCessionaria: { ...config.cessionaria },
    boxResponsavel: { ...config.responsavel },
  };
}

export default function AssinaturaDigital() {
  const [step, setStep] = useState<Step>('dados');
  const [tipoDocumentoPadrao, setTipoDocumentoPadrao] = useState<TipoDocumento>('contrato_mae');
  const [documentos, setDocumentos] = useState<DraftDocumento[]>([]);
  const [documentoAtualId, setDocumentoAtualId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [cedente, setCedente] = useState<SignForm>(EMPTY_FORM);
  const [responsavel, setResponsavel] = useState<SignForm>(EMPTY_FORM);
  const [cedenteOpen, setCedenteOpen] = useState(false);
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedenteSugestoes, setCedenteSugestoes] = useState<CedenteCadastroResumo[]>([]);
  const [buscandoCedentes, setBuscandoCedentes] = useState(false);
  const [cedenteSelecionado, setCedenteSelecionado] = useState<CedenteCadastroResumo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [links, setLinks] = useState<ResultLink[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const temResponsavel = Boolean(responsavel.email && responsavel.cpfCnpj);
  const documentoAtual = documentos.find((item) => item.id === documentoAtualId) || documentos[0] || null;

  useEffect(() => {
    return () => {
      documentos.forEach((doc) => URL.revokeObjectURL(doc.objectUrl));
    };
  }, [documentos]);

  useEffect(() => {
    const termo = cedenteSearch.trim();
    if (!cedenteOpen || termo.length < 2) {
      setCedenteSugestoes([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setBuscandoCedentes(true);
      try {
        setCedenteSugestoes(await buscarCedentesCadastrados(termo));
      } catch {
        setCedenteSugestoes([]);
      } finally {
        setBuscandoCedentes(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cedenteOpen, cedenteSearch]);

  const formatarCpfCnpj = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return v;
  };

  const selecionarCedente = async (item: CedenteCadastroResumo) => {
    try {
      const detalhe = await buscarCedentePorDocumento(item.cpf_cnpj);
      setCedente({ nome: detalhe.nome || '', email: detalhe.email || '', cpfCnpj: formatarCpfCnpj(detalhe.cpf_cnpj || '') });
      setCedenteSelecionado(detalhe);
    } catch {
      setCedente({ nome: item.nome || '', email: item.email || '', cpfCnpj: formatarCpfCnpj(item.cpf_cnpj || '') });
      setCedenteSelecionado(item);
    }
    setCedenteOpen(false);
    setCedenteSearch('');
    setCedenteSugestoes([]);
  };

  const onSelecionarArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const novos: DraftDocumento[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast({ title: `O arquivo ${file.name} nao e PDF.`, variant: 'destructive' });
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: `O arquivo ${file.name} excede 50MB.`, variant: 'destructive' });
        continue;
      }
      novos.push(createDraftDocumento(file, tipoDocumentoPadrao));
    }
    if (novos.length) {
      setDocumentos((prev) => [...prev, ...novos]);
      setDocumentoAtualId((prev) => prev || novos[0].id);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateDocumento = (id: string, updater: (doc: DraftDocumento) => DraftDocumento) => {
    setDocumentos((prev) => prev.map((doc) => (doc.id === id ? updater(doc) : doc)));
  };

  const removeDocumento = (id: string) => {
    setDocumentos((prev) => {
      const alvo = prev.find((doc) => doc.id === id);
      if (alvo) URL.revokeObjectURL(alvo.objectUrl);
      const next = prev.filter((doc) => doc.id !== id);
      if (documentoAtualId === id) setDocumentoAtualId(next[0]?.id || null);
      return next;
    });
  };

  const irParaPosicoes = () => {
    if (!documentos.length) {
      toast({ title: 'Adicione ao menos um PDF.', variant: 'destructive' });
      return;
    }
    if (!cedente.nome || !cedente.email || !cedente.cpfCnpj) {
      toast({ title: 'Preencha nome, e-mail e CPF/CNPJ do cedente.', variant: 'destructive' });
      return;
    }
    setDocumentoAtualId((prev) => prev || documentos[0]?.id || null);
    setStep('posicoes');
  };

  const gerar = async () => {
    setEnviando(true);
    try {
      const data: CriarSolicitacaoResponse = await criarSolicitacao({
        documentos: documentos.map((doc) => ({
          arquivo: doc.arquivo,
          titulo: doc.titulo.trim() || doc.arquivo.name.replace(/\.pdf$/i, ''),
          tipo_documento: doc.tipoDocumento,
          contrato_mae: doc.tipoDocumento === 'contrato_mae',
          assinatura_pagina_cedente: doc.boxCedente.page,
          assinatura_x_cedente: doc.boxCedente.x,
          assinatura_y_cedente: doc.boxCedente.y,
          assinatura_largura_cedente: doc.boxCedente.w,
          assinatura_altura_cedente: doc.boxCedente.h,
          assinatura_pagina_gc: doc.boxCessionaria.page,
          assinatura_x_gc: doc.boxCessionaria.x,
          assinatura_y_gc: doc.boxCessionaria.y,
          assinatura_largura_gc: doc.boxCessionaria.w,
          assinatura_altura_gc: doc.boxCessionaria.h,
          assinatura_pagina_rs: doc.boxResponsavel.page,
          assinatura_x_rs: doc.boxResponsavel.x,
          assinatura_y_rs: doc.boxResponsavel.y,
          assinatura_largura_rs: doc.boxResponsavel.w,
          assinatura_altura_rs: doc.boxResponsavel.h,
        })),
        signatario_nome: cedente.nome,
        signatario_email: cedente.email,
        signatario_cpf_cnpj: cedente.cpfCnpj,
        mensagem,
        incluir_assinatura_gold_credit: true,
        ...(temResponsavel && {
          responsavel_solidario_nome: responsavel.nome,
          responsavel_solidario_email: responsavel.email,
          responsavel_solidario_cpf_cnpj: responsavel.cpfCnpj,
        }),
      });

      const novosLinks: ResultLink[] = [];
      for (const item of data.links_operacao || []) {
        if (item.papel_assinatura === 'cessionaria_gold_credit') continue;
        novosLinks.push({
          role: item.papel_assinatura === 'responsavel_solidario' ? 'responsavel_solidario' : 'cedente',
          label: item.papel_assinatura === 'responsavel_solidario' ? 'Responsavel Solidario' : 'Cedente',
          nome: item.nome || (item.papel_assinatura === 'responsavel_solidario' ? responsavel.nome : cedente.nome),
          link: item.link,
          token: item.token,
          status: 'pendente',
          totalDocumentos: item.total_documentos,
        });
      }

      setLinks(novosLinks);
      setStep('resultado');
      toast({ title: 'Operacao criada com sucesso.', description: 'O cliente recebera um unico link para escolher todos os documentos da operacao.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar operacao', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    documentos.forEach((doc) => URL.revokeObjectURL(doc.objectUrl));
    setStep('dados');
    setDocumentos([]);
    setDocumentoAtualId(null);
    setMensagem('');
    setCedente(EMPTY_FORM);
    setResponsavel(EMPTY_FORM);
    setCedenteSelecionado(null);
    setLinks([]);
  };

  const copiarLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copiado.' });
    } catch {
      toast({ title: 'Nao foi possivel copiar o link.', variant: 'destructive' });
    }
  };

  const steps = [
    { key: 'dados', label: 'Dados' },
    { key: 'posicoes', label: 'Posicoes' },
    { key: 'resultado', label: 'Links' },
  ] as const;

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="mt-1 text-sm text-muted-foreground">Envie varios documentos na mesma operacao e gere um link unico para assinatura em lote.</p>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((item, index) => (
          <div key={item.key} className="flex items-center gap-2">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold', step === item.key ? 'bg-primary text-primary-foreground' : steps.findIndex((x) => x.key === step) > index ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
              {steps.findIndex((x) => x.key === step) > index ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span className={cn('text-sm', step === item.key ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{item.label}</span>
            {index < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 'dados' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Documentos da operacao</CardTitle>
              <CardDescription>Cada documento pode ter um tipo proprio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo padrao para novos documentos</Label>
                <Select value={tipoDocumentoPadrao} onValueChange={(value) => setTipoDocumentoPadrao(value as TipoDocumento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DOC_TYPE_CONFIGS) as [TipoDocumento, DocTypeConfig][]).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Esse tipo sera aplicado automaticamente aos PDFs novos, mas voce ainda pode trocar depois em cada item.</p>
              </div>

              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary/50 hover:bg-accent/30">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Adicionar um ou varios PDFs</p>
                  <p className="text-xs text-muted-foreground">Cada documento depois sera ajustado separadamente</p>
                </div>
                <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onSelecionarArquivo} />
              </label>

              {documentos.length > 0 && (
                <div className="space-y-3">
                  {documentos.map((doc, index) => (
                    <div key={doc.id} className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
                        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1.3fr_0.9fr]">
                          <div className="space-y-2">
                            <Label>Titulo do documento</Label>
                            <Input value={doc.titulo} onChange={(e) => updateDocumento(doc.id, (item) => ({ ...item, titulo: e.target.value }))} />
                            <p className="truncate text-xs text-muted-foreground">{doc.arquivo.name}</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo do documento</Label>
                            <Select value={doc.tipoDocumento} onValueChange={(value) => {
                              const tipo = value as TipoDocumento;
                              const config = DOC_TYPE_CONFIGS[tipo];
                              updateDocumento(doc.id, (item) => ({
                                ...item,
                                tipoDocumento: tipo,
                                boxCedente: { ...config.cedente },
                                boxCessionaria: { ...config.cessionaria },
                                boxResponsavel: { ...config.responsavel },
                              }));
                            }}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.entries(DOC_TYPE_CONFIGS) as [TipoDocumento, DocTypeConfig][]).map(([key, cfg]) => (
                                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeDocumento(doc.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Documento {index + 1} de {documentos.length}</span>
                        <button type="button" className="underline" onClick={() => setDocumentoAtualId(doc.id)}>Ajustar posicoes</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-500" /> Cedente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Buscar cedente cadastrado</Label>
                <Popover open={cedenteOpen} onOpenChange={setCedenteOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="h-auto w-full justify-between px-3 py-3 text-left font-normal">
                      <div className="flex min-w-0 items-start gap-3">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          {cedenteSelecionado ? (
                            <>
                              <p className="truncate text-sm font-medium">{cedenteSelecionado.nome}</p>
                              <p className="truncate text-xs text-muted-foreground">{formatarCpfCnpj(cedenteSelecionado.cpf_cnpj)}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm">Pesquisar cedentes cadastrados</p>
                              <p className="text-xs text-muted-foreground">Nome ou CPF/CNPJ</p>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput value={cedenteSearch} onValueChange={setCedenteSearch} placeholder="Nome ou CPF/CNPJ..." />
                      <CommandList>
                        {cedenteSearch.trim().length < 2 ? (
                          <CommandEmpty>Digite ao menos 2 caracteres.</CommandEmpty>
                        ) : buscandoCedentes ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando...</div>
                        ) : cedenteSugestoes.length === 0 ? (
                          <CommandEmpty>Nenhum cedente encontrado.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {cedenteSugestoes.map((item) => (
                              <CommandItem key={item.cpf_cnpj} value={`${item.nome} ${item.cpf_cnpj}`} onSelect={() => selecionarCedente(item)} className="flex items-start gap-3 py-3">
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', cedenteSelecionado?.cpf_cnpj === item.cpf_cnpj ? 'opacity-100' : 'opacity-0')} />
                                <div>
                                  <p className="font-medium">{item.nome || 'Sem nome'}</p>
                                  <p className="text-xs text-muted-foreground">{formatarCpfCnpj(item.cpf_cnpj)}{item.email ? ` · ${item.email}` : ''}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={cedente.nome} onChange={(e) => setCedente((prev) => ({ ...prev, nome: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={cedente.email} onChange={(e) => setCedente((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CPF/CNPJ obrigatorio para assinar</Label>
                <Input value={cedente.cpfCnpj} onChange={(e) => setCedente((prev) => ({ ...prev, cpfCnpj: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-500" /> Responsavel Solidario <span className="text-sm font-normal text-muted-foreground">(opcional)</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={responsavel.nome} onChange={(e) => setResponsavel((prev) => ({ ...prev, nome: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={responsavel.email} onChange={(e) => setResponsavel((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CPF/CNPJ obrigatorio para assinar</Label>
                <Input value={responsavel.cpfCnpj} onChange={(e) => setResponsavel((prev) => ({ ...prev, cpfCnpj: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              <Label htmlFor="mensagem">Mensagem para os signatarios (opcional)</Label>
              <Textarea id="mensagem" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Texto exibido ao abrir o link da operacao" />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" className="gap-2" onClick={irParaPosicoes}>
              Proximo: posicionar assinaturas
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'posicoes' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posicionamento das assinaturas</CardTitle>
              <CardDescription>Selecione cada documento da operacao e ajuste as caixas no PDF correspondente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {documentos.map((doc, index) => (
                  <Button key={doc.id} type="button" variant={documentoAtual?.id === doc.id ? 'default' : 'outline'} onClick={() => setDocumentoAtualId(doc.id)}>
                    {index + 1}. {doc.titulo || doc.arquivo.name}
                  </Button>
                ))}
              </div>

              {documentoAtual && (
                <>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">{documentoAtual.titulo || documentoAtual.arquivo.name}</p>
                    <p className="text-xs text-muted-foreground">{DOC_TYPE_CONFIGS[documentoAtual.tipoDocumento].label} · {documentoAtual.arquivo.name}</p>
                  </div>

                  <PdfPositioner
                    objectUrl={documentoAtual.objectUrl}
                    boxes={[
                      { id: 'cedente', label: `Cedente · ${cedente.nome}`, color: 'blue', pos: documentoAtual.boxCedente },
                      { id: 'cessionaria', label: 'Cessionaria · Gold Credit', color: 'amber', pos: documentoAtual.boxCessionaria },
                      ...(temResponsavel ? [{ id: 'responsavel', label: `Resp. Solidario · ${responsavel.nome || 'Responsavel'}`, color: 'emerald' as const, pos: documentoAtual.boxResponsavel }] : []),
                    ]}
                    onChange={(id, pos) => {
                      updateDocumento(documentoAtual.id, (doc) => {
                        if (id === 'cedente') return { ...doc, boxCedente: pos };
                        if (id === 'cessionaria') return { ...doc, boxCessionaria: pos };
                        return { ...doc, boxResponsavel: pos };
                      });
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep('dados')}>
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button size="lg" className="gap-2" onClick={gerar} disabled={enviando}>
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando operacao...</> : <><Send className="h-4 w-4" />Gerar links da operacao</>}
            </Button>
          </div>
        </div>
      )}

      {step === 'resultado' && (
        <div className="space-y-6">
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Gold Credit assinou a parte interna automaticamente</p>
                <p className="text-xs text-muted-foreground">O cliente agora recebe um unico link e escolhe todos os documentos da operacao.</p>
              </div>
            </CardContent>
          </Card>

          {links.map((link) => (
            <Card key={link.token}>
              <CardHeader>
                <CardTitle className="text-base">{link.label}</CardTitle>
                <CardDescription>{link.nome}{link.totalDocumentos ? ` · ${link.totalDocumentos} documento(s)` : ''}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="truncate text-xs text-muted-foreground">{link.link}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copiarLink(link.link)}>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={link.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir link
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={reiniciar}>Criar nova operacao</Button>
          </div>
        </div>
      )}
    </div>
  );
}
