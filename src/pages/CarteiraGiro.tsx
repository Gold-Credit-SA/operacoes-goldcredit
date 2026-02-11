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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, ArrowRight, RefreshCw, Briefcase,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface CedenteCarteira {
  cpf_cnpj: string;
  nome?: string;
  limite_global?: number;
  limite_disponivel?: number;
  risco_atual?: number;
  bloqueado?: string;
  ultima_operacao?: string;
  dias_inativo?: number;
}

export default function CarteiraGiro() {
  const [cedentes, setCedentes] = useState<CedenteCarteira[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
    if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (cleaned.length === 14) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return value;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const fetchPortfolio = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'my-portfolio' },
      });
      if (error) throw error;
      if (data.success) setCedentes(data.cedentes);
    } catch (error) {
      console.error("Erro ao buscar carteira:", error);
      toast({ title: "Erro ao carregar carteira", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  const filteredCedentes = searchTerm.trim()
    ? cedentes.filter(c => {
        const term = searchTerm.toLowerCase();
        return c.nome?.toLowerCase().includes(term) || c.cpf_cnpj?.includes(term);
      })
    : cedentes;

  const cedentesOrdenados = [...filteredCedentes].sort((a, b) => {
    const dateA = a.ultima_operacao ? new Date(a.ultima_operacao).getTime() : 0;
    const dateB = b.ultima_operacao ? new Date(b.ultima_operacao).getTime() : 0;
    return dateB - dateA;
  });

  const totalPages = Math.ceil(cedentesOrdenados.length / itemsPerPage);
  const paginatedCedentes = cedentesOrdenados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  return (
    <MainLayout title="Giro de Carteira" subtitle="Acompanhamento de movimentações e operações da sua carteira">
      <div className="space-y-6">
        {/* Search & refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cedente na carteira..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchPortfolio} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Giro da Carteira ({filteredCedentes.length} cedentes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : cedentes.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="font-medium">Sua carteira está vazia</p>
                <p className="text-sm text-muted-foreground">
                  Adicione cedentes em "Gestão de Carteira" para começar.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Limite Global</TableHead>
                      <TableHead className="text-right">Risco Atual</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-center">Última Operação</TableHead>
                      <TableHead className="text-center">Dias Inativo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCedentes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum cedente encontrado
                        </TableCell>
                      </TableRow>
                    ) : paginatedCedentes.map(ced => (
                      <TableRow key={ced.cpf_cnpj}>
                        <TableCell className="font-mono text-sm">{formatCpfCnpj(ced.cpf_cnpj)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{ced.nome || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(ced.limite_global)}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{formatCurrency(ced.risco_atual)}</TableCell>
                        <TableCell className={`text-right font-medium ${(ced.limite_disponivel || 0) <= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                          {formatCurrency(ced.limite_disponivel)}
                        </TableCell>
                        <TableCell className="text-center">{formatDate(ced.ultima_operacao)}</TableCell>
                        <TableCell className="text-center">
                          {ced.dias_inativo != null ? (
                            <Badge variant={ced.dias_inativo > 30 ? "destructive" : "secondary"}>
                              {ced.dias_inativo} dias
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/consulta?cpf_cnpj=${ced.cpf_cnpj}`)}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && cedentesOrdenados.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Exibindo</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span>de {filteredCedentes.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm mx-2">Página {currentPage} de {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
