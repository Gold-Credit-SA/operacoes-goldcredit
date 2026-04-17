import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, BarChart3, Brain, Building2, CreditCard, FileText, Image, Loader2,
  MessageCircle, Plus, Receipt, Search, Send, Shield, Sparkles, Trash2,
  Upload, X, PenLine, CalendarIcon, AlertTriangle, CheckCircle2, TrendingUp, Lightbulb, Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AnalysisDashboard } from '@/components/credit-analysis/AnalysisDashboard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseNfeXml, type NotaFiscalXml } from '@/lib/xml-nfe-parser';
import { extractTextFromPdf } from '@/lib/pdf-extractor';
import { PageLoadingSkeleton } from '@/components/ui/PageLoadingSkeleton';

// ─── Types ───

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  saved?: boolean;
}

type ManualDocType = 'cheque' | 'duplicata' | 'boleto' | 'nota_promissoria' | 'contrato' | 'outro';

const MANUAL_DOC_LABELS: Record<ManualDocType, string> = {
  cheque: 'Cheque', duplicata: 'Duplicata', boleto: 'Boleto',
  nota_promissoria: 'Nota Promissória', contrato: 'Contrato', outro: 'Outro',
};

interface ImportedDocument {
  id: string;
  fileName: string;
  type: 'xml' | 'pdf' | 'image' | 'manual';
  content: string;
  parsedNfe?: NotaFiscalXml;
  manualData?: { docType: ManualDocType; valor: number; vencimento: string; observacao: string };
}

interface CedenteSmartResult {
  cpf_cnpj: string;
  nome: string;
  data: Record<string, unknown>;
}

interface SessionData {
  id: string;
  client_id: string;
  client_cpf_cnpj: string;
  client_name: string | null;
  cedente_cpf_cnpj: string | null;
  cedente_nome: string | null;
  cedente_data: Record<string, unknown> | null;
  documents: any[];
  client_consultations: any;
  initial_analysis: any;
  sacados?: Array<{ id?: string; cpf_cnpj: string; name: string | null }> | null;
}

// ─── Streaming helper ───

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/credit-analysis-chat`;

async function streamChat({
  sessionId, messages, context, onDelta, onDone, onError,
}: {
  sessionId: string;
  messages: ChatMessage[];
  context: any;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ sessionId, messages, context }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    onError(errData.error || `Erro ${resp.status}`);
    return;
  }

  if (!resp.body) { onError('Sem resposta'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  // Flush remaining
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

// ─── Main Page ───

export default function AnaliseCredito() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState('analise');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Documents and cedente for new sessions
  const [documents, setDocuments] = useState<ImportedDocument[]>([]);
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedenteResults, setCedenteResults] = useState<CedenteSmartResult[]>([]);
  const [selectedCedente, setSelectedCedente] = useState<CedenteSmartResult | null>(null);
  const [searchingCedente, setSearchingCedente] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDocType, setManualDocType] = useState<ManualDocType>('cheque');
  const [manualValor, setManualValor] = useState('');
  const [manualVencimento, setManualVencimento] = useState<Date | undefined>();
  const [manualObs, setManualObs] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingManualDoc, setPendingManualDoc] = useState<ImportedDocument | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<ImportedDocument | null>(null);

  const clientId = searchParams.get('clientId');
  const clientCpfCnpj = searchParams.get('cpfCnpj');
  const clientName = searchParams.get('name');

  // Load all sacados from sessionStorage (multi-select) — used only when starting a new session
  const [allClients, setAllClients] = useState<Array<{ id: string; cpf_cnpj: string; name: string | null }>>([]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('analysisClients');
      if (stored) {
        setAllClients(JSON.parse(stored));
        sessionStorage.removeItem('analysisClients');
      } else if (clientId && clientCpfCnpj) {
        setAllClients([{ id: clientId, cpf_cnpj: clientCpfCnpj, name: clientName }]);
      }
      const storedCedente = sessionStorage.getItem('analysisCedente');
      if (storedCedente) {
        const c = JSON.parse(storedCedente) as CedenteSmartResult;
        if (c?.cpf_cnpj) setSelectedCedente(c);
        sessionStorage.removeItem('analysisCedente');
      }
    } catch { /* ignore */ }
  }, []);

  // Load existing session
  useEffect(() => {
    if (!sessionId || sessionId === 'new') {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: sess } = await supabase
        .from('credit_analysis_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sess) {
        const s = sess as unknown as SessionData;
        setSession(s);
        if (s.cedente_cpf_cnpj) {
          setSelectedCedente({ cpf_cnpj: s.cedente_cpf_cnpj, nome: s.cedente_nome || '', data: (s.cedente_data || {}) as Record<string, unknown> });
        }
        setDocuments((s.documents || []) as ImportedDocument[]);

        // Hydrate allClients from persisted sacados (fall back to single client)
        if (Array.isArray(s.sacados) && s.sacados.length > 0) {
          setAllClients(s.sacados.map(sc => ({ id: sc.id || sc.cpf_cnpj, cpf_cnpj: sc.cpf_cnpj, name: sc.name })));
        } else if (s.client_cpf_cnpj) {
          setAllClients([{ id: s.client_id, cpf_cnpj: s.client_cpf_cnpj, name: s.client_name }]);
        }

        // Load messages
        const { data: msgs } = await supabase
          .from('credit_analysis_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (msgs) {
          setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, saved: true })));
        }
      }
      setLoading(false);
    })();
  }, [sessionId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load client consultations for ALL sacados
  const [clientConsultations, setClientConsultations] = useState<any>(null);

  // Build context for AI
  const buildContext = useCallback(() => {
    const docs = documents.map(d => ({
      fileName: d.fileName,
      type: d.type,
      content: d.type === 'image' ? d.content : d.content.substring(0, 8000),
      parsedNfe: d.parsedNfe ? {
        numero: d.parsedNfe.numero, serie: d.parsedNfe.serie,
        valor: d.parsedNfe.valor, dataEmissao: d.parsedNfe.dataEmissao,
        chaveAcesso: d.parsedNfe.chaveAcesso, emitente: d.parsedNfe.emitente, sacado: d.parsedNfe.sacado,
      } : undefined,
      manualData: d.manualData || undefined,
    }));

    return {
      documentosImportados: docs,
      dadosCedenteSmart: selectedCedente?.data || session?.cedente_data,
      consultasSacado: session?.client_consultations || clientConsultations,
      perfilCliente: allClients.length > 1
        ? { sacados: allClients.map(c => ({ nome: c.name, cpfCnpj: c.cpf_cnpj })) }
        : { nome: clientName || session?.client_name, cpfCnpj: clientCpfCnpj || session?.client_cpf_cnpj },
    };
  }, [documents, selectedCedente, session, clientName, clientCpfCnpj, allClients, clientConsultations]);

  useEffect(() => {
    const cpfList = allClients.length > 0
      ? allClients.map(c => c.cpf_cnpj)
      : (clientCpfCnpj || session?.client_cpf_cnpj) ? [clientCpfCnpj || session?.client_cpf_cnpj!] : [];
    if (cpfList.length === 0) return;

    (async () => {
      const { data } = await supabase
        .from('consulta_history')
        .select('*')
        .in('cnpj', cpfList)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(200);

      if (data) {
        // Group by sacado
        const bySacado: Record<string, any> = {};
        for (const cpf of cpfList) {
          const forCpf = data.filter((d: any) => d.cnpj === cpf);
          const latest = (platform: string) => forCpf.find((d: any) => d.platform === platform);
          const s = latest('smart');
          const se = latest('serasa');
          const sc = latest('scr');
          const clienteInfo = allClients.find(c => c.cpf_cnpj === cpf);
          bySacado[cpf] = {
            nome: clienteInfo?.name || cpf,
            smart: s ? { data: (s as any).result_data, createdAt: s.created_at } : null,
            serasa: se ? { data: (se as any).result_data, createdAt: se.created_at } : null,
            scr: sc ? { data: (sc as any).result_data, createdAt: sc.created_at } : null,
          };
        }
        setClientConsultations(cpfList.length === 1 ? bySacado[cpfList[0]] : bySacado);
      }
    })();
  }, [allClients, clientCpfCnpj, session?.client_cpf_cnpj]);

  // Initialize session (first time)
  const initializeSession = async () => {
    if (!user || !clientId || !selectedCedente || documents.length === 0) {
      toast.error('Selecione o cedente e adicione documentos.');
      return;
    }

    setIsInitializing(true);
    try {
      // First run the initial analysis
      const documentPayload = documents.map(d => ({
        fileName: d.fileName, type: d.type,
        content: d.type === 'image' ? d.content : d.content.substring(0, 8000),
        parsedNfe: d.parsedNfe ? { numero: d.parsedNfe.numero, serie: d.parsedNfe.serie, valor: d.parsedNfe.valor, dataEmissao: d.parsedNfe.dataEmissao, chaveAcesso: d.parsedNfe.chaveAcesso, emitente: d.parsedNfe.emitente, sacado: d.parsedNfe.sacado } : undefined,
        manualData: d.manualData || undefined,
      }));

      const clientProfile = allClients.length > 1
        ? { sacados: allClients.map(c => ({ nome: c.name, cpfCnpj: c.cpf_cnpj })) }
        : { nome: clientName, cpfCnpj: clientCpfCnpj };

      const { data: analysisData, error: analysisErr } = await supabase.functions.invoke('analyze-credit-operation', {
        body: {
          documents: documentPayload,
          cedenteData: selectedCedente.data,
          clientConsultations,
          clientProfile,
        },
      });

      if (analysisErr) throw analysisErr;
      if (analysisData?.error) throw new Error(analysisData.error);

      // Create session
      const sacadosPayload = allClients.map(c => ({ id: c.id, cpf_cnpj: c.cpf_cnpj, name: c.name }));

      const { data: newSession, error: sessErr } = await supabase
        .from('credit_analysis_sessions')
        .insert({
          client_id: clientId,
          client_cpf_cnpj: clientCpfCnpj!,
          client_name: clientName,
          cedente_cpf_cnpj: selectedCedente.cpf_cnpj,
          cedente_nome: selectedCedente.nome,
          cedente_data: selectedCedente.data as any,
          documents: documentPayload as any,
          client_consultations: clientConsultations as any,
          sacados: sacadosPayload as any,
          initial_analysis: analysisData.analysis as any,
          created_by: user.id,
        })
        .select()
        .single();

      if (sessErr) throw sessErr;

      const s = newSession as unknown as SessionData;
      setSession(s);

      // Save initial analysis as first assistant message
      const summaryContent = formatInitialAnalysis(analysisData.analysis);
      await supabase.from('credit_analysis_messages').insert({
        session_id: s.id,
        role: 'assistant',
        content: summaryContent,
      });

      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: summaryContent, saved: true }]);

      // Navigate to the session URL
      navigate(`/analise-credito/${s.id}`, { replace: true });
      toast.success('Análise de crédito iniciada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar análise.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isStreaming || !session) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    let assistantContent = '';

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.saved) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const allMsgs = [...messages, userMsg].filter(m => m.role !== 'system');
      await streamChat({
        sessionId: session.id,
        messages: allMsgs,
        context: buildContext(),
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsStreaming(false);
          // Save assistant message
          if (assistantContent) {
            await supabase.from('credit_analysis_messages').insert({
              session_id: session.id,
              role: 'assistant',
              content: assistantContent,
            });
          }
        },
        onError: (err) => {
          setIsStreaming(false);
          toast.error(err);
        },
      });
    } catch {
      setIsStreaming(false);
      toast.error('Erro ao enviar mensagem.');
    }
  };

  // Cedente search
  const searchCedente = useCallback(async () => {
    const q = cedenteSearch.trim();
    if (q.length < 3) return;
    setSearchingCedente(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-db', {
        body: { action: 'cedentes-list', filters: { search: q } },
      });
      if (error) throw error;
      const items = data?.data || data?.results || data?.cedentes || [];
      setCedenteResults(items.map((c: any) => ({
        cpf_cnpj: c.cpf_cnpj || c.cnpj || c.cpf || '',
        nome: c.nome || c.razao_social || c.name || '',
        data: c,
      })));
    } catch { toast.error('Erro ao buscar cedentes.'); }
    finally { setSearchingCedente(false); }
  }, [cedenteSearch]);

  // File upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const id = crypto.randomUUID();
      try {
        if (ext === 'xml') {
          const content = await file.text();
          const parsedNfe = parseNfeXml(content, file.name);
          setDocuments(prev => [...prev, { id, fileName: file.name, type: 'xml', content, parsedNfe }]);
        } else if (ext === 'pdf') {
          const text = await extractTextFromPdf(file);
          setDocuments(prev => [...prev, { id, fileName: file.name, type: 'pdf', content: text }]);
        } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          const reader = new FileReader();
          reader.onload = () => {
            setDocuments(prev => [...prev, { id, fileName: file.name, type: 'image', content: `[Imagem: ${file.name}, ${(file.size / 1024).toFixed(0)}KB]` }]);
          };
          reader.readAsDataURL(file);
        } else { toast.error(`Formato não suportado: .${ext}`); }
      } catch (err) { toast.error(`Erro ao processar ${file.name}`); }
    }
    e.target.value = '';
  }, []);

  const addManualDocument = () => {
    const valor = parseFloat(manualValor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { toast.error('Informe um valor válido.'); return; }
    if (!manualVencimento) { toast.error('Informe a data de vencimento.'); return; }
    const label = MANUAL_DOC_LABELS[manualDocType];
    const vencStr = format(manualVencimento, 'dd/MM/yyyy');
    const newDoc: ImportedDocument = {
      id: crypto.randomUUID(), fileName: `${label} - Venc. ${vencStr}`, type: 'manual',
      content: `Documento manual: ${label}, Vencimento: ${vencStr}, Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.${manualObs ? ` Obs: ${manualObs}` : ''}`,
      manualData: { docType: manualDocType, valor, vencimento: manualVencimento.toISOString(), observacao: manualObs },
    };

    // Check for duplicates: same type + same value + same vencimento
    const duplicate = documents.find(d => {
      if (d.manualData) {
        return d.manualData.docType === manualDocType &&
          Math.abs(d.manualData.valor - valor) < 0.01 &&
          format(new Date(d.manualData.vencimento), 'dd/MM/yyyy') === vencStr;
      }
      if (d.parsedNfe) {
        return Math.abs(d.parsedNfe.valor - valor) < 0.01;
      }
      return false;
    });

    if (duplicate) {
      setPendingManualDoc(newDoc);
      setDuplicateMatch(duplicate);
      setDuplicateDialogOpen(true);
      return;
    }

    finishAddDocument(newDoc);
  };

  const finishAddDocument = (doc: ImportedDocument) => {
    setDocuments(prev => [...prev, doc]);
    setManualValor(''); setManualVencimento(undefined); setManualObs(''); setShowManualForm(false);
    const label = doc.manualData ? MANUAL_DOC_LABELS[doc.manualData.docType] : 'Documento';
    toast.success(`${label} adicionado.`);
  };

  const confirmAddDuplicate = () => {
    if (pendingManualDoc) {
      const markedDoc: ImportedDocument = {
        ...pendingManualDoc,
        content: pendingManualDoc.content + ' [CONFIRMADO: NÃO é duplicata - documento distinto com mesmo valor/vencimento]',
      };
      finishAddDocument(markedDoc);
    }
    setDuplicateDialogOpen(false);
    setPendingManualDoc(null);
    setDuplicateMatch(null);
  };

  const cancelAddDuplicate = () => {
    setDuplicateDialogOpen(false);
    setPendingManualDoc(null);
    setDuplicateMatch(null);
    toast.info('Documento não adicionado.');
  };

  const canStart = documents.length > 0 && selectedCedente;
  const isNewSession = !sessionId || sessionId === 'new';

  if (loading) return <PageLoadingSkeleton message="Carregando análise..." />;

  // ─── SETUP VIEW (new session) ───
  if (isNewSession || !session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-6 py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="text-base font-bold text-foreground">Nova Análise de Crédito</h1>
            </div>
            {clientName && (
              <Badge variant="outline" className="ml-auto text-xs">{clientName} · {clientCpfCnpj}</Badge>
            )}
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Cedente Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> 1. Selecionar Cedente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCedente ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedCedente.nome}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedCedente.cpf_cnpj}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedCedente(null); setCedenteResults([]); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar cedente por nome ou CNPJ..." value={cedenteSearch} onChange={e => setCedenteSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCedente()} className="pl-10" />
                    </div>
                    <Button variant="outline" onClick={searchCedente} disabled={searchingCedente || cedenteSearch.trim().length < 3}>
                      {searchingCedente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {cedenteResults.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                      {cedenteResults.map(c => (
                        <button key={c.cpf_cnpj} onClick={() => { setSelectedCedente(c); setCedenteResults([]); }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> 2. Importar Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/40 transition-colors">
                  <input type="file" id="credit-doc-upload" multiple accept=".xml,.pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} className="hidden" />
                  <label htmlFor="credit-doc-upload" className="cursor-pointer space-y-2 block">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Upload de arquivo</p>
                    <p className="text-xs text-muted-foreground/70">XML · PDF · Imagens</p>
                  </label>
                </div>
                <button type="button" onClick={() => setShowManualForm(v => !v)} className="flex-1 border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/40 transition-colors cursor-pointer">
                  <PenLine className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Entrada manual</p>
                  <p className="text-xs text-muted-foreground/70">Cheque · Duplicata · Boleto</p>
                </button>
              </div>

              {showManualForm && (
                <div className="rounded-lg border bg-card p-4 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Tipo de documento</label>
                      <Select value={manualDocType} onValueChange={v => setManualDocType(v as ManualDocType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(MANUAL_DOC_LABELS) as [ManualDocType, string][]).map(([k, l]) => (
                            <SelectItem key={k} value={k}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Valor (R$)</label>
                      <Input placeholder="0,00" value={manualValor} onChange={e => setManualValor(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Vencimento (bom para)</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !manualVencimento && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {manualVencimento ? format(manualVencimento, 'dd/MM/yyyy') : <span>Selecionar data</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={manualVencimento} onSelect={setManualVencimento} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Observação</label>
                      <Input placeholder="Opcional" value={manualObs} onChange={e => setManualObs(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={addManualDocument} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                  </div>
                </div>
              )}

              {documents.length > 0 && (
                <div className="space-y-1.5">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card">
                      {doc.type === 'xml' ? <FileText className="h-4 w-4 text-emerald-600 shrink-0" /> :
                       doc.type === 'pdf' ? <FileText className="h-4 w-4 text-red-600 shrink-0" /> :
                       doc.type === 'manual' ? <Receipt className="h-4 w-4 text-amber-600 shrink-0" /> :
                       <Image className="h-4 w-4 text-blue-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        {doc.parsedNfe && <p className="text-xs text-muted-foreground">NF {doc.parsedNfe.numero} · R$ {doc.parsedNfe.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                        {doc.manualData && <p className="text-xs text-muted-foreground">{MANUAL_DOC_LABELS[doc.manualData.docType]} · R$ {doc.manualData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Venc. {format(new Date(doc.manualData.vencimento), 'dd/MM/yyyy')}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{doc.type === 'manual' ? MANUAL_DOC_LABELS[doc.manualData!.docType].toUpperCase() : doc.type.toUpperCase()}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consultations info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`text-xs ${clientConsultations?.serasa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
              <Shield className="h-3 w-3 mr-1" /> Serasa {clientConsultations?.serasa ? '✓' : '—'}
            </Badge>
            <Badge variant="outline" className={`text-xs ${clientConsultations?.scr ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
              <CreditCard className="h-3 w-3 mr-1" /> SCR {clientConsultations?.scr ? '✓' : '—'}
            </Badge>
            <Badge variant="outline" className={`text-xs ${clientConsultations?.smart ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
              <Building2 className="h-3 w-3 mr-1" /> Smart {clientConsultations?.smart ? '✓' : '—'}
            </Badge>
          </div>

          {/* Start button */}
          <Button onClick={initializeSession} disabled={isInitializing || !canStart}
            className="w-full gap-2 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-primary-foreground hover:opacity-95 h-12 text-base">
            {isInitializing ? <><Loader2 className="h-5 w-5 animate-spin" /> Analisando e iniciando chat...</> :
              <><Brain className="h-5 w-5" /> Iniciar Análise com IA</>}
          </Button>

          {!canStart && <p className="text-xs text-muted-foreground text-center">Selecione o cedente e importe ao menos um documento.</p>}
        </div>

        {/* Duplicate detection dialog */}
        <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-amber-500" />
                Documento possivelmente duplicado
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Foi encontrado um documento já adicionado com o <strong>mesmo valor e vencimento</strong>:</p>
                  {duplicateMatch && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">{duplicateMatch.fileName}</p>
                      {duplicateMatch.manualData && (
                        <p className="text-xs mt-1">
                          {MANUAL_DOC_LABELS[duplicateMatch.manualData.docType]} · R$ {duplicateMatch.manualData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Venc. {format(new Date(duplicateMatch.manualData.vencimento), 'dd/MM/yyyy')}
                        </p>
                      )}
                      {duplicateMatch.parsedNfe && (
                        <p className="text-xs mt-1">
                          NF {duplicateMatch.parsedNfe.numero} · R$ {duplicateMatch.parsedNfe.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-sm">Este documento é <strong>duplicado</strong> ou são <strong>documentos distintos</strong> com mesmo valor?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelAddDuplicate}>
                É duplicado, não adicionar
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmAddDuplicate} className="bg-primary">
                Não é duplicado, adicionar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── CHAT VIEW (existing session) ───
  const analysis = session.initial_analysis;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="shrink-0 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clientes/${session.client_id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground">Análise de Crédito</h1>
          <Badge variant="outline" className="text-xs">{session.client_name || session.client_cpf_cnpj}</Badge>
          {session.cedente_nome && (
            <Badge variant="outline" className="text-xs bg-primary/5">
              <Building2 className="h-3 w-3 mr-1" /> {session.cedente_nome}
            </Badge>
          )}

          <div className="ml-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="analise" className="text-xs px-3 gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Análise</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs px-3 gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Chat</TabsTrigger>
                <TabsTrigger value="context" className="text-xs px-3 gap-1.5"><FileText className="h-3.5 w-3.5" /> Contexto</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'analise' ? (
          <ScrollArea className="h-full p-6">
            <div className="max-w-4xl mx-auto pb-6">
              <AnalysisDashboard
                analysis={analysis}
                clientConsultations={session.client_consultations}
                cedenteData={session.cedente_data}
                clientName={session.client_name}
                clientCpfCnpj={session.client_cpf_cnpj}
                cedenteName={session.cedente_nome}
                cedenteCpfCnpj={session.cedente_cpf_cnpj}
              />
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={() => setActiveTab('chat')} className="gap-2">
                  <MessageCircle className="h-4 w-4" /> Conversar com a IA sobre esta análise
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : activeTab === 'chat' ? (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-4 pb-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted/60 border border-border rounded-bl-md'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none text-foreground
                          prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                          prose-h2:text-base prose-h2:border-b prose-h2:border-border prose-h2:pb-1.5
                          prose-h3:text-sm
                          prose-strong:text-foreground prose-strong:font-semibold
                          prose-p:text-foreground prose-p:text-sm prose-p:leading-relaxed prose-p:my-1.5
                          prose-li:text-foreground prose-li:text-sm prose-li:my-0.5
                          prose-ul:my-2 prose-ol:my-2
                          prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-md prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic prose-blockquote:text-sm
                          prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                          prose-hr:border-border prose-hr:my-3
                          [&_table]:text-xs [&_table]:w-full [&_th]:bg-muted/80 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-border/50
                        ">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-muted/60 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="shrink-0 border-t border-border bg-background p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Pergunte sobre a operação, forneça informações adicionais..."
                  className="min-h-[44px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button onClick={sendMessage} disabled={isStreaming || !inputValue.trim()} size="icon" className="h-11 w-11 shrink-0">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Context tab */
          <ScrollArea className="h-full p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Documents */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos Importados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {(session.documents || []).map((doc: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card">
                        {doc.type === 'xml' ? <FileText className="h-4 w-4 text-emerald-600" /> :
                         doc.type === 'manual' ? <Receipt className="h-4 w-4 text-amber-600" /> :
                         <FileText className="h-4 w-4 text-muted-foreground" />}
                        <p className="text-sm flex-1 truncate">{doc.fileName}</p>
                        <Badge variant="outline" className="text-[10px]">{doc.type?.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cedente */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Cedente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-semibold">{session.cedente_nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{session.cedente_cpf_cnpj}</p>
                </CardContent>
              </Card>

              {/* Consultations */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Consultas Disponíveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {['serasa', 'scr', 'smart'].map(p => {
                      const has = !!(session.client_consultations as any)?.[p];
                      return (
                        <Badge key={p} variant="outline" className={`text-xs ${has ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted/50'}`}>
                          {p.toUpperCase()} {has ? '✓' : '—'}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───

function formatInitialAnalysis(analysis: any): string {
  if (!analysis) return 'Análise não disponível.';

  let text = '';

  // Decision + Risk (compact header)
  const decMap: Record<string, string> = { APROVAR: '✅ APROVAR', APROVAR_COM_RESSALVAS: '⚠️ APROVAR COM RESSALVAS', REPROVAR: '❌ REPROVAR' };
  text += `**${decMap[analysis.decisao] || analysis.decisao}** · Risco **${analysis.riscoGeral}**\n\n`;

  // Parecer (short)
  if (analysis.parecer) {
    text += `> ${analysis.parecer}\n\n`;
  }

  // Metrics (if available)
  const det = analysis.blocos?.titulosLastro?.detalhes;
  if (det) {
    const metrics: string[] = [];
    if (det.valorTotal) metrics.push(`**Valor:** ${det.valorTotal}`);
    if (det.quantidadeTitulos) metrics.push(`**Qtd:** ${det.quantidadeTitulos}`);
    if (det.ticketMedio) metrics.push(`**Ticket médio:** ${det.ticketMedio}`);
    if (det.prazoMedio) metrics.push(`**Prazo:** ${det.prazoMedio}`);
    if (metrics.length > 0) {
      text += metrics.join(' · ') + '\n\n';
    }
  }

  // Key points (bullets only)
  if (analysis.pontosChave) {
    text += `**Pontos-chave:**\n`;
    if (analysis.pontosChave.cedente) text += `- **Cedente:** ${analysis.pontosChave.cedente}\n`;
    if (analysis.pontosChave.sacado) text += `- **Sacado:** ${analysis.pontosChave.sacado}\n`;
    if (analysis.pontosChave.relacao) text += `- **Relação:** ${analysis.pontosChave.relacao}\n`;
    if (analysis.pontosChave.titulos) text += `- **Títulos:** ${analysis.pontosChave.titulos}\n`;
    text += '\n';
  }

  // Alerts (only if relevant)
  const allAlerts: string[] = [];
  if (analysis.pontosChave?.alertas && analysis.pontosChave.alertas !== 'Sem alertas relevantes.') {
    allAlerts.push(analysis.pontosChave.alertas);
  }
  ['cedente', 'sacado', 'relacaoCedenteSacado', 'titulosLastro'].forEach(k => {
    const alertas = analysis.blocos?.[k]?.alertas;
    if (alertas?.length > 0) allAlerts.push(...alertas);
  });
  if (allAlerts.length > 0) {
    text += `**⚠️ Alertas:**\n`;
    [...new Set(allAlerts)].forEach(a => { text += `- ${a}\n`; });
    text += '\n';
  }

  // Ressalvas (numbered, only if relevant)
  if (analysis.ressalvas?.length > 0 && analysis.ressalvas[0] !== 'Sem ressalvas relevantes.') {
    text += `**Ressalvas:**\n`;
    analysis.ressalvas.forEach((r: string, i: number) => { text += `${i + 1}. ${r}\n`; });
    text += '\n';
  }

  text += '---\n*Pergunte para aprofundar qualquer ponto ou forneça mais informações.*';

  return text;
}
