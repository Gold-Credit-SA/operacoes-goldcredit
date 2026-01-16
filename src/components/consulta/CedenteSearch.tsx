import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FolderOpen, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface CedenteSearchProps {
  cedentes: CedenteListItem[];
  selectedCedente: CedenteListItem | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCedente: (cedente: CedenteListItem) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

export function CedenteSearch({
  cedentes,
  selectedCedente,
  search,
  onSearchChange,
  onSelectCedente,
  isLoading,
}: CedenteSearchProps) {
  return (
    <div className="mb-6">
      {/* Search bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-12 h-12 text-base bg-card border-border"
        />
      </div>

      {/* Dropdown results */}
      {search.length > 0 && (
        <Card className="mt-2 max-w-xl shadow-lg border-border overflow-hidden">
          <ScrollArea className="max-h-[300px]">
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : cedentes.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  Nenhum cedente encontrado
                </div>
              ) : (
                cedentes.slice(0, 8).map((cedente) => (
                  <button
                    key={cedente.id}
                    onClick={() => onSelectCedente(cedente)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedCedente?.id === cedente.id && "bg-accent"
                    )}
                  >
                    <FolderOpen className={cn(
                      "h-5 w-5 flex-shrink-0",
                      selectedCedente?.id === cedente.id ? "text-primary" : "text-primary/70"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">
                        {cedente.nome || 'Sem nome'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cedente.cpf_cnpj || '-'}
                      </p>
                    </div>
                    {cedente.bloqueado === 'S' && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                        Bloqueado
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
