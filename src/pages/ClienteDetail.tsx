import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, FileText, Loader2, User, MapPin, Shield, Clock, Phone, Mail, RefreshCw } from 'lucide-react';
import { PlatformBadge } from '@/components/ui/PlatformBadge';
import logoSerasa from '@/assets/logo-serasa.png';
import logoHbi from '@/assets/logo-hbi.png';
import logoAgrisk from '@/assets/logo-agrisk.png';
import logoSmart from '@/assets/logo-smart.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Format seguro: nunca lança exceção (evita tela branca por data inválida)
function safeFormat(value: unknown, fmt: string): string {
  try {
    if (!value) return '—';
    const d = new Date(value as string);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt, { locale: ptBR });
  } catch {
    return '—';
  }
}
import { SCRDetailView } from '@/components/analise-operacao/SCRDetailView';
import { SerasaDetailView } from '@/components/analise-operacao/serasa/SerasaDetailView';
import { ConsultaModal } from '@/components/clientes/ConsultaModal';
import { ConsultaClienteDetailView } from '@/components/clientes/ConsultaClienteDetailView';
import { CedenteInfoPanel } from '@/components/consulta/CedenteInfoPanel';
import { SacadoSmartView } from '@/components/clientes/SacadoSmartView';

import { ClienteCreditoConsolidadoCard } from '@/components/clientes/ClienteCreditoConsolidadoCard';
import { ClienteAICompilationCard } from '@/components/clientes/ClienteAICompilationCard';
import { ClienteProspectCRMButton } from '@/components/clientes/ClienteProspectCRMButton';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';
import { PageLoadingSkeleton } from '@/components/ui/PageLoadingSkeleton';

interface ClientRecord {
  id: string;
  cpf_cnpj: string;
  name: string | null;
  agrisk_client_id: string | null;
  basic_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  cnpj: string;
  entity_name: string | null;
  consulta_label: string;
  consulta_type: string;
  platform: string;
  result_data: Record<string, unknown> | null;
  created_at: string;
  status: string;
  consulted_by_name: string | null;
  isAggregated?: boolean;
  timeline?: HistoryEntry[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getAgriskPayload(entry: HistoryEntry): Record<string, unknown> {
  if (!entry.result_data || !isPlainObject(entry.result_data)) return {};
  const data = entry.result_data as Record<string, unknown>;
  if (isPlainObject(data.details)) return data.details;
  return data;
}

function buildAgriskOverviewEntry(entries: HistoryEntry[]): HistoryEntry | null {
  const agriskEntries = entries
    .filter((entry) => entry.platform === 'agrisk')
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  if (agriskEntries.length === 0) return null;

  // Heurística: detecta payloads "vazios" (sem items/details/properties) para preferir uma execução anterior populada
  const isEmptyAgriskPayload = (entry: HistoryEntry): boolean => {
    const payload: any = getAgriskPayload(entry);
    if (!payload || typeof payload !== 'object') return true;
    const root: any = payload.result || payload.details || payload;
    const itemsLen = Array.isArray(root?.items) ? root.items.length : 0;
    const detailsLen = Array.isArray(root?.details) ? root.details.length : 0;
    const props = Number(root?.properties ?? 0);
    return itemsLen === 0 && detailsLen === 0 && props === 0;
  };

  const latestByType = new Map<string, HistoryEntry>();
  agriskEntries.forEach((entry) => {
    const existing = latestByType.get(entry.consulta_type);
    if (!existing) {
      latestByType.set(entry.consulta_type, entry);
      return;
    }
    // Se a atual armazenada está vazia e a nova tem dados, substitui (mesmo sendo mais antiga)
    if (isEmptyAgriskPayload(existing) && !isEmptyAgriskPayload(entry)) {
      latestByType.set(entry.consulta_type, entry);
    }
  });

  const consultaClienteEntry = latestByType.get('consulta_cliente');
  const consultaClientePayload = consultaClienteEntry ? getAgriskPayload(consultaClienteEntry) : {};
  const combinedDetails: Record<string, unknown> = isPlainObject(consultaClientePayload)
    ? { ...consultaClientePayload }
    : {};

  latestByType.forEach((entry, type) => {
    const payload = getAgriskPayload(entry);

    switch (type) {
      case 'consulta_cliente':
        Object.assign(combinedDetails, payload);
        break;
      case 'restritivos':
        combinedDetails.restritivos = (payload as any).restritivos || payload;
        if ((payload as any).bvs) combinedDetails.bvs = (payload as any).bvs;
        if ((payload as any).quod) combinedDetails.quod = (payload as any).quod;
        break;
      case 'endividamento':
        combinedDetails.scr = (payload as any).scr || payload;
        break;
      case 'cpr':
        combinedDetails.cpr = (payload as any).cpr || payload;
        break;
      case 'imoveis_simples':
        if ((payload as any).rural) combinedDetails.rural = (payload as any).rural;
        if ((payload as any).urban) combinedDetails.urban = (payload as any).urban;
        if ((payload as any).ruralDetails) combinedDetails.ruralDetails = (payload as any).ruralDetails;
        break;
      case 'imoveis_car':
        combinedDetails.imoveis_car = (payload as any).imoveis_car || payload;
        break;
      case 'patrimonio_veicular': {
        // Payload veicular vem como { result: {items,...}, details: {items,...} } ou já normalizado.
        const veicularRaw: any = (payload as any);
        const veicularPayload =
          veicularRaw?.patrimonio_veicular ||
          veicularRaw?.vehicleAssets ||
          veicularRaw?.veicular ||
          // Caso típico: o próprio payload já é { items: [...] } ou { result: {items}, details: {items} }
          (Array.isArray(veicularRaw?.items) ? veicularRaw : null) ||
          (isPlainObject(veicularRaw?.result) && Array.isArray((veicularRaw.result as any).items) ? veicularRaw.result : null) ||
          veicularRaw;
        combinedDetails.patrimonio_veicular = veicularPayload;
        // Espelha em chaves reconhecidas pelo normalizer da view agregada
        combinedDetails.vehicleAssets = veicularPayload;
        break;
      }
      default:
        break;
    }
  });

  const latestEntry = agriskEntries[0];
  return {
    ...latestEntry,
    consulta_label: 'Painel AgRisk',
    consulta_type: 'agrisk_overview',
    result_data: {
      details: combinedDetails,
    },
    isAggregated: true,
    timeline: agriskEntries,
  };
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function normalizeDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function formatPhoneDisplay(phone: unknown, areaCode?: unknown): string {
  const rawValue = typeof phone === 'string' ? phone : String(phone ?? '');
  const ddd = normalizeDigits(areaCode);
  let digits = normalizeDigits(phone);

  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('55')) digits = digits.slice(2);

  if ((digits.length === 8 || digits.length === 9) && ddd.length === 2) {
    digits = `${ddd}${digits}`;
  }

  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0,5)}-${digits.slice(5)}`;
  if (digits.length === 8) return `${digits.slice(0,4)}-${digits.slice(4)}`;

  return rawValue || '—';
}

function calcAge(birthDate: string): number | null {
  try {
    const parts = birthDate.includes('/') ? birthDate.split('/') : null;
    let date: Date;
    if (parts && parts.length === 3) {
      date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    } else {
      date = new Date(birthDate);
    }
    if (isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  } catch { return null; }
}

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [refreshingAgrisk, setRefreshingAgrisk] = useState(false);

  const openAgriskOverview = useCallback(async (cpfCnpj: string) => {
    const { data } = await supabase
      .from('consulta_history')
      .select('*')
      .eq('cnpj', cpfCnpj)
      .eq('platform', 'agrisk')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(200);

    const overviewEntry = buildAgriskOverviewEntry((data || []) as unknown as HistoryEntry[]);
    if (overviewEntry) {
      setDetailEntry(overviewEntry);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: clientRes } = await supabase.from('consulta_clients').select('*').eq('id', id).single();
    if (clientRes) {
      const c = clientRes as unknown as ClientRecord;
      setClient(c);
      const { data: hData } = await supabase
        .from('consulta_history')
        .select('*')
        .eq('cnpj', c.cpf_cnpj)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(200);
      if (hData) setHistory(hData as unknown as HistoryEntry[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConsultaDone = useCallback(async () => {
    setConsultaOpen(false);
    // Reload data and auto-show the most recent result
    if (!client) return;
    const { data: latest } = await supabase
      .from('consulta_history')
      .select('*')
      .eq('cnpj', client.cpf_cnpj)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (latest) {
      const latestEntry = latest as unknown as HistoryEntry;
      if (latestEntry.platform === 'agrisk') {
        await openAgriskOverview(client.cpf_cnpj);
      } else {
        setDetailEntry(latestEntry);
      }
    }
    loadData();
  }, [client, loadData, openAgriskOverview]);

  // Re-executa todas as consultas AgRisk já realizadas para este cliente,
  // grava novos resultados em consulta_history e recarrega.
  const handleRefreshAgrisk = useCallback(async () => {
    if (!client || !user) return;

    // Coleta os tipos AgRisk únicos já consultados (mesmos que aparecem no Painel AgRisk)
    const agriskTypes = Array.from(
      new Set(
        history
          .filter((h) => h.platform === 'agrisk' && h.consulta_type)
          .map((h) => h.consulta_type),
      ),
    );

    if (agriskTypes.length === 0) {
      toast.info('Nenhuma consulta AgRisk encontrada para atualizar.');
      return;
    }

    setRefreshingAgrisk(true);
    const t = toast.loading(`Atualizando ${agriskTypes.length} consulta(s) AgRisk...`);

    let successCount = 0;
    const errors: string[] = [];

    for (const consultaType of agriskTypes) {
      try {
        const { data, error } = await supabase.functions.invoke('agrisk-query', {
          body: { taxId: client.cpf_cnpj.replace(/\D/g, ''), consultaType },
        });

        if (error || data?.ok === false || data?.error) {
          throw new Error(data?.error || error?.message || 'Falha na consulta');
        }

        const payload = data?.data || data;
        const label =
          history.find((h) => h.consulta_type === consultaType)?.consulta_label || consultaType;

        await supabase.from('consulta_history').insert({
          user_id: user.id,
          cnpj: client.cpf_cnpj,
          platform: 'agrisk',
          consulta_type: consultaType,
          consulta_label: label,
          result_data: payload as any,
          status: 'success',
          entity_name: client.name,
          consulted_by_name: user.email || null,
        } as any);

        successCount += 1;
      } catch (err: any) {
        const label =
          history.find((h) => h.consulta_type === consultaType)?.consulta_label || consultaType;
        errors.push(`${label}: ${err?.message || 'erro desconhecido'}`);
      }
    }

    toast.dismiss(t);
    if (successCount > 0 && errors.length === 0) {
      toast.success(`${successCount} consulta(s) AgRisk atualizada(s).`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} atualizada(s), ${errors.length} com erro.`, {
        description: errors.slice(0, 3).join(' · '),
      });
    } else {
      toast.error('Nenhuma consulta AgRisk pôde ser atualizada.', {
        description: errors.slice(0, 3).join(' · '),
      });
    }

    await loadData();
    setRefreshingAgrisk(false);
  }, [client, user, history, loadData]);

  const [reopeningScr, setReopeningScr] = useState(false);
  const [reopeningSerasa, setReopeningSerasa] = useState(false);

  // Classifica um relatório SCR em: 'ok' (tem dados), 'sem-dados-legitimo' (CNPJ realmente sem operações)
  // ou 'erro-tecnico' (timeout, payload truncado, código 52, sem estrutura esperada)
  const classifyScrPayload = useCallback((entry: HistoryEntry): 'ok' | 'sem-dados-legitimo' | 'erro-tecnico' => {
    const raw: any = entry.result_data;
    if (!raw || typeof raw !== 'object') return 'erro-tecnico';

    const root: any = raw.data?.response || raw.response || raw.data || raw;
    if (!root || typeof root !== 'object') return 'erro-tecnico';

    // Código 52 = data-base indisponível (erro técnico recuperável reconsultando)
    const code = root.codigo ?? root.code;
    if (code === '52' || code === 52) return 'erro-tecnico';

    // Tem dados reais (operações, limites, etc.)
    const dataCandidates = [
      root.operacoes, root.operations,
      root.modalidades, root.modalities,
      root.limites, root.limits, root.limitesCredito,
      root.detalhamento, root.carteira, root.carteiraAtiva,
      root.historico, root.history,
    ];
    const hasData = dataCandidates.some((c) => {
      if (!c) return false;
      if (Array.isArray(c)) return c.length > 0;
      if (typeof c === 'object') return Object.keys(c).length > 0;
      return false;
    });
    if (hasData) return 'ok';

    // Sem dados, mas a API retornou estrutura coerente (resposta válida = CNPJ sem operações no SCR)
    // Indicadores de resposta legítima: presença de campos meta como 'cliente', 'documento', 'mensagem', 'dataBase', 'totalOperacoes: 0'
    const metaIndicators = [
      root.cliente, root.documento, root.cnpj, root.cpf,
      root.mensagem, root.message, root.descricao,
      root.dataBase, root.dataConsulta,
      root.totalOperacoes,
    ];
    const hasMeta = metaIndicators.some((v) => v !== undefined && v !== null);
    const payloadSize = JSON.stringify(root).length;

    // Resposta estruturada e razoavelmente populada => sem-dados é legítimo
    if (hasMeta && payloadSize > 200) return 'sem-dados-legitimo';

    // Caso contrário, payload truncado/vazio => erro técnico
    return 'erro-tecnico';
  }, []);

  // Classifica um relatório Serasa: 'ok', 'sem-dados-legitimo' (NADA CONSTA legítimo) ou 'erro-tecnico'
  const classifySerasaPayload = useCallback((entry: HistoryEntry): 'ok' | 'sem-dados-legitimo' | 'erro-tecnico' => {
    const raw: any = entry.result_data;
    if (!raw || typeof raw !== 'object') return 'erro-tecnico';

    const root: any = raw.data || raw;
    if (!root || typeof root !== 'object') return 'erro-tecnico';

    // Tem dados reais
    const dataCandidates = [
      root.reports, root.report,
      root.advancedCommercialPaymentHistory,
      root.negativeData, root.pendencies, root.pendencias,
      root.protests, root.protestos,
      root.scoreData, root.score,
      root.companyData, root.personData,
      root.queryInfo, root.basicData,
    ];
    const hasData = dataCandidates.some((c) => {
      if (!c) return false;
      if (Array.isArray(c)) return c.length > 0;
      if (typeof c === 'object') return Object.keys(c).length > 0;
      return false;
    });
    if (hasData) return 'ok';

    // "NADA CONSTA" legítimo costuma vir com um envelope de resposta válida
    const metaIndicators = [
      root.optionalFeatures, root.consultaInfo, root.consulta,
      root.documentNumber, root.document, root.cnpj, root.cpf,
      root.message, root.messages, root.status,
      root.reportName, root.consultaTimestamp,
    ];
    const hasMeta = metaIndicators.some((v) => v !== undefined && v !== null);
    const payloadSize = JSON.stringify(root).length;

    if (hasMeta && payloadSize > 200) return 'sem-dados-legitimo';

    return 'erro-tecnico';
  }, []);

  // Refaz a consulta SCR via API e ATUALIZA o registro existente (não cria um novo) em caso de erro técnico anterior
  const handleReopenSCR = useCallback(async () => {
    const scrEntries = history
      .filter((h) => h.platform === 'scr' && h.status === 'success' && h.result_data)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    if (scrEntries.length === 0) {
      toast.info('Nenhum relatório SCR salvo para este cliente.');
      return;
    }

    const latest = scrEntries[0];
    const classification = classifyScrPayload(latest);

    if (classification !== 'erro-tecnico') {
      // Resultado válido (com dados ou sem dados legítimo) — apenas reabre, sem chamar a API
      setDetailEntry(latest);
      return;
    }

    // Detectou erro técnico — refaz a consulta e SUBSTITUI o registro zerado
    if (!client) return;
    setReopeningScr(true);
    const t = toast.loading('Última consulta SCR veio com erro técnico. Refazendo automaticamente...');
    try {
      const cnpj = client.cpf_cnpj.replace(/\D/g, '');
      const { data, error } = await supabase.functions.invoke('hbi-scr', { body: { cnpj } });
      if (error || data?.ok === false || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha ao reconsultar SCR');
      }
      const newPayload = data?.data || data;

      // Substitui o resultado zerado em vez de criar um novo registro de histórico
      const { error: upErr } = await supabase
        .from('consulta_history')
        .update({ result_data: newPayload as any })
        .eq('id', latest.id);

      if (upErr) throw upErr;

      toast.dismiss(t);
      toast.success('Relatório SCR atualizado com os dados corretos.');

      // Atualiza estado local imediatamente
      const refreshed: HistoryEntry = { ...latest, result_data: newPayload as any };
      setHistory((prev) => prev.map((h) => (h.id === latest.id ? refreshed : h)));
      setDetailEntry(refreshed);
    } catch (err: any) {
      toast.dismiss(t);
      toast.error('Não foi possível refazer a consulta SCR.', {
        description: err?.message || 'Erro desconhecido',
      });
      // Mostra o que tinha mesmo assim
      setDetailEntry(latest);
    } finally {
      setReopeningScr(false);
    }
  }, [history, classifyScrPayload, client]);

  // Refaz a consulta Serasa via API e ATUALIZA o registro existente em caso de erro técnico anterior
  const handleReopenSerasa = useCallback(async () => {
    const serasaEntries = history
      .filter((h) => h.platform === 'serasa' && h.status === 'success' && h.result_data)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    if (serasaEntries.length === 0) {
      toast.info('Nenhum relatório Serasa salvo para este cliente.');
      return;
    }

    const latest = serasaEntries[0];
    const classification = classifySerasaPayload(latest);

    if (classification !== 'erro-tecnico') {
      setDetailEntry(latest);
      return;
    }

    if (!client) return;
    setReopeningSerasa(true);
    const t = toast.loading('Última consulta Serasa veio com erro técnico. Refazendo automaticamente...');
    try {
      const cnpj = client.cpf_cnpj.replace(/\D/g, '');
      const consultaId = latest.consulta_type;
      const { data, error } = await supabase.functions.invoke('serasa-report', {
        body: { document: cnpj, consultaId },
      });
      if (error || data?.ok === false || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha ao reconsultar Serasa');
      }
      const newPayload = data?.data || data;

      const { error: upErr } = await supabase
        .from('consulta_history')
        .update({ result_data: newPayload as any })
        .eq('id', latest.id);

      if (upErr) throw upErr;

      toast.dismiss(t);
      toast.success('Relatório Serasa atualizado com os dados corretos.');

      const refreshed: HistoryEntry = { ...latest, result_data: newPayload as any };
      setHistory((prev) => prev.map((h) => (h.id === latest.id ? refreshed : h)));
      setDetailEntry(refreshed);
    } catch (err: any) {
      toast.dismiss(t);
      toast.error('Não foi possível refazer a consulta Serasa.', {
        description: err?.message || 'Erro desconhecido',
      });
      setDetailEntry(latest);
    } finally {
      setReopeningSerasa(false);
    }
  }, [history, classifySerasaPayload, client]);

  const hasSavedScr = useMemo(
    () => history.some((h) => h.platform === 'scr' && h.status === 'success' && h.result_data),
    [history],
  );
  const hasSavedSerasa = useMemo(
    () => history.some((h) => h.platform === 'serasa' && h.status === 'success' && h.result_data),
    [history],
  );

  const agriskOverview = useMemo(() => buildAgriskOverviewEntry(history), [history]);
  const agriskSnapshot = agriskOverview ? getAgriskPayload(agriskOverview) : {};
  const agriskClientData = isPlainObject((agriskSnapshot as any).clientData) ? ((agriskSnapshot as any).clientData as any) : {};
  const agriskContactsData = isPlainObject((agriskSnapshot as any).contacts) ? ((agriskSnapshot as any).contacts as any) : {};

  if (loading) {
    return <PageLoadingSkeleton message="Carregando cliente..." />;
  }

  if (!client) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-center text-muted-foreground mt-8">Cliente não encontrado.</p>
      </div>
    );
  }

  const rawBd = client.basic_data as any || {};
  // Support both flat structure and nested { clientData, contacts } from register-client action
  const bd = Object.keys(agriskClientData).length > 0 ? agriskClientData : (rawBd.clientData || rawBd);
  const isCpf = client.cpf_cnpj.length === 11;
  const birthDate = bd.birthDate || bd.dataNascimento || bd.nascimento || null;
  const age = bd.age || (birthDate ? calcAge(birthDate) : null);
  const gender = bd.gender || bd.genero || bd.sexo || null;
  const maritalStatus = bd.maritalStatus || bd.estadoCivil || null;
  const motherName = bd.motherName || bd.nomeMae || null;
  const fatherName = bd.fatherName || bd.nomePai || null;
  const taxIdStatus = bd.taxIdStatus || null;
  const hasObitIndication = bd.hasObitIndication ?? null;

  // Validations — build from clientData fields if no explicit validations object
  const rawValidations = bd.validations || bd.validacoes || {};
  const validations = Object.keys(rawValidations).length > 0
    ? rawValidations
    : {
        ...(taxIdStatus ? { receitaFederal: taxIdStatus } : {}),
        ...(hasObitIndication !== null ? { obito: hasObitIndication } : {}),
      };

  // Addresses, phones, emails — check contacts sub-object too
  const contactsData = Object.keys(agriskContactsData).length > 0 ? agriskContactsData : (rawBd.contacts || {});
  const addresses: any[] = bd.addresses || bd.enderecos || contactsData.addresses || [];
  const phones: any[] = bd.phones || bd.telefones || contactsData.phones || [];
  const emails: any[] = bd.emails || contactsData.emails || [];

  const lastUpdate = agriskOverview?.created_at || client.updated_at || client.created_at;

  // When a detail entry is selected, show it inline
  if (detailEntry) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setDetailEntry(null)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar ao cliente
            </Button>
            <div className="flex items-center gap-2">
              <PlatformBadge platform={detailEntry.platform} />
              <span className="text-xs text-muted-foreground">
                {safeFormat(detailEntry.created_at, "dd/MM/yyyy 'às' HH:mm")}
              </span>
            </div>
          </div>
        </div>
        <div className={`p-6 max-w-7xl mx-auto ${detailEntry.platform === 'agrisk' && detailEntry.isAggregated ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-6' : ''}`}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailEntry.consulta_label}
            </h2>
            {detailEntry.result_data && (
              detailEntry.consulta_type === 'scr' ? (
                <SCRDetailView data={detailEntry.result_data} />
              ) : detailEntry.platform === 'serasa' || detailEntry.consulta_type.startsWith('serasa') ? (
                <SerasaDetailView data={detailEntry.result_data} document={detailEntry.cnpj} consultaId={detailEntry.consulta_type} />
              ) : detailEntry.platform === 'agrisk' ? (
                <ConsultaClienteDetailView
                  data={detailEntry.result_data as Record<string, any>}
                  agriskClientId={client.agrisk_client_id}
                  consultaType={detailEntry.isAggregated ? null : detailEntry.consulta_type}
                />
              ) : detailEntry.platform === 'smart' ? (
                ((detailEntry.result_data as any)?._smartView === 'sacado') ? (
                  <SacadoSmartView
                    data={detailEntry.result_data as any}
                    cpfCnpj={detailEntry.cnpj}
                    nome={detailEntry.entity_name}
                  />
                ) : (
                  <CedenteInfoPanel data={detailEntry.result_data as any} />
                )
              ) : (
                <pre className="text-xs text-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {JSON.stringify(detailEntry.result_data, null, 2)}
                </pre>
              )
            )}
          </div>

          {detailEntry.platform === 'agrisk' && detailEntry.isAggregated && detailEntry.timeline && detailEntry.timeline.length > 0 && (
            <div className="mt-6 xl:mt-10">
              <AgriskUpdateTimeline timeline={detailEntry.timeline} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // When filterPlatform is set, show filtered history inline
  if (filterPlatform) {
    const filtered = history.filter(h => h.platform === filterPlatform);
    const platformLabels: Record<string, string> = { serasa: 'Serasa', scr: 'SCR (HBI)', agrisk: 'AgRisk', smart: 'Smart' };
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setFilterPlatform(null)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar ao cliente
            </Button>
            <div className="flex items-center gap-2">
              <PlatformBadge platform={filterPlatform} />
              <span className="text-xs text-muted-foreground">{filtered.length} consulta(s)</span>
            </div>
          </div>
        </div>
        <div className="p-6 max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Histórico {platformLabels[filterPlatform] || filterPlatform}
          </h2>
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma consulta {platformLabels[filterPlatform]} realizada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => (
                <Card
                  key={entry.id}
                  className="hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setDetailEntry(entry)}
                >
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.consulta_label}</p>
                      <p className="text-xs text-muted-foreground">
                        {safeFormat(entry.created_at, "dd/MM/yyyy 'às' HH:mm")}
                        {entry.consulted_by_name && <> · <span className="italic">por {entry.consulted_by_name}</span></>}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailEntry(entry); }}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>
           <Button variant="default" onClick={() => setConsultaOpen(true)}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Consultar
            </Button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar */}
          <div className="lg:w-[340px] shrink-0 space-y-4">
            {/* Update badge */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                Última Atualização {safeFormat(lastUpdate, 'dd/MM/yyyy')}
              </Badge>
            </div>

            <ClienteProspectCRMCard
              client={{
                id: client.id,
                cpf_cnpj: client.cpf_cnpj,
                name: client.name,
                basic_data: client.basic_data,
              }}
              history={history}
            />


            {/* Informações Cadastrais */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Informações Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nome</p>
                  <p className="text-sm font-semibold text-foreground">{client.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{isCpf ? 'CPF' : 'CNPJ'}</p>
                  <p className="text-sm text-foreground">{formatDoc(client.cpf_cnpj)}</p>
                </div>
                {(birthDate || age || gender) && (
                  <div className="grid grid-cols-3 gap-3">
                    {birthDate && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nascimento</p>
                        <p className="text-sm text-foreground">{(() => { try { return format(new Date(birthDate), 'dd/MM/yyyy'); } catch { return birthDate; } })()}</p>
                      </div>
                    )}
                    {age !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Idade</p>
                        <p className="text-sm text-foreground">{age} Anos</p>
                      </div>
                    )}
                    {gender && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Gênero</p>
                        <p className="text-sm text-foreground">{gender}</p>
                      </div>
                    )}
                  </div>
                )}
                {maritalStatus && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Estado Civil</p>
                    <p className="text-sm text-foreground">{maritalStatus}</p>
                  </div>
                )}
                {motherName && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nome da Mãe</p>
                    <p className="text-sm text-foreground">{motherName}</p>
                  </div>
                )}
                {fatherName && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Nome do Pai</p>
                    <p className="text-sm text-foreground">{fatherName}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Validações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Validações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(validations).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {validations.receitaFederal && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Receita Federal</p>
                        <p className="text-sm text-foreground">{validations.receitaFederal}</p>
                      </div>
                    )}
                    {validations.obito !== undefined && validations.obito !== null && (
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Óbito</p>
                        <p className="text-sm text-foreground">{typeof validations.obito === 'boolean' ? (validations.obito ? 'Positivo' : 'Negativo') : String(validations.obito)}</p>
                      </div>
                    )}
                    {Object.entries(validations).filter(([k]) => k !== 'receitaFederal' && k !== 'receita' && k !== 'obito' && k !== 'death').map(([key, val]) => (
                      <div key={key}>
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{formatLabel(key)}</p>
                        <p className="text-sm text-foreground">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Faça uma consulta completa para ver as validações.</p>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 space-y-4">
            <Tabs defaultValue="enderecos" className="w-full">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="enderecos" className="text-xs gap-1.5">
                  Endereços <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{addresses.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="telefones" className="text-xs gap-1.5">
                  Telefones <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{phones.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="emails" className="text-xs gap-1.5">
                  Emails <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{emails.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Endereços */}
              <TabsContent value="enderecos">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Endereços
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {addresses.length === 0 ? (
                      <div className="text-center py-8 space-y-1">
                        <p className="text-sm text-muted-foreground">Nenhum endereço disponível.</p>
                        <p className="text-xs text-muted-foreground/70">
                          Estes dados são preenchidos pela <span className="font-medium text-primary">Consulta Cliente</span> (AgRisk).
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Logradouro</TableHead>
                              <TableHead className="w-[100px]">Tipo</TableHead>
                              <TableHead className="w-[90px] text-center">Passagem</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                          {addresses.map((addr: any, i: number) => {
                              const logradouro = [
                                addr.address || addr.logradouro || addr.street,
                                addr.number || addr.numero,
                                addr.complement || addr.complemento,
                                addr.neighborhood || addr.bairro,
                                addr.city || addr.cidade,
                                addr.state || addr.estado,
                                addr.zip_code || addr.zipCode || addr.cep
                              ].filter(Boolean).join(', ') || '—';
                              const addrTypeMap: Record<string, string> = {
                                'WORK': 'Trabalho', 'HOME': 'Residencial', 'COMMERCIAL': 'Comercial',
                                'work': 'Trabalho', 'home': 'Residencial', 'commercial': 'Comercial',
                                'RURAL': 'Rural', 'rural': 'Rural',
                              };
                              const rawAddrType = addr.address_type || addr.type || addr.tipo || '';
                              const addrType = addrTypeMap[rawAddrType] || rawAddrType || '—';
                              const info = addr.information || {};
                              const totalPassages = info.total_passages ?? addr.passagem ?? addr.count ?? '—';
                              const lastPassage = info.last_passage || addr.ultimaPassagem || addr.lastSeen || addr.updatedAt || null;
                              const lastPassageFormatted = lastPassage
                                ? (() => { try { return format(new Date(lastPassage), 'dd/MM/yyyy'); } catch { return lastPassage; } })()
                                : '—';
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{logradouro}</TableCell>
                                  <TableCell className="text-xs font-medium">{addrType}</TableCell>
                                  <TableCell className="text-xs text-center">{totalPassages}</TableCell>
                                  <TableCell className="text-xs text-right">{lastPassageFormatted}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Telefones */}
              <TabsContent value="telefones">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Telefones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {phones.length === 0 ? (
                      <div className="text-center py-8 space-y-1">
                        <p className="text-sm text-muted-foreground">Nenhum telefone disponível.</p>
                        <p className="text-xs text-muted-foreground/70">
                          Estes dados são preenchidos pela <span className="font-medium text-primary">Consulta Cliente</span> (AgRisk).
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Número</TableHead>
                              <TableHead className="w-[100px]">Tipo</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {phones.map((ph: any, i: number) => {
                              const phoneCore = ph.phone_number || ph.phoneNumber || ph.number || ph.numero || ph.phone || ph.telefone || (typeof ph === 'string' ? ph : '');
                              const areaCode = ph.area_code || ph.areaCode || ph.ddd;
                              const formattedNum = formatPhoneDisplay(phoneCore, areaCode);
                              const typeMap: Record<string, string> = {
                                'MOBILE': 'Celular', 'LANDLINE': 'Fixo', 'WORK': 'Trabalho',
                                'HOME': 'Residencial', 'FAX': 'Fax', 'COMMERCIAL': 'Comercial',
                                'mobile': 'Celular', 'landline': 'Fixo', 'work': 'Trabalho',
                                'home': 'Residencial', 'fax': 'Fax', 'commercial': 'Comercial',
                              };
                              const rawType = ph.phone_type || ph.type || ph.tipo || '';
                              const phType = typeMap[rawType] || rawType || '—';
                              const phInfo = ph.information || {};
                              const lastSeen = phInfo.last_passage || ph.ultimaPassagem || ph.lastSeen || null;
                              const lastSeenFmt = lastSeen
                                ? (() => { try { return format(new Date(lastSeen), 'dd/MM/yyyy'); } catch { return lastSeen; } })()
                                : '—';
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs font-mono">{formattedNum || '—'}</TableCell>
                                  <TableCell className="text-xs">{phType}</TableCell>
                                  <TableCell className="text-xs text-right">{lastSeenFmt}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Emails */}
              <TabsContent value="emails">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      Emails
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {emails.length === 0 ? (
                      <div className="text-center py-8 space-y-1">
                        <p className="text-sm text-muted-foreground">Nenhum e-mail disponível.</p>
                        <p className="text-xs text-muted-foreground/70">
                          Estes dados são preenchidos pela <span className="font-medium text-primary">Consulta Cliente</span> (AgRisk).
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                             <TableRow>
                              <TableHead>E-mail</TableHead>
                              <TableHead className="w-[100px]">Tipo</TableHead>
                              <TableHead className="w-[120px] text-right">Última Passagem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {emails.map((em: any, i: number) => {
                              const emailAddr = em.email || em.address || em.email_address || (typeof em === 'string' ? em : '—');
                              const emInfo = em.information || {};
                              const emailTypeMap: Record<string, string> = {
                                'PERSONAL': 'Pessoal', 'WORK': 'Trabalho', 'COMMERCIAL': 'Comercial',
                                'personal': 'Pessoal', 'work': 'Trabalho', 'commercial': 'Comercial',
                              };
                              const rawEType = em.email_type || em.type || em.tipo || '';
                              const eType = emailTypeMap[rawEType] || rawEType || '—';
                              const lastSeen = emInfo.last_passage || em.ultimaPassagem || em.lastSeen || null;
                              const lastSeenFmt = lastSeen
                                ? (() => { try { return format(new Date(lastSeen), 'dd/MM/yyyy'); } catch { return lastSeen; } })()
                                : '—';
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{emailAddr}</TableCell>
                                  <TableCell className="text-xs">{eType}</TableCell>
                                  <TableCell className="text-xs text-right">{lastSeenFmt}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </div>
        </div>

        {/* Platform history cards - full width */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {(['serasa', 'scr', 'agrisk', 'smart'] as const).map(platform => {
            const count = history.filter(h => h.platform === platform).length;
            const logos: Record<string, { src?: string; label: string; fallback?: string }> = {
              serasa: { src: logoSerasa, label: 'Serasa' },
              scr: { src: logoHbi, label: 'SCR (HBI)' },
              agrisk: { src: logoAgrisk, label: 'AgRisk' },
              smart: { src: logoSmart, label: 'Smart' },
            };
            const { src, label, fallback } = logos[platform];

            // Action button per platform (top-right corner)
            let action: { onClick: () => void; disabled: boolean; loading: boolean; label: string; title: string } | null = null;
            if (platform === 'agrisk') {
              action = {
                onClick: handleRefreshAgrisk,
                disabled: refreshingAgrisk || !agriskOverview,
                loading: refreshingAgrisk,
                label: refreshingAgrisk ? 'Atualizando...' : 'Atualizar',
                title: agriskOverview
                  ? 'Reexecuta as consultas AgRisk já feitas e atualiza os resultados'
                  : 'Nenhuma consulta AgRisk realizada ainda',
              };
            } else if (platform === 'scr') {
              action = {
                onClick: handleReopenSCR,
                disabled: !hasSavedScr || reopeningScr,
                loading: reopeningScr,
                label: reopeningScr ? 'Refazendo...' : 'Reabrir',
                title: hasSavedScr
                  ? 'Reabre o último relatório SCR. Se detectar erro técnico, refaz a consulta automaticamente.'
                  : 'Nenhum relatório SCR salvo',
              };
            } else if (platform === 'serasa') {
              action = {
                onClick: handleReopenSerasa,
                disabled: !hasSavedSerasa || reopeningSerasa,
                loading: reopeningSerasa,
                label: reopeningSerasa ? 'Refazendo...' : 'Reabrir',
                title: hasSavedSerasa
                  ? 'Reabre o último relatório Serasa. Se detectar erro técnico, refaz a consulta automaticamente.'
                  : 'Nenhum relatório Serasa salvo',
              };
            }

            const handleCardClick = () => {
              if (platform === 'agrisk') {
                if (agriskOverview) {
                  setDetailEntry(agriskOverview);
                } else {
                  setConsultaOpen(true);
                }
                return;
              }
              setFilterPlatform(platform);
            };

            return (
              <div key={platform} className="relative">
                {action && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 z-10 h-7 w-7 rounded-full border border-border bg-background shadow-sm hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      action!.onClick();
                    }}
                    disabled={action.disabled}
                    title={action.title}
                  >
                    {action.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <div
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
                  onClick={handleCardClick}
                >
                  {src ? (
                    <img src={src} alt={label} className="h-10 w-10 object-contain shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm font-semibold text-stone-700">
                      {fallback || label.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{count} consulta(s)</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        <ClienteCreditoConsolidadoCard
          client={client}
          history={history as unknown as { id: string; cnpj: string; entity_name: string | null; consulta_label: string; consulta_type: string; platform: string; result_data: Record<string, unknown> | null; created_at: string; status: string; }[]}
        />

        <ClienteAICompilationCard
          client={client}
          history={history as unknown as Parameters<typeof ClienteAICompilationCard>[0]['history']}
          agriskOverview={null}
        />

      </div>

      {/* Consulta Modal */}
      {consultaOpen && (
        <ConsultaModal
          cpfCnpj={client.cpf_cnpj}
          clientName={client.name}
          open={consultaOpen}
          onClose={() => setConsultaOpen(false)}
          onDone={handleConsultaDone}
        />
      )}
    </div>
  );
}

function AgriskUpdateTimeline({ timeline }: { timeline: HistoryEntry[] }) {
  const latestByType = new Map<string, HistoryEntry>();
  timeline.forEach((entry) => {
    if (!latestByType.has(entry.consulta_type)) {
      latestByType.set(entry.consulta_type, entry);
    }
  });

  const items = Array.from(latestByType.values());

  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Atualizacoes AgRisk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((entry) => (
          <div key={entry.consulta_type} className="relative pl-4">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs font-semibold text-foreground">{entry.consulta_label}</p>
            <p className="text-[11px] text-muted-foreground">
              {safeFormat(entry.created_at, "dd/MM/yyyy 'às' HH:mm")}
            </p>
            {entry.consulted_by_name && (
              <p className="text-[11px] text-muted-foreground">{entry.consulted_by_name}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}
