import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CadastrarAniversarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CadastrarAniversarioDialog({ open, onOpenChange, onSuccess }: CadastrarAniversarioDialogProps) {
  const { user } = useAuth();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!cpfCnpj.trim() || !nome.trim() || !dataNascimento) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('cedente_birthdays' as any)
        .upsert({
          cedente_cpf_cnpj: cpfCnpj.trim(),
          cedente_nome: nome.trim(),
          data_nascimento: dataNascimento,
          created_by: user.id,
        }, { onConflict: 'cedente_cpf_cnpj' });

      if (error) throw error;

      toast.success('Data de nascimento cadastrada!');
      setCpfCnpj('');
      setNome('');
      setDataNascimento('');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Data de Nascimento</DialogTitle>
          <DialogDescription>
            Registre a data de nascimento de um cedente para receber lembretes de aniversário.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cpf_cnpj">CPF/CNPJ do Cedente</Label>
            <Input
              id="cpf_cnpj"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Cedente</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data_nascimento">Data de Nascimento</Label>
            <Input
              id="data_nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
