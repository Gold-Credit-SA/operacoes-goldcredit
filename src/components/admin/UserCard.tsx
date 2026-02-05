import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Shield, Calendar, Mail } from 'lucide-react';

interface UserCardProps {
  user: {
    id: string;
    user_id: string;
    email: string;
    name: string;
    created_at: string;
    user_roles: { role: string }[];
  };
  isCurrentUser: boolean;
  isMaster: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function UserCard({ user, isCurrentUser, isMaster, onEdit, onDelete }: UserCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Card className={`transition-all hover:shadow-md ${isCurrentUser ? 'ring-2 ring-primary/20' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-border">
              <AvatarFallback className={isMaster ? 'bg-primary/10 text-primary' : 'bg-muted'}>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{user.name}</h3>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">
                    Você
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{user.email}</span>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Desde {formatDate(user.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Role & Actions */}
          <div className="flex flex-col items-end gap-3">
            <Badge
              variant={isMaster ? 'default' : 'secondary'}
              className={`${isMaster ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {isMaster && <Shield className="h-3 w-3 mr-1" />}
              {isMaster ? 'Administrador' : 'Usuário'}
            </Badge>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>

              {!isMaster && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Tem certeza que deseja excluir o usuário{' '}
                          <strong>{user.name}</strong>?
                        </p>
                        <p className="text-destructive">
                          Esta ação não pode ser desfeita.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, excluir usuário
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
