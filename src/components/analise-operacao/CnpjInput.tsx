import { useState, useCallback } from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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
  onConfirm: (cnpj: string) => void;
}

export function CnpjInput({ onConfirm }: CnpjInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value);
    setValue(formatted);
    setError(null);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const formatted = formatCnpj(pasted);
    setValue(formatted);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 14) {
      setError('CNPJ incompleto. Informe os 14 dígitos.');
      return;
    }
    if (!validateCnpj(digits)) {
      setError('CNPJ inválido. Verifique os dígitos informados.');
      return;
    }
    onConfirm(digits);
  }, [value, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Informe o CNPJ</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Digite ou cole o CNPJ que será consultado
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="00.000.000/0000-00"
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
          disabled={value.replace(/\D/g, '').length === 0}
        >
          Confirmar CNPJ
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
