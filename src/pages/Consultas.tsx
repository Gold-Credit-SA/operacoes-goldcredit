import { useState, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { CnpjInput } from '@/components/analise-operacao/CnpjInput';
import { ConsultaSelection, type ConsultaTypeId } from '@/components/analise-operacao/ConsultaSelection';
import { ConsultaExecution } from '@/components/analise-operacao/ConsultaExecution';
import { CONSULTA_GROUPS } from '@/components/analise-operacao/ConsultaSelection';

type Step = 'cnpj' | 'selection' | 'execution';

/** Maps consulta type id → platform for saving history */
function getPlatformForConsulta(id: ConsultaTypeId): string {
  for (const g of CONSULTA_GROUPS) {
    if (g.items.some(i => i.id === id)) {
      if (g.provider === 'HBI') return 'scr';
      return g.provider.toLowerCase();
    }
  }
  return 'other';
}

export default function Consultas() {
  const [step, setStep] = useState<Step>('cnpj');
  const [cnpj, setCnpj] = useState('');
  const [selectedConsultas, setSelectedConsultas] = useState<ConsultaTypeId[]>([]);

  const handleCnpjConfirm = useCallback((value: string) => {
    setCnpj(value);
    setStep('selection');
  }, []);

  const handleExecute = useCallback((selected: ConsultaTypeId[]) => {
    setSelectedConsultas(selected);
    setStep('execution');
  }, []);

  const handleReset = useCallback(() => {
    setStep('cnpj');
    setCnpj('');
    setSelectedConsultas([]);
  }, []);

  const stepIndex = step === 'cnpj' ? 0 : step === 'selection' ? 1 : 2;
  const steps = [
    { key: 'cnpj', label: '1. CPF/CNPJ' },
    { key: 'selection', label: '2. Consultas' },
    { key: 'execution', label: '3. Resultados' },
  ];

  // Determine saveToPlatform based on selected consultas
  // If all belong to same platform, use that; otherwise use first one's platform
  const savePlatform = selectedConsultas.length > 0 ? getPlatformForConsulta(selectedConsultas[0]) : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Consultas</h1>
              <p className="text-sm text-muted-foreground">
                Consultas integradas por CPF/CNPJ
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  stepIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : stepIndex > i
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {step === 'cnpj' && (
          <CnpjInput onConfirm={handleCnpjConfirm} />
        )}

        {step === 'selection' && (
          <ConsultaSelection
            cnpj={cnpj}
            onExecute={handleExecute}
            onBack={() => setStep('cnpj')}
          />
        )}

        {step === 'execution' && (
          <ConsultaExecution
            cnpj={cnpj}
            selected={selectedConsultas}
            onBack={() => setStep('selection')}
            onNewAnalysis={handleReset}
            saveToPlatform={savePlatform}
          />
        )}
      </div>
    </div>
  );
}
