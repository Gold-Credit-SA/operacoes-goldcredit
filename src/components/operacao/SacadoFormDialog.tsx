import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export interface SacadoFormData {
  cpf_cnpj: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  email: string;
  telefone: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SacadoFormData) => void;
  initialData?: Partial<SacadoFormData>;
  loading?: boolean;
}

export function SacadoFormDialog({ open, onClose, onSubmit, initialData, loading }: Props) {
  const [form, setForm] = useState<SacadoFormData>({
    cpf_cnpj: initialData?.cpf_cnpj || '',
    nome: initialData?.nome || '',
    endereco: initialData?.endereco || '',
    cidade: initialData?.cidade || '',
    estado: initialData?.estado || '',
    cep: initialData?.cep || '',
    email: initialData?.email || '',
    telefone: initialData?.telefone || '',
  });

  const update = (field: keyof SacadoFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cpf_cnpj.trim() || !form.nome.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData?.cpf_cnpj ? 'Cadastrar Sacado do XML' : 'Cadastrar Sacado Manualmente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CPF/CNPJ *</Label>
              <Input value={form.cpf_cnpj} onChange={e => update('cpf_cnpj', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nome / Razão Social *</Label>
              <Input value={form.nome} onChange={e => update('nome', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={e => update('endereco', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={e => update('cidade', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Input value={form.estado} onChange={e => update('estado', e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={e => update('cep', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => update('telefone', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !form.cpf_cnpj.trim() || !form.nome.trim()}>
              {loading ? 'Salvando...' : 'Cadastrar Sacado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
