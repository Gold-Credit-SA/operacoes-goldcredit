import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { CedenteSearch } from '@/components/consulta/CedenteSearch';
import { CedenteInfoPanel } from '@/components/consulta/CedenteInfoPanel';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

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
  ultimasOperacoes: Array<{
    id: number;
    operacao: string | null;
    data: string | null;
    valor_bruto: number | null;
    valor_liquido: number | null;
    valor_receita: number | null;
    etapa: string | null;
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
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container-app py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Painel de Informação</h1>
          <p className="text-muted-foreground mt-1">
            Consulta detalhada de cedentes com cruzamento de dados
          </p>
        </div>

        <CedenteSearch
          cedentes={cedentes}
          selectedCedente={selectedCedente}
          search={search}
          onSearchChange={setSearch}
          onSelectCedente={handleSelectCedente}
          isLoading={isLoadingList}
        />

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando dados...</span>
          </div>
        ) : cedenteDetail ? (
          <CedenteInfoPanel data={cedenteDetail} />
        ) : selectedCedente ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum dado encontrado para este cedente
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Selecione um cedente para visualizar as informações detalhadas
          </div>
        )}
      </main>
    </div>
  );
}
