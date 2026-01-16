import { useState, useEffect, useCallback } from 'react';
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
  const [cedentes, setCedentes] = useState<CedenteListItem[]>([]);
  const [selectedCedente, setSelectedCedente] = useState<CedenteListItem | null>(null);
  const [cedenteDetail, setCedenteDetail] = useState<CedenteDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCedentes = useCallback(async (searchTerm?: string) => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase.functions.invoke('cedente-info', {
        body: { action: 'list', search: searchTerm }
      });

      if (error) throw error;
      if (data?.success) {
        setCedentes(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching cedentes:', err);
      setCedentes([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const fetchCedenteDetail = useCallback(async (cpf_cnpj: string) => {
    setIsLoadingDetail(true);
    try {
      const { data, error } = await supabase.functions.invoke('cedente-info', {
        body: { action: 'detail', cpf_cnpj }
      });

      if (error) throw error;
      if (data?.success) {
        setCedenteDetail(data.data);
      }
    } catch (err) {
      console.error('Error fetching cedente detail:', err);
      setCedenteDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchCedentes();
  }, [fetchCedentes]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCedentes(search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, fetchCedentes]);

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
