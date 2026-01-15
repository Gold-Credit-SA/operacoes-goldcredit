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
    <div className="mb-6 space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cedentes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-11 h-11 bg-card border-border"
          />
        </div>
      </div>

      {/* Cedentes list */}
      <Card className="shadow-sm border-border overflow-hidden">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : cedentes.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Nenhum cedente encontrado
              </div>
            ) : (
              cedentes.map((cedente) => (
                <button
                  key={cedente.id}
                  onClick={() => onSelectCedente(cedente)}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50",
                    selectedCedente?.id === cedente.id && "bg-accent"
                  )}
                >
                  {/* Folder icon */}
                  <div className="flex-shrink-0">
                    <FolderOpen className={cn(
                      "h-6 w-6",
                      selectedCedente?.id === cedente.id ? "text-primary" : "text-primary/70"
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {cedente.nome || 'Sem nome'}
                      </span>
                      {cedente.bloqueado === 'S' && (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{cedente.cpf_cnpj || '-'}</span>
                      <span>•</span>
                      <span>{cedente.cidade || '-'}{cedente.uf ? `, ${cedente.uf}` : ''}</span>
                      {cedente.gerente && (
                        <>
                          <span>•</span>
                          <span>{cedente.gerente}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Limite</p>
                      <p className="font-medium text-foreground">{formatCurrency(cedente.limite_global)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Risco</p>
                      <p className="font-medium text-primary">{formatCurrency(cedente.risco_atual)}</p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
