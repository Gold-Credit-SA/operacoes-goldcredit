import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  ArrowRight, 
  Building2,
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CedenteGiro {
  cpf_cnpj: string;
  nome?: string;
  razao_social?: string;
  limite_global?: number;
  limite_disponivel?: number;
  risco_atual?: number;
  bloqueado?: string;
  ultima_operacao?: string;
  dias_inativo?: number;
  setor?: string;
  uf?: string;
  cidade?: string;
}

export default function GiroCarteira() {
  const [cedentes, setCedentes] = useState<CedenteGiro[]>([]);
  const [filteredCedentes, setFilteredCedentes] = useState<CedenteGiro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [navigatingCpfCnpj, setNavigatingCpfCnpj] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCpfCnpj = (value: string | undefined) => {
    if (!value) return '-';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const fetchCedentes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('giro-carteira', {
        body: { action: 'list-all' }
      });

      if (error) throw error;

      if (data.success) {
        setCedentes(data.cedentes);
        setFilteredCedentes(data.cedentes);
        toast({
          title: "Cedentes carregados",
          description: `${data.cedentes.length} cedentes encontrados`
        });
      }
    } catch (error) {
      console.error("Erro ao buscar cedentes:", error);
      toast({
        title: "Erro ao carregar cedentes",
        description: "Não foi possível carregar a lista de cedentes.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCedentes();
  }, []);

  useEffect(() => {
    let result = cedentes;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.nome?.toLowerCase().includes(term) ||
        c.razao_social?.toLowerCase().includes(term) ||
        c.cpf_cnpj?.includes(term)
      );
    }
    
    setFilteredCedentes(result);
    setCurrentPage(1);
  }, [searchTerm, cedentes]);

  const irParaConsulta = (cedente: CedenteGiro) => {
    if (!cedente.cpf_cnpj) return;

    setNavigatingCpfCnpj(cedente.cpf_cnpj);
    navigate(`/consulta?cpf_cnpj=${cedente.cpf_cnpj}`, {
      state: {
        preloadedCedente: {
          id: 0,
          nome: cedente.nome || cedente.razao_social || null,
          cpf_cnpj: cedente.cpf_cnpj,
          cidade: cedente.cidade || null,
          uf: cedente.uf || null,
          gerente: null,
          operador: null,
          limite_global: cedente.limite_global ?? null,
          risco_atual: cedente.risco_atual ?? null,
          saldo: cedente.limite_disponivel ?? null,
          bloqueado: cedente.bloqueado || null,
        },
      },
    });
  };

  // Ordenar: mais recentes primeiro
  const cedentesOrdenados = [...filteredCedentes].sort((a, b) => {
    const dateA = a.ultima_operacao ? new Date(a.ultima_operacao).getTime() : 0;
    const dateB = b.ultima_operacao ? new Date(b.ultima_operacao).getTime() : 0;
    return dateB - dateA;
  });

  // Pagination
  const totalPages = Math.ceil(cedentesOrdenados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCedentes = cedentesOrdenados.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Giro de Carteira</h1>
            <p className="text-muted-foreground">
              Visualize todos os cedentes cadastrados
            </p>
          </div>
          <Button onClick={fetchCedentes} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Card */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{cedentes.length}</p>
              <p className="text-sm text-muted-foreground">Total Cedentes</p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cedentes ({filteredCedentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Limite Global</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-center">Última Operação</TableHead>
                      <TableHead className="text-center">Dias Inativo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCedentes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum cedente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCedentes.map((cedente) => (
                        <TableRow key={cedente.cpf_cnpj}>
                          <TableCell className="font-mono text-sm">
                            {formatCpfCnpj(cedente.cpf_cnpj)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {cedente.nome || cedente.razao_social || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(cedente.limite_global)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            (cedente.limite_disponivel || 0) <= 0 ? 'text-red-500' : 'text-emerald-500'
                          }`}>
                            {formatCurrency(cedente.limite_disponivel)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatDate(cedente.ultima_operacao)}
                          </TableCell>
                          <TableCell className="text-center">
                            {cedente.dias_inativo !== undefined && cedente.dias_inativo !== null ? (
                              <Badge variant={cedente.dias_inativo > 30 ? "destructive" : "secondary"}>
                                {cedente.dias_inativo} dias
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => irParaConsulta(cedente)}
                              disabled={navigatingCpfCnpj === cedente.cpf_cnpj}
                            >
                              {navigatingCpfCnpj === cedente.cpf_cnpj ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && cedentesOrdenados.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Exibindo</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>de {filteredCedentes.length} cedentes</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1 mx-2">
                    <span className="text-sm">Página</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => goToPage(Number(e.target.value))}
                      className="w-14 h-8 text-center"
                    />
                    <span className="text-sm">de {totalPages}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
