import { useState, useCallback } from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { CnpjInput } from '@/components/analise-operacao/CnpjInput';
import { ConsultaSelection, type ConsultaTypeId } from '@/components/analise-operacao/ConsultaSelection';
import { ConsultaExecution } from '@/components/analise-operacao/ConsultaExecution';

type Step = 'cnpj' | 'selection' | 'execution';

export default function AnaliseOperacao() {
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
    { key: 'cnpj', label: '1. CNPJ' },
    { key: 'selection', label: '2. Consultas' },
    { key: 'execution', label: '3. Resultados' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Análise de Operação</h1>
              <p className="text-sm text-muted-foreground">
                Consultas integradas por CNPJ
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
          />
        )}
      </div>
    </div>
  );
}
