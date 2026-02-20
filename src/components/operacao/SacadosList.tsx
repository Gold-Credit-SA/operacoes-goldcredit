import { CheckCircle2, AlertCircle, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SacadoXml } from '@/lib/xml-nfe-parser';

export interface SacadoComStatus extends SacadoXml {
  cadastrado: boolean;
  sacadoId?: string;
}

interface Props {
  sacados: SacadoComStatus[];
  onCadastrar: (sacado: SacadoXml) => void;
  onCadastroManual: () => void;
}

export function SacadosList({ sacados, onCadastrar, onCadastroManual }: Props) {
  const cadastrados = sacados.filter(s => s.cadastrado).length;
  const pendentes = sacados.length - cadastrados;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sacados Identificados</h3>
            <p className="text-xs text-muted-foreground">
              {sacados.length} sacado{sacados.length !== 1 ? 's' : ''} · {cadastrados} cadastrado{cadastrados !== 1 ? 's' : ''} · {pendentes} pendente{pendentes !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onCadastroManual}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Cadastro Manual
        </Button>
      </div>

      <div className="space-y-2">
        {sacados.map((s, i) => (
          <div
            key={`${s.cpfCnpj}-${i}`}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-colors",
              s.cadastrado
                ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                : "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
            )}
          >
            <div className="flex items-center gap-3">
              {s.cadastrado ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{s.nome || 'Sem nome'}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.cpfCnpj}</p>
                {s.cidade && (
                  <p className="text-xs text-muted-foreground">{s.cidade}{s.estado ? ` - ${s.estado}` : ''}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {s.cadastrado ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Cadastrado
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="text-xs"
                  onClick={() => onCadastrar(s)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Cadastrar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
