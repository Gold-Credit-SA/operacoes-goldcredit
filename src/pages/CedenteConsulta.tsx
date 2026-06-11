import { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { CedenteSearch } from '@/components/consulta/CedenteSearch';
import { CedenteInfoPanel } from '@/components/consulta/CedenteInfoPanel';
import { LoadingPlaceholder } from '@/components/consulta/LoadingPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface CedenteListItem {
  id: number;
  nome: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  gerente: string | null;
  operador: string | null;
  limite_global: number | null;
  risco_atual: number | null;
  saldo: number | null;
  bloqueado: string | null;
}

interface ComportamentoItem {
  valor: number;
  qtd: number;
  percentualValor: number;
  percentualQtd: number;
}

export interface CedenteDetail {
  cedente: {
    id: number;
    nome: string | null;
    cpf_cnpj: string | null;
    endereco: string | null;
    cep: string | null;
    cidade: string | null;
    uf: string | null;
    email: string | null;
    telefone: string | null;
    gerente: string | null;
    operador: string | null;
    captador: string | null;
    limite_global: number | null;
    risco_atual: number | null;
    saldo: number | null;
    bloqueado: string | null;
    data_cadastro: string | null;
    setor: string | null;
    grupo_economico: string | null;
  };
  resumo: {
    primeiraOperacao: string | null;
    ultimaOperacao: string | null;
    totalOperacoes: number;
    valorBrutoTotal: number;
    valorLiquidoTotal: number;
    receitaTotal: number;
    taxaMedia?: number;
  };
  resumoExpandido: {
    volumeOperado: number;
    prazoMedioOperacoes: number;
    prazoMedioTitulos90Dias: number;
    mediaPagoEmAtraso: number;
    valorMedioBorderos: number;
    valorMedioTitulos: number;
    receitaGerada: number;
    percentualProrrogacao: number;
    chqDevolvidosAberto: number;
    chqDevolvidosQuitado: number;
  };
  limites: {
    global: number;
    disponivel: number;
    risco: number;
    saldo: number;
  };
  confirmacao: {
    confirmado: { qtd: number; valor: number; percentual: number };
    parcial: { qtd: number; valor: number; percentual: number };
    pendente: { qtd: number; valor: number; percentual: number };
    semConfirmacao: { qtd: number; valor: number; percentual: number };
    total: { qtd: number; valor: number };
  };
  carteira: {
    total: number;
    vencidos: number;
    percentualVencido: number;
  };
  concentracaoSacados: Array<{
    cpf_cnpj: string;
    nome: string;
    risco: number;
    concentracao: number;
  }>;
  liquidez: {
    totalQuitados: number;
    valorQuitado: number;
    totalRecomprados: number;
    valorRecomprado: number;
    percentualPontual: number;
    percentualAtraso: number;
    percentualRecompra: number;
    percentualLiquidado: number;
  };
  comportamento90Dias: {
    pontual: ComportamentoItem;
    atraso5: ComportamentoItem;
    atraso15: ComportamentoItem;
    atraso30: ComportamentoItem;
    atrasoMais30: ComportamentoItem;
    recompra: ComportamentoItem;
    repasse: ComportamentoItem;
    cartorio: ComportamentoItem;
    totalPago: { valor: number; qtd: number };
    emAtraso: ComportamentoItem;
  };
  receitaMensal: Array<{
    mes: string;
    valor: number;
  }>;
  titulosAberto: Array<{
    id: number;
    documento: string | null;
    sacado: string | null;
    cpf_cnpj_sacado: string | null;
    valor: number | null;
    vencimento: string | null;
    situacao: string | null;
    conf: string | null;
    etapa: string | null;
  }>;
  titulosQuitados: Array<{
    id: number;
    numero: string | null;
    sacado: string | null;
    cpf_cnpj_sacado: string | null;
    valor_face: number | null;
    valor_liquidado: number | null;
    vencimento: string | null;
    quitacao: string | null;
    status: string | null;
    tipo_quitacao: string | null;
  }>;
  ultimasOperacoes: Array<{
    id: number;
    operacao: string | null;
    data: string | null;
    valor_bruto: number | null;
    valor_liquido: number | null;
    valor_taxa: number | null;
    prazo_medio?: number | null;
    etapa: string | null;
  }>;
  suspeitasFraude: Array<{
    id: number;
    sacado: string | null;
    cpf_cnpj_sacado: string | null;
    numero_documento: string | null;
    valor: number | null;
    vencimento: string | null;
    data_quitacao: string | null;
    criticas: string | null;
    banco_cobrador: string | null;
    agencia_cobradora: string | null;
    praca_pagamento: string | null;
    localidade_sacado: string | null;
  }>;
}

export default function CedenteConsulta() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preloadedCedente = location.state?.preloadedCedente as CedenteListItem | undefined;
  const [cedentes, setCedentes] = useState<CedenteListItem[]>([]);
  const [selectedCedente, setSelectedCedente] = useState<CedenteListItem | null>(preloadedCedente ?? null);
  const [cedenteDetail, setCedenteDetail] = useState<CedenteDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(preloadedCedente || searchParams.get('cpf_cnpj')));
  const [search, setSearch] = useState('');
  const [gerente, setGerente] = useState<string>('');
  const [gestores, setGestores] = useState<Array<{ gerente: string; total: number }>>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchCedentes = useCallback(async (searchTerm?: string, gerenteFilter?: string) => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-db', {
        body: { action: 'cedentes-list', filters: { search: searchTerm, gerente: gerenteFilter || undefined } }
      });

      if (error) throw error;
      if (data?.success) {
        setCedentes(data.data || []);
        return data.data || [];
      }
      return [];
    } catch (err) {
      console.error('Error fetching cedentes:', err);
      setCedentes([]);
      return [];
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('external-db', {
          body: { action: 'gestores-list' }
        });
        if (data?.success) setGestores(data.data || []);
      } catch (err) {
        console.error('Error fetching gestores:', err);
      }
    })();
  }, []);

  const fetchCedenteDetail = useCallback(async (cpf_cnpj: string) => {
    setIsLoadingDetail(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-db', {
        body: { action: 'cedente-info', filters: { cpf_cnpj } }
      });

      if (error) throw error;
      if (data?.success) {
        // Transformar dados do banco externo para o formato esperado
        const externalData = data.data;
        const cedente = externalData.cedente;
        const operacoes = externalData.operacoes || [];
        const titulosAberto = externalData.titulosAberto || [];
        const titulosQuitados = externalData.titulosQuitados || [];
        const receitas = externalData.receitas || [];
        const recomprados = externalData.recomprados || [];
        const suspeitaFraude = externalData.suspeitaFraude || [];
        const prorrogados = externalData.prorrogados || [];

        // Calcular totais de operações
        const totalOperacoes = operacoes.length;
        const valorBrutoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_bruto) || 0), 0);
        const valorLiquidoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_liquido) || 0), 0);
        // Receita gerada vem de smartsecurities_receita_por_cedente (campo total)
        const receitaTotal = receitas.reduce((acc: number, r: any) => acc + (parseFloat(r.total) || 0), 0);
        const prazoMedioTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.prazo_medio) || 0), 0);

        // Calcular taxa média: (desagio / valor_bruto / prazo_medio) * 30 * 100
        const taxasOperacoes = operacoes
          .filter((op: any) => {
            const bruto = parseFloat(op.valor_bruto) || 0;
            const prazo = parseFloat(op.prazo_medio) || 0;
            return bruto > 0 && prazo > 0;
          })
          .map((op: any) => {
            const bruto = parseFloat(op.valor_bruto);
            const liquido = parseFloat(op.valor_liquido) || 0;
            const desagio = bruto - liquido;
            const prazo = parseFloat(op.prazo_medio);
            return (desagio / bruto / prazo) * 30 * 100;
          });
        const taxaMediaCalc = taxasOperacoes.length > 0
          ? taxasOperacoes.reduce((acc: number, t: number) => acc + t, 0) / taxasOperacoes.length
          : 0;

        // Calcular carteira em aberto
        const carteiraTotal = titulosAberto.reduce((acc: number, t: any) => acc + (parseFloat(t.valor) || 0), 0);
        const hoje = new Date();
        const titulosVencidos = titulosAberto.filter((t: any) => t.vencimento && new Date(t.vencimento) < hoje);
        const carteiraVencida = titulosVencidos.reduce((acc: number, t: any) => acc + (parseFloat(t.valor) || 0), 0);

        // Calcular liquidez com base nos títulos quitados e recomprados
        const valorQuitadoTotal = titulosQuitados.reduce((acc: number, t: any) => acc + (parseFloat(t.valor_face) || 0), 0);
        const valorRecompradoTotal = recomprados.reduce((acc: number, t: any) => acc + (parseFloat(t.valor_face) || 0), 0);
        
        // Total de títulos para cálculo de percentuais = quitados + recomprados
        const totalTitulosHistorico = titulosQuitados.length + recomprados.length;
        const valorTotalHistorico = valorQuitadoTotal + valorRecompradoTotal;

        // Calcular comportamento de pagamento dos títulos quitados
        let pontualQtd = 0, pontualValor = 0;
        let atrasoQtd = 0, atrasoValor = 0;
        
        titulosQuitados.forEach((t: any) => {
          const vencimento = t.vencimento ? new Date(t.vencimento) : null;
          const quitacao = t.quitacao ? new Date(t.quitacao) : null;
          const valorFace = parseFloat(t.valor_face) || 0;
          
          if (vencimento && quitacao) {
            const diffDays = Math.floor((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              // Considera pontual se pagou até 1 dia após vencimento
              pontualQtd++;
              pontualValor += valorFace;
            } else {
              atrasoQtd++;
              atrasoValor += valorFace;
            }
          } else {
            // Se não tem datas, considera como pontual (status P geralmente indica pago)
            pontualQtd++;
            pontualValor += valorFace;
          }
        });

        // Percentuais de liquidez
        const percentualPontual = totalTitulosHistorico > 0 ? (pontualQtd / totalTitulosHistorico) * 100 : 0;
        const percentualAtraso = totalTitulosHistorico > 0 ? (atrasoQtd / totalTitulosHistorico) * 100 : 0;
        const percentualRecompra = totalTitulosHistorico > 0 ? (recomprados.length / totalTitulosHistorico) * 100 : 0;
        const percentualLiquidado = totalTitulosHistorico > 0 ? (titulosQuitados.length / totalTitulosHistorico) * 100 : 100;

        // Concentração de sacados (baseado em títulos em aberto)
        const sacadoMap = new Map<string, { nome: string; cpf_cnpj: string; valor: number }>();
        titulosAberto.forEach((t: any) => {
          if (t.cpf_cnpj_sacado) {
            const existing = sacadoMap.get(t.cpf_cnpj_sacado);
            if (existing) {
              existing.valor += parseFloat(t.valor) || 0;
            } else {
              sacadoMap.set(t.cpf_cnpj_sacado, {
                nome: t.sacado || '',
                cpf_cnpj: t.cpf_cnpj_sacado,
                valor: parseFloat(t.valor) || 0
              });
            }
          }
        });
        const concentracaoSacados = Array.from(sacadoMap.values())
          .map(s => ({
            cpf_cnpj: s.cpf_cnpj,
            nome: s.nome,
            risco: s.valor,
            concentracao: carteiraTotal > 0 ? (s.valor / carteiraTotal) * 100 : 0
          }))
          .sort((a, b) => b.risco - a.risco)
          .slice(0, 10);

        // Receita mensal
        const receitaMensalMap = new Map<string, number>();
        receitas.forEach((r: any) => {
          if (r.data_pagamento) {
            const mes = r.data_pagamento.substring(0, 7);
            receitaMensalMap.set(mes, (receitaMensalMap.get(mes) || 0) + (parseFloat(r.total) || 0));
          }
        });
        const receitaMensal = Array.from(receitaMensalMap.entries())
          .map(([mes, valor]) => ({ mes, valor }))
          .sort((a, b) => b.mes.localeCompare(a.mes))
          .slice(0, 12);

        // Comportamento 90 dias - analisar títulos quitados nos últimos 90 dias
        const hoje90Dias = new Date();
        hoje90Dias.setDate(hoje90Dias.getDate() - 90);
        
        let comp90Pontual = { valor: 0, qtd: 0 };
        let comp90Atraso5 = { valor: 0, qtd: 0 };
        let comp90Atraso15 = { valor: 0, qtd: 0 };
        let comp90Atraso30 = { valor: 0, qtd: 0 };
        let comp90AtrasoMais30 = { valor: 0, qtd: 0 };
        let comp90Total = { valor: 0, qtd: 0 };

        titulosQuitados.forEach((t: any) => {
          const quitacao = t.quitacao ? new Date(t.quitacao) : null;
          if (!quitacao || quitacao < hoje90Dias) return;
          
          const vencimento = t.vencimento ? new Date(t.vencimento) : null;
          const valorFace = parseFloat(t.valor_face) || 0;
          
          comp90Total.valor += valorFace;
          comp90Total.qtd++;
          
          if (vencimento) {
            const diffDays = Math.floor((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
              comp90Pontual.valor += valorFace;
              comp90Pontual.qtd++;
            } else if (diffDays <= 5) {
              comp90Atraso5.valor += valorFace;
              comp90Atraso5.qtd++;
            } else if (diffDays <= 15) {
              comp90Atraso15.valor += valorFace;
              comp90Atraso15.qtd++;
            } else if (diffDays <= 30) {
              comp90Atraso30.valor += valorFace;
              comp90Atraso30.qtd++;
            } else {
              comp90AtrasoMais30.valor += valorFace;
              comp90AtrasoMais30.qtd++;
            }
          } else {
            comp90Pontual.valor += valorFace;
            comp90Pontual.qtd++;
          }
        });

        // Calcular recompras nos últimos 90 dias
        let comp90Recompra = { valor: 0, qtd: 0 };
        recomprados.forEach((t: any) => {
          const recompraDate = t.recompra ? new Date(t.recompra) : null;
          if (!recompraDate || recompraDate < hoje90Dias) return;
          comp90Recompra.valor += parseFloat(t.valor_face) || 0;
          comp90Recompra.qtd++;
        });

        const cedenteDetail: CedenteDetail = {
          cedente: {
            id: cedente.id_cedente || 0,
            nome: cedente.nome,
            cpf_cnpj: cedente.cpf_cnpj,
            endereco: cedente.endereco,
            cep: cedente.cep,
            cidade: cedente.cidade,
            uf: cedente.uf,
            email: cedente.email,
            telefone: cedente.telefone,
            gerente: cedente.gerente,
            operador: cedente.operador,
            captador: cedente.captador,
            limite_global: parseFloat(cedente.limite_global) || 0,
            risco_atual: parseFloat(cedente.risco_atual) || 0,
            saldo: parseFloat(cedente.saldo) || 0,
            bloqueado: cedente.bloqueado,
            data_cadastro: cedente.data_cadastro,
            setor: cedente.setor,
            grupo_economico: cedente.grupo_economico,
          },
          resumo: {
            primeiraOperacao: cedente.primeira_operacao,
            ultimaOperacao: operacoes[0]?.data || null,
            totalOperacoes,
            valorBrutoTotal,
            valorLiquidoTotal,
            receitaTotal,
            taxaMedia: taxaMediaCalc,
          },
          resumoExpandido: (() => {
            // Prazo médio de títulos com vencimento nos últimos 90 dias (vencimento - emissao)
            const data90Frente = new Date();
            data90Frente.setDate(data90Frente.getDate() - 90);
            const titulos90 = [...titulosAberto, ...titulosQuitados].filter((t: any) => {
              if (!t.vencimento || !t.data_emissao) return false;
              const venc = new Date(t.vencimento);
              return venc >= data90Frente && venc <= new Date();
            });
            const prazos90 = titulos90.map((t: any) => {
              const e = new Date(t.data_emissao);
              const v = new Date(t.vencimento);
              return Math.ceil((v.getTime() - e.getTime()) / 86400000);
            });
            const prazoMedio90 = prazos90.length > 0 ? prazos90.reduce((a, b) => a + b, 0) / prazos90.length : 0;

            // Média de dias em atraso (apenas quitados pagos após vencimento)
            const diasAtrasoList = titulosQuitados
              .filter((t: any) => t.quitacao && t.vencimento && new Date(t.quitacao) > new Date(t.vencimento))
              .map((t: any) => {
                const q = new Date(t.quitacao);
                const v = new Date(t.vencimento);
                return Math.ceil((q.getTime() - v.getTime()) / 86400000);
              });
            const mediaPagoEmAtraso = diasAtrasoList.length > 0
              ? diasAtrasoList.reduce((a: number, b: number) => a + b, 0) / diasAtrasoList.length
              : 0;

            // % prorrogação = prorrogados / (quitados + recomprados + prorrogados)
            const totalHist = titulosQuitados.length + recomprados.length + prorrogados.length;
            const percentualProrrogacao = totalHist > 0 ? (prorrogados.length / totalHist) * 100 : 0;

            // CHQ devolvidos: tipo CHQ/CHEQUE com motivo de devolução
            const chqDevolvidosAberto = titulosAberto.filter((t: any) => {
              const tipo = String(t.tipo || '').toUpperCase();
              const motivo = String(t.motivo || '').toUpperCase();
              return (tipo.includes('CHQ') || tipo.includes('CHEQUE')) && motivo.includes('DEV');
            }).length;
            const chqDevolvidosQuitado = titulosQuitados.filter((t: any) => {
              const tipo = String(t.tipo || '').toUpperCase();
              const motivoDev = String(t.motivo_devolucao || '').toUpperCase();
              return (tipo.includes('CHQ') || tipo.includes('CHEQUE')) && motivoDev.length > 0;
            }).length;

            return {
              volumeOperado: valorBrutoTotal,
              prazoMedioOperacoes: totalOperacoes > 0 ? prazoMedioTotal / totalOperacoes : 0,
              prazoMedioTitulos90Dias: prazoMedio90,
              mediaPagoEmAtraso,
              valorMedioBorderos: totalOperacoes > 0 ? valorBrutoTotal / totalOperacoes : 0,
              valorMedioTitulos: titulosAberto.length > 0 ? carteiraTotal / titulosAberto.length : 0,
              receitaGerada: receitaTotal,
              percentualProrrogacao,
              chqDevolvidosAberto,
              chqDevolvidosQuitado,
            };
          })(),
          limites: {
            global: parseFloat(cedente.limite_global) || 0,
            disponivel: parseFloat(cedente.saldo) || 0,
            risco: parseFloat(cedente.risco_atual) || 0,
            saldo: parseFloat(cedente.saldo) || 0,
          },
          confirmacao: (() => {
            const norm = (c: any) => String(c ?? '').trim().toUpperCase();
            const confirmadoArr = titulosAberto.filter((t: any) => ['C', 'CONFIRMADO'].includes(norm(t.conf)));
            const parcialArr = titulosAberto.filter((t: any) => ['CI', 'PARCIAL'].includes(norm(t.conf)));
            const pendenteArr = titulosAberto.filter((t: any) => ['P', 'PENDENTE', 'N'].includes(norm(t.conf)));
            const semArr = titulosAberto.filter((t: any) => {
              const n = norm(t.conf);
              return n === '' || !['C', 'CONFIRMADO', 'CI', 'PARCIAL', 'P', 'PENDENTE', 'N'].includes(n);
            });
            const sumValor = (arr: any[]) => arr.reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0);
            const totalQtd = titulosAberto.length;
            const pct = (q: number) => totalQtd > 0 ? (q / totalQtd) * 100 : 0;
            return {
              confirmado: { qtd: confirmadoArr.length, valor: sumValor(confirmadoArr), percentual: pct(confirmadoArr.length) },
              parcial: { qtd: parcialArr.length, valor: sumValor(parcialArr), percentual: pct(parcialArr.length) },
              pendente: { qtd: pendenteArr.length, valor: sumValor(pendenteArr), percentual: pct(pendenteArr.length) },
              semConfirmacao: { qtd: semArr.length, valor: sumValor(semArr), percentual: pct(semArr.length) },
              total: { qtd: totalQtd, valor: carteiraTotal },
            };
          })(),
          carteira: {
            total: carteiraTotal,
            vencidos: carteiraVencida,
            percentualVencido: carteiraTotal > 0 ? (carteiraVencida / carteiraTotal) * 100 : 0,
          },
          concentracaoSacados,
          liquidez: {
            totalQuitados: titulosQuitados.length,
            valorQuitado: valorQuitadoTotal,
            totalRecomprados: recomprados.length,
            valorRecomprado: valorRecompradoTotal,
            percentualPontual,
            percentualAtraso,
            percentualRecompra,
            percentualLiquidado,
          },
          comportamento90Dias: {
            pontual: { 
              valor: comp90Pontual.valor, 
              qtd: comp90Pontual.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90Pontual.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90Pontual.qtd / comp90Total.qtd) * 100 : 0 
            },
            atraso5: { 
              valor: comp90Atraso5.valor, 
              qtd: comp90Atraso5.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90Atraso5.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso5.qtd / comp90Total.qtd) * 100 : 0 
            },
            atraso15: { 
              valor: comp90Atraso15.valor, 
              qtd: comp90Atraso15.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90Atraso15.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso15.qtd / comp90Total.qtd) * 100 : 0 
            },
            atraso30: { 
              valor: comp90Atraso30.valor, 
              qtd: comp90Atraso30.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90Atraso30.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso30.qtd / comp90Total.qtd) * 100 : 0 
            },
            atrasoMais30: { 
              valor: comp90AtrasoMais30.valor, 
              qtd: comp90AtrasoMais30.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90AtrasoMais30.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90AtrasoMais30.qtd / comp90Total.qtd) * 100 : 0 
            },
            recompra: { 
              valor: comp90Recompra.valor, 
              qtd: comp90Recompra.qtd, 
              percentualValor: comp90Total.valor > 0 ? (comp90Recompra.valor / comp90Total.valor) * 100 : 0,
              percentualQtd: comp90Total.qtd > 0 ? (comp90Recompra.qtd / comp90Total.qtd) * 100 : 0 
            },
            repasse: { valor: 0, qtd: 0, percentualValor: 0, percentualQtd: 0 },
            cartorio: { valor: 0, qtd: 0, percentualValor: 0, percentualQtd: 0 },
            totalPago: comp90Total,
            emAtraso: { valor: carteiraVencida, qtd: titulosVencidos.length, percentualValor: carteiraTotal > 0 ? (carteiraVencida / carteiraTotal) * 100 : 0, percentualQtd: titulosAberto.length > 0 ? (titulosVencidos.length / titulosAberto.length) * 100 : 0 },
          },
          receitaMensal,
          titulosAberto: titulosAberto.slice(0, 50).map((t: any) => ({
            id: t.dev_id || 0,
            documento: t.documento || t.id_titulo,
            sacado: t.sacado,
            cpf_cnpj_sacado: t.cpf_cnpj_sacado,
            valor: parseFloat(t.valor) || 0,
            vencimento: t.vencimento,
            situacao: t.situacao,
            conf: t.conf,
            etapa: t.etapa,
          })),
          titulosQuitados: titulosQuitados.slice(0, 50).map((t: any) => ({
            id: t.dev_id || 0,
            numero: t.numero,
            sacado: t.sacado,
            cpf_cnpj_sacado: t.cpf_cnpj_sacado,
            valor_face: parseFloat(t.valor_face) || 0,
            valor_liquidado: parseFloat(t.valor_liquidado) || 0,
            vencimento: t.vencimento,
            quitacao: t.quitacao,
            status: t.status,
            tipo_quitacao: t.tipo_quitacao,
          })),
          ultimasOperacoes: operacoes.slice(0, 20).map((op: any) => ({
            id: op.dev_id || 0,
            operacao: op.operacao,
            data: op.data,
            valor_bruto: parseFloat(op.valor_bruto) || 0,
            valor_liquido: parseFloat(op.valor_liquido) || 0,
            valor_taxa: (() => {
              const bruto = parseFloat(op.valor_bruto) || 0;
              const liquido = parseFloat(op.valor_liquido) || 0;
              const prazo = parseFloat(op.prazo_medio) || 0;
              if (bruto > 0 && prazo > 0) {
                const desagio = bruto - liquido;
                return (desagio / bruto / prazo) * 30 * 100;
              }
              return 0;
            })(),
            prazo_medio: parseFloat(op.prazo_medio) || 0,
            etapa: op.etapa,
          })),
          suspeitasFraude: suspeitaFraude.map((f: any) => ({
            id: f.dev_id || 0,
            sacado: f.sacado,
            cpf_cnpj_sacado: f.cpf_cnpj_sacado,
            numero_documento: f.numero_documento,
            valor: parseFloat(f.valor) || 0,
            vencimento: f.vencimento,
            data_quitacao: f.data_quitacao,
            criticas: f.criticas,
            banco_cobrador: f.banco_cobrador,
            agencia_cobradora: f.agencia_cobradora,
            praca_pagamento: f.praca_pagamento,
            localidade_sacado: f.localidade_sacado,
          })),
        };

        setCedenteDetail(cedenteDetail);
      }
    } catch (err) {
      console.error('Error fetching cedente detail:', err);
      setCedenteDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Carrega cedente da URL se existir parâmetro cpf_cnpj
  useEffect(() => {
    const cpfCnpjParam = searchParams.get('cpf_cnpj');
    
    const loadInitialData = async () => {
      const detailPromise = cpfCnpjParam ? fetchCedenteDetail(cpfCnpjParam) : Promise.resolve();
      const cedentesData = await fetchCedentes();
      
      if (cpfCnpjParam && cedentesData.length > 0) {
        // Busca o cedente na lista pelo cpf_cnpj
        const cedenteFromUrl = cedentesData.find(
          (c: CedenteListItem) => c.cpf_cnpj?.replace(/\D/g, '') === cpfCnpjParam.replace(/\D/g, '')
        );
        
        if (cedenteFromUrl) {
          setSelectedCedente(cedenteFromUrl);
          // Se não encontrou na lista, busca direto pelo detalhe
        }
      }
      await detailPromise;
      setInitialLoadDone(true);
    };

    loadInitialData();
  }, [searchParams, fetchCedentes, fetchCedenteDetail]);

  useEffect(() => {
    if (!initialLoadDone) return;
    
    const debounce = setTimeout(() => {
      fetchCedentes(search, gerente);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, gerente, fetchCedentes, initialLoadDone]);

  const handleSelectCedente = (cedente: CedenteListItem) => {
    setSelectedCedente(cedente);
    if (cedente.cpf_cnpj) {
      fetchCedenteDetail(cedente.cpf_cnpj);
    }
  };

  return (
    <MainLayout title="Consulta" subtitle="Consulta detalhada de cedentes com cruzamento de dados">
      <div className="mb-4 max-w-2xl flex items-center gap-2">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">Gestor:</label>
        <Select value={gerente || 'all'} onValueChange={(v) => setGerente(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-10 bg-card">
            <SelectValue placeholder="Todos os gestores" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50 max-h-[400px]">
            <SelectItem value="all">Todos os gestores ({gestores.reduce((s, g) => s + g.total, 0)})</SelectItem>
            {gestores.map((g) => (
              <SelectItem key={g.gerente} value={g.gerente}>
                {g.gerente} ({g.total})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {gerente && (
          <button
            onClick={() => setGerente('')}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Limpar
          </button>
        )}
      </div>

      {gerente && (
        <div className="mb-6 max-w-5xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              Carteira de {gerente}
            </h3>
            <span className="text-xs text-muted-foreground">
              {isLoadingList ? 'Carregando...' : `${cedentes.length} cedente${cedentes.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
              {isLoadingList ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm text-muted-foreground">Carregando carteira...</span>
                </div>
              ) : cedentes.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum cedente nesta carteira
                </div>
              ) : (
                cedentes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCedente(c)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors flex items-center justify-between gap-4 ${selectedCedente?.id === c.id ? 'bg-accent' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{c.nome || 'Sem nome'}</p>
                        {c.bloqueado === 'S' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">Bloqueado</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj || '-'}{c.cidade ? ` • ${c.cidade}${c.uf ? '/' + c.uf : ''}` : ''}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Limite</p>
                        <p className="font-medium text-foreground">{c.limite_global ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(c.limite_global) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Risco</p>
                        <p className="font-medium text-primary">{c.risco_atual ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(c.risco_atual) : '-'}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <CedenteSearch
        cedentes={cedentes}
        selectedCedente={selectedCedente}
        search={search}
        onSearchChange={setSearch}
        onSelectCedente={handleSelectCedente}
        isLoading={isLoadingList}
      />

      {isLoadingDetail ? (
        <LoadingPlaceholder />
      ) : cedenteDetail ? (
        <CedenteInfoPanel data={cedenteDetail} />
      ) : selectedCedente ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Nenhum dado encontrado para este cedente</p>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-4">
            <Search className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Selecione um cedente para visualizar as informações</p>
        </div>
      )}
    </MainLayout>
  );
}
