import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
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
import { criarSolicitacao, type CriarSolicitacaoItem } from '@/lib/assinatura-api';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'dados' | 'posicoes' | 'resultado';

interface SignForm {
  nome: string;
  email: string;
  cpfCnpj: string;
}

/** Normalized position: x/y from left/BOTTOM (PDF coords), w/h as fraction of page */
interface BoxPos {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ResultLink {
  role: 'cedente' | 'responsavel_solidario';
  label: string;
  nome: string;
  link: string;
  token: string;
  status: string;
}

// ─── PdfPositioner ────────────────────────────────────────────────────────────

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
    const vp = page.getViewport({ scale });

    canvas.width = vp.width;
    canvas.height = vp.height;
    setCanvasW(vp.width);
    setCanvasH(vp.height);

    const ctx = canvas.getContext('2d')!;
    const task = page.render({ canvasContext: ctx, viewport: vp });
    renderTaskRef.current = task as any;
    try { await task.promise; } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const initialPage = boxes[0]?.pos.page || 1;
    setCurrentPage(initialPage);
    pdfjsLib.getDocument(objectUrl).promise.then((pdf) => {
      if (cancelled) return;
      pdfRef.current = pdf;
      setNumPages(pdf.numPages);
      void renderPage(pdf, initialPage);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [boxes, objectUrl, renderPage]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf) return;
    setLoading(true);
    void renderPage(pdf, currentPage);
  }, [currentPage, renderPage]);

  // Convert PDF coords → CSS % relative to canvas container
  const toPct = (pos: BoxPos) => ({
    left: `${(pos.x * 100).toFixed(3)}%`,
    top: `${((1 - pos.y - pos.h) * 100).toFixed(3)}%`,
    width: `${(pos.w * 100).toFixed(3)}%`,
    height: `${(pos.h * 100).toFixed(3)}%`,
  });

  const handleDragStart = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    if (!canvasW || !canvasH) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const box = boxes.find((b) => b.id === boxId)!;
    const { x: ix, y: iy, w, h } = box.pos;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / canvasW;
      const dy = (ev.clientY - startY) / canvasH;
      onChange(boxId, {
        x: Math.max(0, Math.min(1 - w, ix + dx)),
        y: Math.max(0, Math.min(1 - h, iy - dy)), // invert: screen-down = pdf-y-decrease
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

  const boxesOnPage = boxes.filter((b) => b.pos.page === currentPage);

  return (
    <div className="space-y-3">
      {/* Page nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {currentPage} / {numPages}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Arraste as caixas para posicionar as assinaturas</p>
      </div>

      {/* Canvas + overlays */}
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
              'absolute cursor-grab select-none active:cursor-grabbing',
              'flex items-center justify-center rounded border-2 text-xs font-semibold',
              box.color === 'blue'
                ? 'border-blue-500 bg-blue-500/25 text-blue-800'
                : box.color === 'amber'
                  ? 'border-amber-500 bg-amber-500/25 text-amber-900'
                : 'border-emerald-500 bg-emerald-500/25 text-emerald-800',
            )}
            style={toPct(box.pos)}
            onMouseDown={(e) => handleDragStart(e, box.id)}
          >
            <span className="truncate px-1">{box.label}</span>
          </div>
        ))}
      </div>

      {/* Box info chips */}
      <div className="flex flex-wrap gap-2">
        {boxes.map((box) => (
          <div
            key={box.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              box.color === 'blue'
                ? 'border-blue-200 bg-blue-50'
                : box.color === 'amber'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50',
            )}
          >
            <span
              className={cn(
                'h-3 w-3 rounded-sm border-2',
                box.color === 'blue'
                  ? 'border-blue-500 bg-blue-200'
                  : box.color === 'amber'
                    ? 'border-amber-500 bg-amber-200'
                    : 'border-emerald-500 bg-emerald-200',
              )}
            />
            <span className="font-medium">{box.label}</span>
            <span className="text-muted-foreground">
              · Pág. {box.pos.page}
              {box.pos.page !== currentPage && (
                <button className="ml-1 underline" onClick={() => setCurrentPage(box.pos.page)}>
                  (ver)
                </button>
              )}
            </span>
            {box.pos.page !== currentPage && (
              <button
                className="ml-1 text-xs underline text-muted-foreground"
                onClick={() => onChange(box.id, { ...box.pos, page: currentPage })}
              >
                Mover p/ pág. {currentPage}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_FORM: SignForm = { nome: '', email: '', cpfCnpj: '' };

type TipoDocumento = 'contrato_mae' | 'aditivo' | 'carta_cessao' | 'nota_promissoria' | 'duplicata';

interface DocTypeConfig {
  label: string;
  description: string;
  cedente: BoxPos;
  cessionaria: BoxPos;
  responsavel: BoxPos;
}

const DOC_TYPE_CONFIGS: Record<TipoDocumento, DocTypeConfig> = {
  contrato_mae: {
    label: 'Contrato Mãe',
    description: 'Contrato de relacionamento inicial com o cedente',
    cedente: { page: 12, x: 0.07, y: 0.67, w: 0.64, h: 0.04 },
    cessionaria: { page: 12, x: 0.07, y: 0.545, w: 0.64, h: 0.04 },
    responsavel: { page: 12, x: 0.07, y: 0.44, w: 0.43, h: 0.04 },
  },
  aditivo: {
    label: 'Aditivo',
    description: 'Resumo da operação e dados bancários',
    cedente: { page: 2, x: 0.07, y: 0.08, w: 0.64, h: 0.04 },
    cessionaria: { page: 2, x: 0.07, y: 0.62, w: 0.64, h: 0.04 },
    responsavel: { page: 2, x: 0.07, y: 0.35, w: 0.43, h: 0.04 },
  },
  carta_cessao: {
    label: 'Carta de Cessão',
    description: 'Formalização da cessão de crédito',
    cedente: { page: 1, x: 0.07, y: 0.30, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.20, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.10, w: 0.43, h: 0.04 },
  },
  nota_promissoria: {
    label: 'Nota Promissória',
    description: 'NP da operação',
    cedente: { page: 1, x: 0.07, y: 0.35, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.25, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.15, w: 0.43, h: 0.04 },
  },
  duplicata: {
    label: 'Duplicata',
    description: 'Extensão da cessão para notas fiscais',
    cedente: { page: 1, x: 0.07, y: 0.30, w: 0.64, h: 0.04 },
    cessionaria: { page: 1, x: 0.07, y: 0.20, w: 0.64, h: 0.04 },
    responsavel: { page: 1, x: 0.07, y: 0.10, w: 0.43, h: 0.04 },
  },
};

export default function AssinaturaDigital() {
  const [step, setStep] = useState<Step>('dados');

  // Step 1 state
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('contrato_mae');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [cedente, setCedente] = useState<SignForm>(EMPTY_FORM);
  const [responsavel, setResponsavel] = useState<SignForm>(EMPTY_FORM);
  const [cedenteOpen, setCedenteOpen] = useState(false);
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedenteSugestoes, setCedenteSugestoes] = useState<CedenteCadastroResumo[]>([]);
  const [buscandoCedentes, setBuscandoCedentes] = useState(false);
  const [cedenteSelecionado, setCedenteSelecionado] = useState<CedenteCadastroResumo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [pdfObjectUrl, setPdfObjectUrl] = useState('');
  const [boxCedente, setBoxCedente] = useState<BoxPos>(DOC_TYPE_CONFIGS.contrato_mae.cedente);
  const [boxCessionaria, setBoxCessionaria] = useState<BoxPos>(DOC_TYPE_CONFIGS.contrato_mae.cessionaria);
  const [boxResponsavel, setBoxResponsavel] = useState<BoxPos>(DOC_TYPE_CONFIGS.contrato_mae.responsavel);

  // Update box positions when document type changes
  const handleTipoDocumentoChange = (tipo: TipoDocumento) => {
    setTipoDocumento(tipo);
    const config = DOC_TYPE_CONFIGS[tipo];
    setBoxCedente(config.cedente);
    setBoxCessionaria(config.cessionaria);
    setBoxResponsavel(config.responsavel);
  };

  // Step 3 state
  const [enviando, setEnviando] = useState(false);
  const [links, setLinks] = useState<ResultLink[]>([]);

  const temResponsavel = Boolean(responsavel.email && responsavel.cpfCnpj);

  const formatarCpfCnpj = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return v;
  };

  // Busca de cedentes cadastrados
  useEffect(() => {
    const termo = cedenteSearch.trim();
    if (!cedenteOpen || termo.length < 2) {
      setCedenteSugestoes([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setBuscandoCedentes(true);
      try { setCedenteSugestoes(await buscarCedentesCadastrados(termo)); }
      catch { setCedenteSugestoes([]); }
      finally { setBuscandoCedentes(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [cedenteOpen, cedenteSearch]);

  const selecionarCedente = async (c: CedenteCadastroResumo) => {
    try {
      const det = await buscarCedentePorDocumento(c.cpf_cnpj);
      setCedente({ nome: det.nome || '', email: det.email || '', cpfCnpj: formatarCpfCnpj(det.cpf_cnpj || '') });
      setCedenteSelecionado(det);
    } catch {
      setCedente({ nome: c.nome || '', email: c.email || '', cpfCnpj: formatarCpfCnpj(c.cpf_cnpj || '') });
      setCedenteSelecionado(c);
    }
    setCedenteOpen(false);
    setCedenteSearch('');
    setCedenteSugestoes([]);
  };

  const onSelecionarArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) { toast({ title: 'Selecione um arquivo PDF.', variant: 'destructive' }); return; }
    if (f.size > 50 * 1024 * 1024) { toast({ title: 'Arquivo excede 50MB.', variant: 'destructive' }); return; }
    setArquivo(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  const irParaPosicoes = () => {
    if (!arquivo) { toast({ title: 'Selecione um arquivo PDF.', variant: 'destructive' }); return; }
    if (!cedente.email || !cedente.cpfCnpj || !cedente.nome) {
      toast({ title: 'Preencha nome, e-mail e CPF/CNPJ do cedente.', variant: 'destructive' }); return;
    }
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    setPdfObjectUrl(URL.createObjectURL(arquivo));
    setStep('posicoes');
  };

  const gerar = async () => {
    setEnviando(true);
    try {
      const tituloFinal = titulo.trim() || arquivo!.name.replace(/\.pdf$/i, '');
      const data = await criarSolicitacao({
        arquivo: arquivo!,
        titulo: tituloFinal,
        tipo_documento: tipoDocumento,
        signatario_nome: cedente.nome,
        signatario_email: cedente.email,
        signatario_cpf_cnpj: cedente.cpfCnpj,
        mensagem,
        contrato_mae: true,
        incluir_assinatura_gold_credit: true,
        assinatura_pagina_cedente: boxCedente.page,
        assinatura_x_cedente: boxCedente.x,
        assinatura_y_cedente: boxCedente.y,
        assinatura_largura_cedente: boxCedente.w,
        assinatura_altura_cedente: boxCedente.h,
        assinatura_pagina_gc: boxCessionaria.page,
        assinatura_x_gc: boxCessionaria.x,
        assinatura_y_gc: boxCessionaria.y,
        assinatura_largura_gc: boxCessionaria.w,
        assinatura_altura_gc: boxCessionaria.h,
        ...(temResponsavel && {
          responsavel_solidario_nome: responsavel.nome,
          responsavel_solidario_email: responsavel.email,
          responsavel_solidario_cpf_cnpj: responsavel.cpfCnpj,
          assinatura_pagina_rs: boxResponsavel.page,
          assinatura_x_rs: boxResponsavel.x,
          assinatura_y_rs: boxResponsavel.y,
          assinatura_largura_rs: boxResponsavel.w,
          assinatura_altura_rs: boxResponsavel.h,
        }),
      });

      const solicitacoes: CriarSolicitacaoItem[] = data.solicitacoes?.length ? data.solicitacoes : [data];
      const cedenteSol = solicitacoes.filter((s) => (s.papel_assinatura || 'cedente') === 'cedente');

      const novosLinks: ResultLink[] = [];
      if (cedenteSol[0]) {
        novosLinks.push({ role: 'cedente', label: 'Cedente', nome: cedenteSol[0].signatario_nome || cedente.nome, link: cedenteSol[0].link_assinatura, token: cedenteSol[0].token_acesso, status: cedenteSol[0].status });
      }
      if (cedenteSol[1]) {
        novosLinks.push({ role: 'responsavel_solidario', label: 'Responsável Solidário', nome: cedenteSol[1].signatario_nome || responsavel.nome, link: cedenteSol[1].link_assinatura, token: cedenteSol[1].token_acesso, status: cedenteSol[1].status });
      }

      setLinks(novosLinks);
      setStep('resultado');

      toast({ title: 'Fluxo criado com sucesso.', description: 'Cessionária Gold Credit assinada automaticamente. Links prontos para envio.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar fluxo', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    setStep('dados');
    setArquivo(null);
    setTitulo('');
    setMensagem('');
    setCedente(EMPTY_FORM);
    setResponsavel(EMPTY_FORM);
    setCedenteSelecionado(null);
    setPdfObjectUrl('');
    setTipoDocumento('contrato_mae');
    setBoxCedente(DOC_TYPE_CONFIGS.contrato_mae.cedente);
    setBoxCessionaria(DOC_TYPE_CONFIGS.contrato_mae.cessionaria);
    setBoxResponsavel(DOC_TYPE_CONFIGS.contrato_mae.responsavel);
    setLinks([]);
  };

  const copiarLink = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast({ title: 'Link copiado.' }); }
    catch { toast({ title: 'Não foi possível copiar.', variant: 'destructive' }); }
  };

  // ── Step indicator ──────────────────────────────────────────────────────────
  const steps = [
    { key: 'dados', label: 'Signatários' },
    { key: 'posicoes', label: 'Posicionamento' },
    { key: 'resultado', label: 'Links gerados' },
  ] as const;

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure os signatários, posicione visualmente as assinaturas e gere os links.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              step === s.key ? 'bg-primary text-primary-foreground'
                : steps.findIndex((x) => x.key === step) > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {steps.findIndex((x) => x.key === step) > i ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn('text-sm', step === s.key ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            {i < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Dados ─────────────────────────────────────────────────── */}
      {step === 'dados' && (
        <div className="space-y-6">
          {/* Tipo de Documento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Tipo de Documento</CardTitle>
              <CardDescription>Selecione o tipo de documento antes de importar o PDF.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={tipoDocumento} onValueChange={(v) => handleTipoDocumentoChange(v as TipoDocumento)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DOC_TYPE_CONFIGS) as [TipoDocumento, DocTypeConfig][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">{cfg.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Documento PDF</CardTitle>
            </CardHeader>
            <CardContent>
              {!arquivo ? (
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 hover:border-primary/50 hover:bg-accent/30 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Clique para selecionar um PDF</p>
                    <p className="text-xs text-muted-foreground">Limite de 50 MB</p>
                  </div>
                  <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onSelecionarArquivo} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                    <FileText className="h-8 w-8 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{arquivo.name}</p>
                      <p className="text-xs text-muted-foreground">{(arquivo.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setArquivo(null)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título do documento</Label>
                    <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={arquivo.name.replace(/\.pdf$/i, '')} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cedente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-500" /> Cedente</CardTitle>
              <CardDescription>Signatário principal do contrato.</CardDescription>
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
                          {cedenteSelecionado
                            ? <><p className="truncate text-sm font-medium">{cedenteSelecionado.nome}</p><p className="truncate text-xs text-muted-foreground">{formatarCpfCnpj(cedenteSelecionado.cpf_cnpj)}</p></>
                            : <><p className="text-sm">Pesquisar cedentes cadastrados</p><p className="text-xs text-muted-foreground">Nome ou CPF/CNPJ</p></>}
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
                            {cedenteSugestoes.map((c) => (
                              <CommandItem key={c.cpf_cnpj} value={`${c.nome} ${c.cpf_cnpj}`} onSelect={() => selecionarCedente(c)} className="flex items-start gap-3 py-3">
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', cedenteSelecionado?.cpf_cnpj === c.cpf_cnpj ? 'opacity-100' : 'opacity-0')} />
                                <div>
                                  <p className="font-medium">{c.nome || 'Sem nome'}</p>
                                  <p className="text-xs text-muted-foreground">{formatarCpfCnpj(c.cpf_cnpj)}{c.email ? ` · ${c.email}` : ''}</p>
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
                  <Input value={cedente.nome} onChange={(e) => setCedente((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={cedente.email} onChange={(e) => setCedente((p) => ({ ...p, email: e.target.value }))} placeholder="email@dominio.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ obrigatório para assinar</Label>
                <Input value={cedente.cpfCnpj} onChange={(e) => setCedente((p) => ({ ...p, cpfCnpj: e.target.value }))} placeholder="000.000.000-00" />
              </div>
            </CardContent>
          </Card>

          {/* Responsável Solidário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-500" /> Responsável Solidário <span className="text-sm font-normal text-muted-foreground">(opcional)</span></CardTitle>
              <CardDescription>Segundo signatário do contrato. Deixe em branco se não houver.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={responsavel.nome} onChange={(e) => setResponsavel((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={responsavel.email} onChange={(e) => setResponsavel((p) => ({ ...p, email: e.target.value }))} placeholder="email@dominio.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ obrigatório para assinar</Label>
                <Input value={responsavel.cpfCnpj} onChange={(e) => setResponsavel((p) => ({ ...p, cpfCnpj: e.target.value }))} placeholder="000.000.000-00" />
              </div>
            </CardContent>
          </Card>

          {/* Mensagem */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Label htmlFor="mensagem">Mensagem para os signatários (opcional)</Label>
              <Textarea id="mensagem" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Texto exibido ao abrir o link de assinatura" />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" className="gap-2" onClick={irParaPosicoes}>
              Próximo: Posicionar assinaturas
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Posicionamento ─────────────────────────────────────────── */}
      {step === 'posicoes' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posicionamento das assinaturas</CardTitle>
              <CardDescription>
                Navegue pelas páginas e arraste as caixas coloridas para o local onde cada assinatura deve aparecer.
                A assinatura da Gold Credit continua automática, mas agora usa exatamente a caixa da cessionária definida aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PdfPositioner
                objectUrl={pdfObjectUrl}
                boxes={[
                  { id: 'cedente', label: `Cedente · ${cedente.nome}`, color: 'blue', pos: boxCedente },
                  { id: 'cessionaria', label: 'Cessionaria · Gold Credit', color: 'amber', pos: boxCessionaria },
                  ...(temResponsavel ? [{ id: 'responsavel', label: `Resp. Solidário · ${responsavel.nome || 'Responsável'}`, color: 'emerald' as const, pos: boxResponsavel }] : []),
                ]}
                onChange={(id, pos) => {
                  if (id === 'cedente') setBoxCedente(pos);
                  else if (id === 'cessionaria') setBoxCessionaria(pos);
                  else setBoxResponsavel(pos);
                }}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep('dados')}>
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button size="lg" className="gap-2" onClick={gerar} disabled={enviando}>
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando fluxo...</> : <><Send className="h-4 w-4" />Gerar links de assinatura</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Resultado ─────────────────────────────────────────────── */}
      {step === 'resultado' && (
        <div className="space-y-6">
          {/* GC status — sempre assinado automaticamente (backend obriga) */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Cessionária Gold Credit assinada automaticamente</p>
                <p className="text-xs text-muted-foreground">A assinatura interna foi aplicada pelo servidor. Os links estão prontos para envio.</p>
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          {links.map((link) => (
            <Card key={link.token}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className={cn('h-3 w-3 rounded-sm', link.role === 'cedente' ? 'bg-blue-500' : 'bg-emerald-500')} />
                  {link.label}
                </CardTitle>
                <CardDescription>{link.nome}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="truncate text-xs text-muted-foreground">{link.link}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copiarLink(link.link)}>
                    <Copy className="h-4 w-4" />Copiar link
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={link.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />Abrir link
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={reiniciar}>Criar novo fluxo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
