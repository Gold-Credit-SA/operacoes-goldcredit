import { useState, useCallback } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface ConsultaType {
  id: string;
  label: string;
}

interface ConsultaGroup {
  provider: string;
  items: ConsultaType[];
}

export const CONSULTA_GROUPS: ConsultaGroup[] = [
  {
    provider: 'Agrisk',
    items: [
      { id: 'restritivos', label: 'Restritivos Nacional' },
      { id: 'endividamento', label: 'Endividamento Financeiro' },
      { id: 'cpr', label: 'Consulta CPR' },
      { id: 'imoveis_simples', label: 'Pesquisa de Imóveis - Simples' },
      { id: 'imoveis_car', label: 'Pesquisa Imóveis - CAR' },
      { id: 'patrimonio_veicular', label: 'Patrimônio Veicular' },
    ],
  },
  {
    provider: 'Serasa',
    items: [
      { id: 'serasa_basico_pf', label: 'Relatório Básico PF (Serasa)' },
      { id: 'serasa_avancado_top_score_pf', label: 'Top Score PF (Serasa)' },
      { id: 'serasa_basico_pj', label: 'Relatório Básico PJ (Serasa)' },
      { id: 'serasa_avancado_pj', label: 'Relatório Avançado PJ (Serasa)' },
      { id: 'serasa_avancado_pj_analitico', label: 'Relatório Analítico PJ (Serasa)' },
    ],
  },
  {
    provider: 'HBI',
    items: [
      { id: 'scr', label: 'SCR' },
    ],
  },
];

export const CONSULTA_TYPES = CONSULTA_GROUPS.flatMap(g => g.items);

export type ConsultaTypeId = string;

interface ConsultaSelectionProps {
  cnpj: string;
  onExecute: (selected: ConsultaTypeId[]) => void;
  onBack: () => void;
}

function formatDocDisplay(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function ConsultaSelection({ cnpj, onExecute, onBack }: ConsultaSelectionProps) {
  const [selected, setSelected] = useState<Set<ConsultaTypeId>>(new Set());
  const isCpf = cnpj.replace(/\D/g, '').length === 11;

  // Filter groups based on document type
  const filteredGroups = CONSULTA_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // PF-only reports require CPF
      if ((item.id === 'serasa_basico_pf' || item.id === 'serasa_avancado_top_score_pf') && !isCpf) return false;
      // PJ-only reports require CNPJ
      if ((item.id === 'serasa_basico_pj' || item.id === 'serasa_avancado_pj' || item.id === 'serasa_avancado_pj_analitico') && isCpf) return false;
      return true;
    }),
  })).filter(group => group.items.length > 0);

  const filteredTypes = filteredGroups.flatMap(g => g.items);

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
      if (prev.size === filteredTypes.length) return new Set();
      return new Set(filteredTypes.map(c => c.id));
    });
  }, [filteredTypes]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* CNPJ context */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{cnpj.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'}:</span>
          <Badge variant="outline" className="font-mono text-xs">{formatDocDisplay(cnpj)}</Badge>
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
              {selected.size === filteredTypes.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
          </div>

          <div className="space-y-4">
            {filteredGroups.map(group => (
              <div key={group.provider} className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group.provider}
                </span>
                <div className="grid gap-2">
                  {group.items.map(ct => (
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
              </div>
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
