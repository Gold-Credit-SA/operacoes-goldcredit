import { useState, useCallback } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  
  // CPF formatting (up to 11 digits)
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  
  // CNPJ formatting (12-14 digits)
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (slice: string, factors: number[]) => {
    const sum = slice.split('').reduce((acc, d, i) => acc + parseInt(d) * factors[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (parseInt(digits[12]) !== d1) return false;

  const d2 = calc(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(digits[13]) === d2;
}

interface CnpjInputProps {
  onConfirm: (document: string) => void;
}

export function CnpjInput({ onConfirm }: CnpjInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const digits = value.replace(/\D/g, '');
  const isCpf = digits.length <= 11;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setValue(formatted);
    setError(null);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const formatted = formatCpfCnpj(pasted);
    setValue(formatted);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const d = value.replace(/\D/g, '');
    if (d.length !== 11 && d.length !== 14) {
      setError('Documento incompleto. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).');
      return;
    }
    if (d.length === 11 && !validateCpf(d)) {
      setError('CPF inválido. Verifique os dígitos informados.');
      return;
    }
    if (d.length === 14 && !validateCnpj(d)) {
      setError('CNPJ inválido. Verifique os dígitos informados.');
      return;
    }
    onConfirm(d);
  }, [value, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-xl bg-primary/10">
            <Search className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Informe o CPF ou CNPJ</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Digite ou cole o documento que será consultado
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Input
            placeholder={isCpf ? '000.000.000-00' : '00.000.000/0000-00'}
            value={value}
            onChange={handleChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className={`text-center text-lg font-mono tracking-wider ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={digits.length === 0}
        >
          Confirmar {isCpf && digits.length <= 11 ? 'CPF' : 'CNPJ'}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
