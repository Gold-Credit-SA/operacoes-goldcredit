import { useState, useEffect } from 'react';
import { Search, Building2, Check, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface CedenteOption {
  cpf_cnpj: string;
  nome: string;
  na_carteira: boolean;
}

interface Props {
  cedentes: CedenteOption[];
  loading: boolean;
  selected: CedenteOption | null;
  onSelect: (c: CedenteOption) => void;
}

export function CedenteSelector({ cedentes, loading, selected, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q.length >= 2
    ? cedentes.filter(c =>
        c.nome.toLowerCase().includes(q) || c.cpf_cnpj.includes(q)
      )
    : cedentes.filter(c => c.na_carteira); // Show only portfolio when no search

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF/CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
        {filtered.length === 0 && q.length >= 2 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cedente encontrado</p>
        )}
        {filtered.length === 0 && q.length < 2 && (
          <p className="text-sm text-muted-foreground text-center py-6">Digite ao menos 2 caracteres para buscar</p>
        )}
        {filtered.map(c => {
          const isSelected = selected?.cpf_cnpj === c.cpf_cnpj;
          return (
            <button
              key={c.cpf_cnpj}
              onClick={() => onSelect(c)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {isSelected ? <Check className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>{c.nome}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>
              </div>
              {c.na_carteira && (
                <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                  <Briefcase className="h-3 w-3 mr-1" />
                  Carteira
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
