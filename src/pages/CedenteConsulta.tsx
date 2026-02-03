import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { CedenteSearch } from '@/components/consulta/CedenteSearch';
import { CedenteInfoPanel } from '@/components/consulta/CedenteInfoPanel';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search } from 'lucide-react';

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
  const [searchParams] = useSearchParams();
  const [cedentes, setCedentes] = useState<CedenteListItem[]>([]);
  const [selectedCedente, setSelectedCedente] = useState<CedenteListItem | null>(null);
  const [cedenteDetail, setCedenteDetail] = useState<CedenteDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchCedentes = useCallback(async (searchTerm?: string) => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase.functions.invoke('external-db', {
        body: { action: 'cedentes-list', filters: { search: searchTerm } }
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

        // Calcular totais de operações
        const totalOperacoes = operacoes.length;
        const valorBrutoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_bruto) || 0), 0);
        const valorLiquidoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_liquido) || 0), 0);
        const receitaTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_receita) || 0), 0);
        const prazoMedioTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.prazo_medio) || 0), 0);

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
            taxaMedia: totalOperacoes > 0 ? prazoMedioTotal / totalOperacoes : 0,
          },
          resumoExpandido: {
            volumeOperado: valorBrutoTotal,
            prazoMedioOperacoes: totalOperacoes > 0 ? prazoMedioTotal / totalOperacoes : 0,
            prazoMedioTitulos90Dias: 0,
            mediaPagoEmAtraso: comp90Total.qtd > 0 ? (comp90Atraso5.qtd + comp90Atraso15.qtd + comp90Atraso30.qtd + comp90AtrasoMais30.qtd) / comp90Total.qtd * 100 : 0,
            valorMedioBorderos: totalOperacoes > 0 ? valorBrutoTotal / totalOperacoes : 0,
            valorMedioTitulos: titulosAberto.length > 0 ? carteiraTotal / titulosAberto.length : 0,
            receitaGerada: receitaTotal,
            percentualProrrogacao: 0,
            chqDevolvidosAberto: titulosAberto.filter((t: any) => t.tipo === 'CHQ' && t.situacao === 'Devolvido').length,
            chqDevolvidosQuitado: titulosQuitados.filter((t: any) => t.tipo === 'CHQ' && t.motivo_devolucao).length,
          },
          limites: {
            global: parseFloat(cedente.limite_global) || 0,
            disponivel: parseFloat(cedente.saldo) || 0,
            risco: parseFloat(cedente.risco_atual) || 0,
            saldo: parseFloat(cedente.saldo) || 0,
          },
          confirmacao: {
            confirmado: { qtd: titulosAberto.filter((t: any) => t.conf === 'Confirmado' || t.conf === 'C').length, valor: titulosAberto.filter((t: any) => t.conf === 'Confirmado' || t.conf === 'C').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
            parcial: { qtd: titulosAberto.filter((t: any) => t.conf === 'Parcial' || t.conf === 'P').length, valor: titulosAberto.filter((t: any) => t.conf === 'Parcial' || t.conf === 'P').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
            pendente: { qtd: titulosAberto.filter((t: any) => t.conf === 'Pendente' || t.conf === 'N').length, valor: titulosAberto.filter((t: any) => t.conf === 'Pendente' || t.conf === 'N').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
            semConfirmacao: { qtd: titulosAberto.filter((t: any) => !t.conf || t.conf === '').length, valor: titulosAberto.filter((t: any) => !t.conf || t.conf === '').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
            total: { qtd: titulosAberto.length, valor: carteiraTotal },
          },
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
            valor_taxa: parseFloat(op.valor_taxa) || 0,
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
      const cedentesData = await fetchCedentes();
      
      if (cpfCnpjParam && cedentesData.length > 0) {
        // Busca o cedente na lista pelo cpf_cnpj
        const cedenteFromUrl = cedentesData.find(
          (c: CedenteListItem) => c.cpf_cnpj?.replace(/\D/g, '') === cpfCnpjParam.replace(/\D/g, '')
        );
        
        if (cedenteFromUrl) {
          setSelectedCedente(cedenteFromUrl);
          fetchCedenteDetail(cedenteFromUrl.cpf_cnpj!);
        } else {
          // Se não encontrou na lista, busca direto pelo detalhe
          fetchCedenteDetail(cpfCnpjParam);
        }
      }
      setInitialLoadDone(true);
    };

    loadInitialData();
  }, [searchParams, fetchCedentes, fetchCedenteDetail]);

  useEffect(() => {
    if (!initialLoadDone) return;
    
    const debounce = setTimeout(() => {
      fetchCedentes(search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, fetchCedentes, initialLoadDone]);

  const handleSelectCedente = (cedente: CedenteListItem) => {
    setSelectedCedente(cedente);
    if (cedente.cpf_cnpj) {
      fetchCedenteDetail(cedente.cpf_cnpj);
    }
  };

  return (
    <MainLayout title="Consulta" subtitle="Consulta detalhada de cedentes com cruzamento de dados">
      <CedenteSearch
        cedentes={cedentes}
        selectedCedente={selectedCedente}
        search={search}
        onSearchChange={setSearch}
        onSelectCedente={handleSelectCedente}
        isLoading={isLoadingList}
      />

      {isLoadingDetail ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="text-muted-foreground font-medium">Carregando dados...</span>
          </div>
        </div>
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
