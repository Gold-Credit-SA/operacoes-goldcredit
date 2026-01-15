import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    <Card className="mb-6 border-t-4 border-t-primary">
      <CardContent className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="search" className="text-xs font-semibold uppercase text-muted-foreground">
              Buscar Cedente
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Digite o nome ou CPF/CNPJ..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cedente-select" className="text-xs font-semibold uppercase text-muted-foreground">
              Razão Social
            </Label>
            <Select
              value={selectedCedente?.id?.toString() || ''}
              onValueChange={(value) => {
                const cedente = cedentes.find(c => c.id.toString() === value);
                if (cedente) onSelectCedente(cedente);
              }}
            >
              <SelectTrigger id="cedente-select" className="h-10">
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um cedente..."} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {cedentes.map((cedente) => (
                  <SelectItem key={cedente.id} value={cedente.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{cedente.nome || 'Sem nome'}</span>
                      {cedente.bloqueado === 'S' && (
                        <Badge variant="destructive" className="text-[10px] h-4">
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCedente && (
          <div className="mt-4 grid gap-4 md:grid-cols-5 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
              <p className="font-mono text-sm font-medium">{selectedCedente.cpf_cnpj || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cidade/UF</p>
              <p className="text-sm font-medium">
                {selectedCedente.cidade || '-'}{selectedCedente.uf ? ` / ${selectedCedente.uf}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Limite</p>
              <p className="text-sm font-medium text-primary">{formatCurrency(selectedCedente.limite_global)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risco</p>
              <p className="text-sm font-medium text-amber-600">{formatCurrency(selectedCedente.risco_atual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-sm font-medium text-green-600">{formatCurrency(selectedCedente.saldo)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
