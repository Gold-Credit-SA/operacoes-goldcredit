import { useState, useCallback } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export const CONSULTA_TYPES = [
  { id: 'restritivos', label: 'Restritivos Nacional' },
  { id: 'endividamento', label: 'Endividamento Financeiro' },
  { id: 'cpr', label: 'Consulta CPR' },
  { id: 'imoveis_simples', label: 'Pesquisa de Imóveis - Simples' },
  { id: 'imoveis_car', label: 'Pesquisa Imóveis - CAR' },
  { id: 'patrimonio_veicular', label: 'Patrimônio Veicular' },
  { id: 'serasa', label: 'serasa' },
  { id: 'scr', label: 'SCR' },
] as const;

export type ConsultaTypeId = typeof CONSULTA_TYPES[number]['id'];

interface ConsultaSelectionProps {
  cnpj: string;
  onExecute: (selected: ConsultaTypeId[]) => void;
  onBack: () => void;
}

function formatCnpjDisplay(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function ConsultaSelection({ cnpj, onExecute, onBack }: ConsultaSelectionProps) {
  const [selected, setSelected] = useState<Set<ConsultaTypeId>>(new Set());

  const toggle = useCallback((id: ConsultaTypeId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === CONSULTA_TYPES.length) return new Set();
      return new Set(CONSULTA_TYPES.map(c => c.id));
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* CNPJ context */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>CNPJ:</span>
          <Badge variant="outline" className="font-mono text-xs">{formatCnpjDisplay(cnpj)}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Selecione as consultas</h2>
            </div>
            <Button variant="link" size="sm" onClick={toggleAll} className="text-xs">
              {selected.size === CONSULTA_TYPES.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
          </div>

          <div className="grid gap-2">
            {CONSULTA_TYPES.map(ct => (
              <label
                key={ct.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(ct.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <Checkbox
                  checked={selected.has(ct.id)}
                  onCheckedChange={() => toggle(ct.id)}
                />
                <span className="text-sm font-medium text-foreground">{ct.label}</span>
              </label>
            ))}
          </div>

          <Button
            onClick={() => onExecute(Array.from(selected))}
            disabled={selected.size === 0}
            className="w-full"
          >
            Executar consultas ({selected.size})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
