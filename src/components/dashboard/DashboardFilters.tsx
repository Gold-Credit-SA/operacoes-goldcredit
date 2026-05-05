import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { DashboardFiltersState } from '@/pages/Dashboard';

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onFilterChange: (filters: Partial<DashboardFiltersState>) => void;
  onClearFilters: () => void;
}

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

export function DashboardFilters({ filters, onFilterChange, onClearFilters }: DashboardFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="ml-auto text-xs h-7"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="cedente" className="text-xs">Cedente</Label>
            <Input
              id="cedente"
              placeholder="Nome do cedente..."
              value={filters.cedente}
              onChange={(e) => onFilterChange({ cedente: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataInicio" className="text-xs">Data Início</Label>
            <Input
              id="dataInicio"
              type="date"
              value={filters.dataInicio}
              onChange={(e) => onFilterChange({ dataInicio: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataFim" className="text-xs">Data Fim</Label>
            <Input
              id="dataFim"
              type="date"
              value={filters.dataFim}
              onChange={(e) => onFilterChange({ dataFim: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ano" className="text-xs">Ano</Label>
            <Select 
              value={filters.ano} 
              onValueChange={(value) => onFilterChange({ ano: value === 'all' ? '' : value })}
            >
              <SelectTrigger id="ano" className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ANOS.map(ano => (
                  <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uf" className="text-xs">Estado (UF)</Label>
            <Select 
              value={filters.uf} 
              onValueChange={(value) => onFilterChange({ uf: value === 'all' ? '' : value })}
            >
              <SelectTrigger id="uf" className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ESTADOS.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
