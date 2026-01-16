import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FolderOpen, ChevronRight, Building2, MapPin, X } from 'lucide-react';
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
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = isFocused && search.length > 0;

  const handleSelect = (cedente: CedenteListItem) => {
    onSelectCedente(cedente);
    setIsFocused(false);
  };

  const clearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="mb-8" ref={containerRef}>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Buscar Cedente
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Digite o nome, razão social ou CPF/CNPJ do cedente
        </p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Ex: Gold Credit ou 00.000.000/0001-00"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-12 pr-10 h-14 text-base bg-card border-border shadow-sm focus:ring-2 focus:ring-primary/20"
        />
        {search.length > 0 && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Dropdown results */}
        {showDropdown && (
          <Card className="absolute top-full left-0 right-0 mt-2 shadow-xl border-border overflow-hidden z-50 bg-card">
            <ScrollArea className="max-h-[350px]">
              <div className="divide-y divide-border">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">Buscando cedentes...</span>
                  </div>
                ) : cedentes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhum cedente encontrado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tente buscar por outro termo ou verifique o CPF/CNPJ
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground">
                        {cedentes.length} cedente{cedentes.length !== 1 ? 's' : ''} encontrado{cedentes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {cedentes.slice(0, 10).map((cedente) => (
                      <button
                        key={cedente.id}
                        onClick={() => handleSelect(cedente)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-4 text-left transition-all hover:bg-accent/50 group",
                          selectedCedente?.id === cedente.id && "bg-accent"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          selectedCedente?.id === cedente.id 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-primary/10 text-primary group-hover:bg-primary/20"
                        )}>
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {cedente.nome || 'Sem nome'}
                            </p>
                            {cedente.bloqueado === 'S' && (
                              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 flex-shrink-0">
                                Bloqueado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {cedente.cpf_cnpj || '-'}
                            </span>
                            {(cedente.cidade || cedente.uf) && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {cedente.cidade}{cedente.uf ? `, ${cedente.uf}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Limite</p>
                            <p className="text-sm font-medium text-foreground">{formatCurrency(cedente.limite_global)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Risco</p>
                            <p className="text-sm font-medium text-primary">{formatCurrency(cedente.risco_atual)}</p>
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
                      </button>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* Selected cedente indicator */}
      {selectedCedente && !isFocused && (
        <div className="mt-4 max-w-2xl">
          <div className="flex items-center gap-3 px-4 py-3 bg-accent/50 rounded-lg border border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedCedente.nome}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedCedente.cpf_cnpj}</p>
            </div>
            <button
              onClick={() => {
                onSearchChange('');
                onSelectCedente(null as any);
              }}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
