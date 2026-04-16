import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface UserFormData {
  name: string;
  email: string;
  password: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: { name: string; email: string } | null;
  onSave: (data: UserFormData) => Promise<void>;
  saving: boolean;
}

export function UserFormDialog({
  open,
  onOpenChange,
  editingUser,
  onSave,
  saving,
}: UserFormDialogProps) {
  const [formData, setFormData] = useState<UserFormData>({
    name: editingUser?.name || '',
    email: editingUser?.email || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Sync form when editingUser prop changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: editingUser?.name || '',
        email: editingUser?.email || '',
        password: '',
      });
      setShowPassword(false);
    }
  }, [open, editingUser]);

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && editingUser) {
      setFormData({ name: editingUser.name, email: editingUser.email, password: '' });
    } else if (isOpen) {
      setFormData({ name: '', email: '', password: '' });
    }
    setShowPassword(false);
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const isEditing = !!editingUser;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl">
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing
              ? 'Atualize as informações do usuário abaixo.'
              : 'Preencha os dados para criar um novo usuário no sistema.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Nome completo
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Digite o nome completo"
              className="h-11"
              required
            />
            <p className="text-xs text-muted-foreground">
              Nome que será exibido no sistema
            </p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              className="h-11"
              disabled={isEditing}
              required
            />
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? 'O e-mail não pode ser alterado'
                : 'Usado para login no sistema'}
            </p>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {isEditing ? 'Nova senha' : 'Senha'}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditing ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                className="h-11 pr-10"
                required={!isEditing}
                minLength={isEditing && formData.password ? 6 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? 'Preencha apenas se desejar alterar a senha atual'
                : 'A senha deve ter no mínimo 6 caracteres'}
            </p>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar alterações'
              ) : (
                'Criar usuário'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
